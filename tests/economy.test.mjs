import test from 'node:test';
import assert from 'node:assert/strict';
import {Inventory,makeItem,equipmentStats,formatStat,sellPrice,SLOTS,STAT_LABELS} from '../survivors/loot.mjs';
import {World,random} from '../survivors/core.mjs';
import {shopStock,buyPrice,purchase} from '../survivors/shop.mjs';
const relic={id:'relic',name:'Treasure band',slot:'ring',rarity:'magic',icon:'ring',stats:{magicFind:.4,goldFind:.5}};
test('find stats survive saves, apply through equipment, and revert without stacking',()=>{const w=new World({inventory:{bag:[relic]}});w.equipItem('relic');w.refreshEquipment();assert.equal(w.player.magicFind,.4);assert.equal(w.player.goldFind,.5);const restored=new World({inventory:JSON.parse(JSON.stringify(w.inventory.snapshot()))});assert.equal(restored.player.magicFind,.4);restored.unequipItem('ring');assert.equal(restored.player.goldFind,0);});
test('Magic Find shifts common rolls toward magic and magic rolls toward rare',()=>{
  assert.equal(makeItem(()=>.4,{magicFind:0}).rarity,'common');assert.equal(makeItem(()=>.4,{magicFind:1}).rarity,'magic');
  assert.equal(makeItem(()=>.7,{magicFind:0}).rarity,'magic');assert.equal(makeItem(()=>.7,{magicFind:3}).rarity,'rare');
  assert.equal(makeItem(()=>.6,{boss:true,magicFind:0}).rarity,'magic');assert.equal(makeItem(()=>.6,{boss:true,magicFind:1}).rarity,'rare');
});
test('actual dropped loot uses equipped Magic Find',()=>{const w=new World({inventory:{equipment:{ring:relic}}});w.rng=()=>.5;const item=w.dropLoot({x:0,y:0,boss:false});assert.equal(item.rarity,'magic');});
test('Gold Find increases actual enemy coin drops and boss rewards',()=>{
  const kill=find=>{const w=new World();w.player.goldFind=find;w.rng=()=>.13;const e=w.spawn('wolf');w.hurt(e,e.hp+1);return w;};
  assert.equal(kill(0).gems.filter(g=>g.type==='gold').length,0);const rich=kill(1);assert.equal(rich.gems.find(g=>g.type==='gold').value,4);
  const w=new World();w.player.goldFind=1;const boss=w.spawn('troll',true);w.hurt(boss,boss.hp+1);assert.equal(w.gold,30);
});
test('small fractional Gold Find bonuses retain expected value through stochastic rounding',()=>{const w=new World({seed:42});w.player.goldFind=.06;let total=0;for(let i=0;i<10000;i++)total+=w.goldAmount(2);assert.ok(total>21050&&total<21350);});
test('gold pickup adds currency without healing or adding experience',()=>{const w=new World();w.spawnTimer=Infinity;w.skills={};w.player.hp=50;w.gems=[{type:'gold',x:0,y:0,value:7}];w.step(.025);assert.equal(w.gold,7);assert.equal(w.player.hp,50);assert.equal(w.player.xp,0);});
test('selling credits the item value once and never sells equipped gear',()=>{const inv=new Inventory({bag:[relic]});const price=sellPrice(relic);assert.ok(price>0);assert.equal(inv.sell('relic'),price);assert.equal(inv.sell('relic'),0);inv.add(relic);inv.equip('relic');assert.equal(inv.sell('relic'),0);assert.equal(equipmentStats(inv.equipment).magicFind,.4);});
test('shop stock is deterministic, covers all slots, and offers prices above resale',()=>{const a=shopStock(42,1);assert.deepEqual(a,shopStock(42,1));assert.deepEqual(a.map(i=>i.slot),SLOTS);for(const item of a)assert.equal(buyPrice(item),sellPrice(item)*3);assert.notDeepEqual(a,shopStock(43,1));});
test('purchase removes stock and deducts the price exactly once',()=>{const inv=new Inventory(),stock=shopStock(42),item=stock[0],price=buyPrice(item);const result=purchase(inv,stock,1000,item.id);assert.equal(result.ok,true);assert.equal(result.gold,1000-price);assert.equal(inv.bag[0].id,item.id);assert.equal(stock.length,SLOTS.length-1);assert.equal(purchase(inv,stock,result.gold,item.id).ok,false);});
test('unaffordable or full-bag purchases are atomic and cannot create free items',()=>{for(const full of [false,true]){const inv=new Inventory();if(full)for(let i=0;i<36;i++)inv.add(makeItem(random(i+1),{id:`filled-${i}`}));const stock=shopStock(42),before=JSON.stringify({inv:inv.snapshot(),stock});const result=purchase(inv,stock,full?1000:0,stock[0].id);assert.equal(result.ok,false);assert.equal(JSON.stringify({inv:inv.snapshot(),stock}),before);}});
test('all item stat displays use exactly one decimal place',()=>{for(const key of Object.keys(STAT_LABELS))assert.match(formatStat(key,.1234),/^\+\d+\.\d%? /);assert.equal(formatStat('regen',.15),'+0.2 Health per second');assert.equal(formatStat('magicFind',.1234),'+12.3% Magic Find');assert.equal(formatStat('goldFind',-.1234),'-12.3% Gold Find');});
