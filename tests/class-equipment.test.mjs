import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEM_CATALOG} from '../survivors/item-catalog.mjs';
import {Inventory,canEquip,equipmentStats,makeItem,outclasses,classLabel} from '../survivors/loot.mjs';
import {World,random} from '../survivors/core.mjs';
import {shopStock,purchase} from '../survivors/shop.mjs';
const gear=(classes,id='item',stats={maxHp:30})=>{
  const [icon,entry]=Object.entries(ITEM_CATALOG).find(([,entry])=>entry.slot==='armor'&&entry.classes.join(',')===classes);
  return {id,icon,name:entry.name,slot:entry.slot,rarity:'magic',stats};
};

test('catalog class groups match the original mage/fighter layers, with shared jewelry',()=>{
  const counts={};for(const entry of Object.values(ITEM_CATALOG)){const key=entry.classes.join(',');counts[key]=(counts[key]||0)+1;}
  assert.deepEqual(counts,{'warrior,ranger':392,mage:103,'mage,warrior,ranger':52});
  assert.equal(classLabel(gear('mage')),'Mage');assert.equal(classLabel(gear('warrior,ranger')),'Warrior / Archer');
});

test('each class receives usable actual ground drops and refreshed shop stock',()=>{
  for(const hero of ['mage','warrior','ranger']){
    const world=new World({hero,seed:42}),rng=random(17);
    for(let i=0;i<300;i++){
      assert.equal(canEquip(makeItem(rng,{hero}),hero),true);
      assert.equal(canEquip(world.dropLoot({x:10,y:10}),hero),true);
    }
    for(const item of shopStock(17,10,hero))assert.equal(canEquip(item,hero),true);
  }
});

test('click and drag equip reject another class, including swapping from equipment into a full backpack',()=>{
  const mage=gear('mage','robe'),fighter=gear('warrior,ranger','mail'),inventory=new Inventory({bag:[fighter]},'mage');
  const before=inventory.snapshot();assert.equal(inventory.equip(fighter.id),false);assert.equal(inventory.move(fighter.id,{slot:'armor'}),false);assert.deepEqual(inventory.snapshot(),before);
  inventory.add(mage);assert.equal(inventory.equip(mage.id),true);
  assert.equal(inventory.move(mage.id,{bagIndex:0}),false);assert.equal(inventory.equipment.armor.id,mage.id);
  assert.equal(inventory.move(mage.id,{bagIndex:4}),true);
  const stock=[fighter],purchaseBefore=JSON.stringify({stock,inventory:inventory.snapshot()});assert.equal(purchase(inventory,stock,1000,fighter.id).ok,false);assert.equal(JSON.stringify({stock,inventory:inventory.snapshot()}),purchaseBefore);
});

test('switching class preserves all gear and bag positions but disables incompatible equipped bonuses',()=>{
  const fighter=gear('warrior,ranger','mail',{maxHp:50,armor:9}),saved=new Inventory({equipment:{armor:fighter}}).snapshot();
  const mage=new World({hero:'mage',inventory:saved}),warrior=new World({hero:'warrior',inventory:saved});
  assert.equal(mage.player.maxHp,100);assert.equal(mage.player.armor,0);assert.equal(mage.inventory.equipment.armor.icon,fighter.icon);
  assert.equal(warrior.player.maxHp,195);assert.equal(warrior.player.armor,9);
  assert.equal(mage.unequipItem(fighter.slot),true);assert.equal(mage.inventory.bag[0].id,fighter.id);
  assert.equal(equipmentStats(saved.equipment,'mage').maxHp,0);
});

test('autosell preserves items that are useful to a different class',()=>{
  const mage=gear('mage','robe',{maxHp:10}),fighter=gear('warrior,ranger','mail',{maxHp:100});
  assert.equal(outclasses(fighter,mage),false);assert.equal(outclasses(mage,fighter),false);
  const inventory=new Inventory({bag:[mage,fighter]},'mage');assert.equal(inventory.autoSell().sold.length,0);
  assert.equal(inventory.pickup({...mage,id:'better-robe',stats:{maxHp:20}}).sold[0].id,'robe');assert.ok(inventory.bag.some(item=>item.id==='mail'));
});
