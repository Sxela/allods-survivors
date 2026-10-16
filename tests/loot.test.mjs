import test from 'node:test';
import assert from 'node:assert/strict';
import {SLOTS,STAT_LABELS,makeItem,equipmentStats,sanitizeInventory,Inventory,formatStat} from '../survivors/loot.mjs';
import {random} from '../survivors/core.mjs';
import {ITEM_CATALOG} from '../survivors/item-catalog.mjs';

function item(id,slot='weapon',stats={damage:.05}){
  return {id,name:'Test relic',slot,rarity:'common',stats,icon:slot};
}

test('new inventories have all equipment slots and no inherited gear',()=>{
  const inventory=new Inventory();assert.deepEqual(inventory.bag,[]);
  assert.deepEqual(Object.keys(inventory.equipment),SLOTS);
  assert.ok(Object.values(inventory.equipment).every(value=>value===null));
  assert.ok(Object.values(equipmentStats(inventory.equipment)).every(value=>value===0));
});

test('seeded loot is deterministic, well formed, and bosses never drop common gear',()=>{
  const a=random(761),b=random(761),tiers=new Set(),slots=new Set();
  for(let i=0;i<1000;i++){
    const options={level:1+i%50,boss:i%2===0,id:`drop-${i}`};
    const loot=makeItem(a,options);assert.deepEqual(loot,makeItem(b,options));
    assert.equal(loot.id,options.id);assert.equal(ITEM_CATALOG[loot.icon].slot,loot.slot);
    assert.ok(SLOTS.includes(loot.slot));slots.add(loot.slot);tiers.add(loot.rarity);
    if(options.boss)assert.notEqual(loot.rarity,'common');
    assert.deepEqual(sanitizeInventory({bag:[loot]}).bag,[loot]);
  }
  assert.equal(slots.size,SLOTS.length);assert.deepEqual([...tiers].sort(),['common','magic','rare','unique']);
});

test('run level scales matching seeded items without changing their slot or tier',()=>{
  const low=makeItem(random(42),{id:'low',level:1}),high=makeItem(random(42),{id:'high',level:20});
  assert.equal(low.slot,high.slot);assert.equal(low.rarity,high.rarity);
  for(const key of Object.keys(low.stats))assert.ok(high.stats[key]>low.stats[key]);
  assert.throws(()=>makeItem(()=>NaN),RangeError);
  assert.throws(()=>makeItem(()=>1),RangeError);
});

test('equipping swaps the old item back into the bag with no duplicated ownership',()=>{
  const inventory=new Inventory();inventory.add(item('a'));inventory.add(item('b','weapon',{damage:.1}));
  assert.equal(inventory.equip('a'),true);assert.equal(inventory.equip('b'),true);
  assert.equal(inventory.equipment.weapon.id,'b');assert.deepEqual(inventory.bag.map(i=>i.id),['a']);
  assert.equal(inventory.equip('b'),false);assert.equal(inventory.add(item('b')),false);
  assert.equal(inventory.add(item('a')),false);assert.equal(inventory.equip('missing'),false);
  assert.equal(equipmentStats(inventory.equipment).damage,.1);
});

test('a full bag allows equipment swaps but refuses unequips and extra loot',()=>{
  const inventory=new Inventory();inventory.add(item('old'));inventory.equip('old');
  for(let i=0;i<36;i++)assert.equal(inventory.add(item(`bag-${i}`)),true);
  assert.equal(inventory.add(item('overflow')),false);assert.equal(inventory.unequip('weapon'),false);
  assert.equal(inventory.equipment.weapon.id,'old');assert.equal(inventory.bag.length,36);
  assert.equal(inventory.equip('bag-0'),true);assert.equal(inventory.bag.length,36);
  assert.ok(inventory.bag.some(i=>i.id==='old'));
  assert.equal(inventory.discard('old'),true);assert.equal(inventory.unequip('weapon'),true);
  assert.equal(inventory.equipment.weapon,null);assert.equal(inventory.bag.length,36);
  assert.equal(inventory.unequip('weapon'),false);assert.equal(inventory.discard('missing'),false);
});

test('stat totals use equipped items only and remain additive across slots',()=>{
  const inventory=new Inventory({bag:[item('bag','weapon',{damage:9})],equipment:{
    weapon:item('staff','weapon',{damage:.05,haste:.1}),
    armor:item('mail','armor',{maxHp:25,armor:2}),
    ring:item('ring','ring',{damage:.1,haste:.05,regen:.5}),
    boots:item('boots','boots',{speed:8,magnet:20}),
  }});
  assert.deepEqual(Object.fromEntries(Object.entries(equipmentStats(inventory.equipment)).filter(([,value])=>value)),{damage:.15,maxHp:25,armor:2,speed:8,haste:.15,magnet:20,regen:.5});
  inventory.unequip('ring');assert.equal(equipmentStats(inventory.equipment).damage,.05);
});

test('save sanitizing rejects malformed items, duplicate IDs, slot mismatches, and unbounded stats',()=>{
  const inheritedStats=Object.create({damage:10});inheritedStats.maxHp=12;
  const raw={bag:[null,{},item('same'),item('same'),item('../bad'),{...item('bad-slot'),slot:'__proto__'},
    {...item('bad-tier'),rarity:'mythic'},item('bad-values','weapon',{damage:Infinity,armor:NaN,speed:-3}),
    item('huge','weapon',{damage:99999}),item('mixed','ring',{haste:.1,unknown:30,damage:'10'}),item('inherited','helm',inheritedStats)],
    equipment:{weapon:item('same'),ring:item('same','ring'),helm:item('wrong','boots')}};
  const clean=sanitizeInventory(raw);
  assert.equal(clean.equipment.weapon.id,'same');assert.equal(clean.equipment.ring,null);assert.equal(clean.equipment.helm,null);
  assert.deepEqual(clean.bag.map(i=>i.id),['mixed','inherited']);
  assert.deepEqual(clean.bag[0].stats,{haste:.1});assert.deepEqual(clean.bag[1].stats,{maxHp:12});
  const excessive=sanitizeInventory({bag:Array.from({length:100},(_,i)=>item(`item-${i}`))});
  assert.equal(excessive.bag.length,36);
  assert.deepEqual(sanitizeInventory(null),new Inventory().snapshot());
});

test('snapshot roundtrips through JSON and is independent of input and live objects',()=>{
  const source=item('staff'),inventory=new Inventory({bag:[source]});
  source.stats.damage=19;assert.equal(inventory.bag[0].stats.damage,.05);
  inventory.equip('staff');const snapshot=inventory.snapshot();
  const restored=new Inventory(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(restored.snapshot(),snapshot);
  snapshot.equipment.weapon.stats.damage=12;assert.equal(inventory.equipment.weapon.stats.damage,.05);
  restored.equipment.weapon.stats.damage=.2;assert.equal(inventory.equipment.weapon.stats.damage,.05);
});

test('stat presentation distinguishes fractional bonuses from absolute units',()=>{
  assert.equal(formatStat('damage',.05),'+5.0% Damage');assert.equal(formatStat('haste',.1),'+10.0% Cast speed');
  assert.equal(formatStat('maxHp',25),'+25.0 Maximum health');assert.equal(formatStat('regen',.15),'+0.2 Health per second');
  assert.equal(formatStat('bogus',3),'');assert.equal(formatStat('armor',Infinity),'');
  assert.ok(Object.keys(STAT_LABELS).length>50);
});
