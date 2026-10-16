import test from 'node:test';
import assert from 'node:assert/strict';
import {Inventory,sellPrice} from '../survivors/loot.mjs';
import {World} from '../survivors/core.mjs';
import {ITEM_CATALOG} from '../survivors/item-catalog.mjs';
const item=(id,stats,slot='boots',extra={})=>({id,name:id,slot,rarity:'magic',stats,balanceVersion:2,...extra});

test('pickup fills empty slots, equips clear upgrades and sells displaced inferior gear once',()=>{
  const inv=new Inventory({},'mage'),first=item('first',{speed:1,goldFind:.01});
  assert.equal(inv.pickup(first,{autoEquip:true}).equipped[0].item.id,'first');
  const better=item('better',{speed:2,goldFind:.01,armor:.1}),result=inv.pickup(better,{autoEquip:true});
  assert.equal(inv.equipment.boots.id,'better');assert.deepEqual(result.sold.map(i=>i.id),['first']);assert.equal(result.gold,sellPrice(first));
  assert.equal(inv.bag.length,0);assert.equal(inv.pickup(better,{autoEquip:true}).ok,false);
});

test('equal items, missing stats, lost spell bonuses and tradeoffs never replace worn equipment',()=>{
  for(const stats of [{speed:1,'skill:shield':2},{speed:2},{speed:.5,'skill:shield':3},{speed:2,'skill:shield':1}]){
    const inv=new Inventory({equipment:{boots:item('worn',{speed:1,'skill:shield':2})}},'mage');
    inv.pickup(item('choice',stats),{autoEquip:true});assert.equal(inv.equipment.boots.id,'worn');
  }
});

test('inventory sweep equips the strongest comparable items and preserves tradeoffs and positions',()=>{
  const inv=new Inventory({bag:[item('weak',{speed:1}),item('best',{speed:2}),item('choice',{speed:1,armor:.2})],positions:{weak:3,best:8,choice:20}},'mage');
  assert.equal(inv.autoEquip().length,1);assert.equal(inv.equipment.boots.id,'best');assert.equal(inv.positions.choice,20);
  assert.deepEqual(inv.autoEquip(),[]);inv.autoSell();assert.deepEqual(inv.bag.map(i=>i.id),['choice']);
});

test('class-specific upgrades preserve displaced shared gear useful to other classes',()=>{
  const icon=Object.keys(ITEM_CATALOG).find(id=>ITEM_CATALOG[id].slot==='boots'&&ITEM_CATALOG[id].classes.length===1&&ITEM_CATALOG[id].classes[0]==='mage');
  assert.ok(icon);const inv=new Inventory({equipment:{boots:item('shared',{speed:1})}},'mage');
  inv.pickup(item('mage-upgrade',{speed:2},'boots',{icon}),{autoEquip:true});assert.equal(inv.equipment.boots.id,'mage-upgrade');assert.equal(inv.bag[0].id,'shared');
  const fighterIcon=Object.keys(ITEM_CATALOG).find(id=>ITEM_CATALOG[id].slot==='boots'&&!ITEM_CATALOG[id].classes.includes('mage'));
  inv.pickup(item('fighter',{speed:9},'boots',{icon:fighterIcon}),{autoEquip:true});assert.equal(inv.equipment.boots.id,'mage-upgrade');
});

test('a full backpack can accept an empty-slot pickup, while a rejected tradeoff is transactional',()=>{
  const rings=Array.from({length:36},(_,i)=>item(`ring-${i}`,{haste:.01},'ring'));
  const inv=new Inventory({bag:rings,equipment:{ring:item('worn',{haste:.01},'ring')}},'mage');
  assert.equal(inv.pickup(item('boots',{speed:1}),{autoEquip:true}).ok,true);assert.equal(inv.bag.length,36);
  const before=inv.snapshot();assert.equal(inv.pickup(item('tradeoff',{magicFind:.1},'ring'),{autoEquip:true}).ok,false);assert.deepEqual(inv.snapshot(),before);
});

test('automatic spell gear applies immediately and never accumulates duplicate stat bonuses',()=>{
  const w=new World();w.spawnTimer=Infinity;w.skills={};
  w.lootDrops=[{x:0,y:0,item:item('spell-ring',{'skill:shield':2,maxHp:5},'ring')}];w.step(.025);
  assert.equal(w.player.maxHp,105);assert.equal(w.effectiveRank('shield'),2);
  w.lootDrops=[{x:0,y:0,item:item('better-ring',{'skill:shield':3,maxHp:7},'ring')}];w.step(.025);
  assert.equal(w.player.maxHp,107);assert.equal(w.effectiveRank('shield'),3);w.refreshEquipment();assert.equal(w.player.maxHp,107);
});
