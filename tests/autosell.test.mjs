import test from 'node:test';
import assert from 'node:assert/strict';
import {Inventory,sellPrice} from '../survivors/loot.mjs';
import {World} from '../survivors/core.mjs';
const boots=(id,stats)=>({id,name:id,slot:'boots',rarity:'magic',stats});
test('inventory sweep sells inferior bag gear once, retaining equipment, equals, tradeoffs and positions',()=>{
  const inv=new Inventory({bag:[boots('weak',{speed:2}),boots('good',{speed:8}),boots('equal',{speed:8}),boots('different',{speed:1,armor:1})],equipment:{boots:boots('worn',{speed:4})},positions:{weak:3,good:15,equal:19,different:30}});
  const result=inv.autoSell();assert.deepEqual(result.sold.map(i=>i.id),['weak']);assert.equal(result.gold,sellPrice(boots('weak',{speed:2})));
  assert.equal(inv.equipment.boots.id,'worn');assert.deepEqual(inv.bag.map(i=>i.id),['good','equal','different']);
  assert.deepEqual({...inv.positions},{good:15,equal:19,different:30});assert.deepEqual(inv.autoSell(),{gold:0,sold:[]});
});
test('pickup sells dominated new and existing gear, retaining equal items and stat tradeoffs',()=>{
  const inv=new Inventory({bag:[boots('weak',{speed:3,goldFind:.05}),boots('best',{speed:6,goldFind:.1}),boots('tradeoff',{speed:8,goldFind:.04}),boots('unique',{speed:2,armor:1}),boots('single',{speed:1})]});
  const incoming=boots('new',{speed:6,goldFind:.1}),result=inv.pickup(incoming);
  assert.deepEqual(result.sold.map(i=>i.id),['weak','single']);assert.equal(result.gold,result.sold.reduce((sum,item)=>sum+sellPrice(item),0));
  assert.deepEqual(inv.bag.map(i=>i.id),['best','tradeoff','unique','new']);
  const worse=inv.pickup(boots('worse',{speed:2,goldFind:.02}));assert.equal(worse.kept,false);assert.equal(worse.sold.length,1);
  assert.equal(Object.hasOwn(inv.positions,'weak'),false);
});
test('all-red comparison sells rings missing equipped bonuses on pickup and inventory open',()=>{
  const ring=(id,stats)=>({id,name:id,slot:'ring',rarity:'rare',stats});
  const equipped=ring('sovereign',{haste:.243,magicFind:.103,maxHp:36.3,goldFind:.782});
  const inferior=ring('astral',{haste:.16,magicFind:.047});
  const unique=ring('unique-ring',{haste:.1,magicFind:.04,armor:.1});
  const inv=new Inventory({equipment:{ring:equipped},bag:[inferior,unique]});
  assert.deepEqual(inv.autoSell().sold.map(i=>i.id),['astral']);assert.deepEqual(inv.bag.map(i=>i.id),['unique-ring']);
  const pickup=inv.pickup(inferior);assert.equal(pickup.kept,false);assert.equal(pickup.gold,sellPrice(inferior));
  assert.equal(inv.equipment.ring.id,'sovereign');
});
test('equal shared stats plus an extra bonus dominate, while identical items stay',()=>{
  const inv=new Inventory({bag:[boots('plain',{speed:6}),boots('bonus',{speed:6,goldFind:.1}),boots('same',{speed:6,goldFind:.1})]});
  assert.deepEqual(inv.autoSell().sold.map(i=>i.id),['plain']);assert.deepEqual(inv.bag.map(i=>i.id),['bonus','same']);
});
test('equipped gear can dominate backpack items but can never be autosold',()=>{
  const equipped=boots('equipped',{speed:3}),inv=new Inventory({equipment:{boots:equipped}});
  assert.equal(inv.pickup(boots('weak',{speed:2})).kept,false);
  assert.equal(inv.pickup(boots('strong',{speed:8})).kept,true);
  assert.equal(inv.equipment.boots.id,'equipped');assert.equal(inv.bag[0].id,'strong');
});
test('full backpack accepts a better replacement or sells an inferior pickup without space',()=>{
  const inv=new Inventory({bag:Array.from({length:36},(_,i)=>boots('b'+i,{speed:3}))});
  const result=inv.pickup(boots('best',{speed:9}));assert.equal(result.ok,true);assert.equal(result.sold.length,36);assert.equal(inv.bag.length,1);
  const full=new Inventory({bag:Array.from({length:36},(_,i)=>boots('b'+i,{speed:9}))});
  assert.equal(full.pickup(boots('worse',{speed:1})).kept,false);assert.equal(full.bag.length,36);
  assert.equal(full.pickup(boots('different',{speed:8,armor:1})).ok,false);assert.equal(full.bag.length,36);
});
test('nearby pickup emits exact autosale proceeds once and removes the drop',()=>{
  const w=new World({inventory:{bag:[boots('weak',{speed:2})]}});w.spawnTimer=Infinity;w.skills={};
  w.lootDrops.push({x:0,y:0,item:boots('better',{speed:8})});w.step(.025);
  const event=w.events.find(e=>e.type==='lootPicked');assert.equal(event.autoSold,1);assert.equal(event.saleGold,sellPrice(boots('weak',{speed:2})));
  assert.equal(w.lootDrops.length,0);w.events=[];w.step(.025);assert.equal(w.events.filter(e=>e.type==='lootPicked').length,0);
});
