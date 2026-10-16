import test from 'node:test';
import assert from 'node:assert/strict';
import {World,random} from '../survivors/core.mjs';
import {Inventory,makeItem,rebalanceSavedItems} from '../survivors/loot.mjs';
import {resetAfterDeath} from '../survivors/progression.mjs';

test('legacy backpack, equipment and trader stats convert once while spell grants stay whole',()=>{
  const gear=id=>({id,name:id,slot:'armor',rarity:'rare',stats:{maxHp:500,haste:.5,body:10,'skill:shield':3}});
  const save={inventory:{bag:[gear('bag')],equipment:{armor:gear('worn')}},shopStock:[gear('shop')]};
  rebalanceSavedItems(save);
  for(const item of [save.inventory.bag[0],save.inventory.equipment.armor,save.shopStock[0]]){
    assert.deepEqual(item.stats,{maxHp:50,haste:.05,body:1,'skill:shield':3});assert.equal(item.balanceVersion,2);
  }
  const once=JSON.stringify(save);rebalanceSavedItems(save);assert.equal(JSON.stringify(save),once);
  save.inventory=new Inventory(save.inventory).snapshot();rebalanceSavedItems(save);assert.equal(save.inventory.bag[0].stats.maxHp,50);
});

test('new rolls stay bounded at extreme levels and never shrink again on reload',()=>{
  const rng=random(4821);let spells=0;
  for(let i=0;i<4000;i++){
    const item=makeItem(rng,{level:99,boss:true,statMultiplier:3,id:`bounded-${i}`});
    assert.ok((item.stats.maxHp||0)<=60);assert.ok((item.stats.maxMana||0)<=100);
    for(const [key,value] of Object.entries(item.stats))if(key.startsWith('skill:')){assert.ok(Number.isInteger(value)&&value>=1&&value<=3);spells++;}
    const save={inventory:{bag:[item]}};rebalanceSavedItems(save);assert.deepEqual(new Inventory(save.inventory).bag,[item]);
  }
  assert.ok(spells>0);
});

test('death clears banked and active progression, and retry has only its class starting spell',()=>{
  const w=new World({bonuses:{power:5,vitality:4}}),item=makeItem(random(17),{slot:'armor',id:'doomed'});
  item.stats['skill:shield']=3;w.inventory.add(item);w.equipItem(item.id);w.skills={bolt:5,shield:3};w.gold=50;w.status='dead';
  const save=resetAfterDeath(w,{gold:200,best:500,runs:12,upgrades:{power:5},difficulty:'hard',shopGeneration:12});
  assert.equal(save.gold,0);assert.equal(save.best,0);assert.equal(save.runs,0);assert.deepEqual(save.upgrades,{});
  assert.deepEqual(save.inventory.bag,[]);assert.ok(Object.values(save.inventory.equipment).every(v=>v===null));
  assert.deepEqual(w.skills,{});assert.deepEqual(w.castingSkills(),[]);assert.equal(w.gold,0);assert.equal(save.difficulty,'hard');assert.equal(save.shopStock.length,9);
  const retry=new World({inventory:save.inventory,bonuses:save.upgrades,difficulty:save.difficulty});
  assert.equal(retry.player.maxHp,100);assert.equal(retry.player.damage,1);assert.deepEqual(retry.skills,{bolt:1});assert.equal(retry.player.level,1);
});
