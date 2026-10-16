import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';

const item=(id,slot,stats)=>({id,name:'Test relic',slot,rarity:'magic',stats,icon:slot});
function arena(options={}){
  const world=new World({seed:91337,...options});world.spawnTimer=Infinity;world.skills={};return world;
}
function equip(world,loot){assert.equal(world.inventory.add(loot),true);assert.equal(world.equipItem(loot.id),true);}
function upgrade(world,id){
  world.pendingLevels=1;world.status='levelup';world.choices=[{id,type:'passive'}];
  assert.equal(world.choose(0),true);
}

test('replaying a saved run seed never reuses collected or grounded loot IDs',()=>{
  const first=arena({seed:42}),enemy={x:0,y:0,boss:false};
  const item=first.dropLoot(enemy);first.inventory.add(item);
  const replay=arena({seed:42,inventory:first.inventory.snapshot()});
  const a=replay.dropLoot(enemy),b=replay.dropLoot(enemy);
  assert.notEqual(a.id,item.id);assert.notEqual(b.id,item.id);assert.notEqual(a.id,b.id);
  assert.equal(replay.inventory.add(a),true);assert.equal(replay.inventory.add(b),true);
});

test('equipment refresh and repeated swaps never stack damage or erase passive bonuses',()=>{
  const world=arena();equip(world,item('weak','weapon',{damage:.1}));
  world.inventory.add(item('strong','weapon',{damage:.3}));
  for(let i=0;i<12;i++)world.refreshEquipment();assert.equal(world.player.damage,1.1);
  upgrade(world,'power');assert.equal(world.baseStats.damage,1.15);assert.equal(world.player.damage,1.25);
  for(let i=0;i<10;i++){
    assert.equal(world.equipItem('strong'),true);assert.ok(Math.abs(world.player.damage-1.45)<1e-9);
    assert.equal(world.equipItem('weak'),true);assert.equal(world.player.damage,1.25);
  }
  assert.equal(world.unequipItem('weapon'),true);assert.equal(world.player.damage,1.15);
  assert.equal(world.equipItem('missing'),false);assert.equal(world.player.damage,1.15);
});

test('speed, haste, magnet, and regeneration passives remain independent of equipment',()=>{
  const world=arena();equip(world,item('boots','boots',{speed:10,haste:.2,magnet:15,regen:.3}));
  assert.equal(world.player.speed,160);
  for(const id of ['speed','haste','magnet','regen'])upgrade(world,id);
  assert.equal(world.player.speed,172);assert.ok(Math.abs(world.player.haste-1.3)<1e-9);
  assert.equal(world.player.magnet,122);assert.equal(world.player.regen,.8);
  world.unequipItem('boots');
  assert.equal(world.player.speed,162);assert.equal(world.player.haste,1.1);
  assert.equal(world.player.magnet,107);assert.equal(world.player.regen,.5);
});

test('equipped damage affects actual spell hits and reverts on unequip',()=>{
  const world=arena(),enemy=world.spawn('wolf');
  Object.assign(enemy,{x:50,y:0,hp:1000,maxHp:1000,speed:0});
  equip(world,item('staff','weapon',{damage:.5}));
  world.cast('lightning',1);assert.equal(enemy.hp,949);
  world.unequipItem('weapon');world.cast('lightning',1);assert.equal(enemy.hp,915);
});

test('armor reduces contact damage and cannot reduce a hit below one',()=>{
  for(const armor of [0,4,30]){
    const world=arena();if(armor)equip(world,item(`armor-${armor}`,'armor',{armor}));
    const enemy=world.spawn('wolf');Object.assign(enemy,{x:0,y:0,speed:0,damage:10,attackCooldown:0});
    world.step(.025);assert.equal(world.player.hp,100-Math.max(1,10-armor));
    assert.equal(world.events.filter(e=>e.type==='hurt').length,1);
  }
});

test('armor reduces hostile projectile damage through the same damage path',()=>{
  for(const armor of [0,4,30]){
    const world=arena();if(armor)equip(world,item(`mail-${armor}`,'armor',{armor}));
    world.enemyProjectiles.push({x:0,y:0,vx:0,vy:0,ttl:1,damage:10});
    world.step(.025);assert.equal(world.player.hp,100-Math.max(1,10-armor));
    assert.equal(world.enemyProjectiles.length,0);
  }
});

test('contact plus projectiles in one frame respects invulnerability',()=>{
  const world=arena();equip(world,item('plate','armor',{armor:4}));
  const enemy=world.spawn('wolf');Object.assign(enemy,{x:0,y:0,speed:0,damage:10,attackCooldown:0});
  world.enemyProjectiles.push({x:0,y:0,vx:0,vy:0,ttl:1,damage:50});
  world.step(.025);assert.equal(world.player.hp,94);
  assert.equal(world.events.filter(e=>e.type==='hurt').length,1);
});

test('health equipment clamps on removal and cannot heal through repeated swapping',()=>{
  const world=arena();equip(world,item('crown','helm',{maxHp:50}));
  assert.equal(world.player.maxHp,150);assert.equal(world.player.hp,100);
  world.player.hp=140;world.unequipItem('helm');
  assert.equal(world.player.maxHp,100);assert.equal(world.player.hp,100);
  for(let i=0;i<5;i++){world.equipItem('crown');world.unequipItem('helm');}
  assert.equal(world.player.hp,100);
  world.equipItem('crown');world.player.hp=80;upgrade(world,'vitality');
  assert.equal(world.player.maxHp,175);assert.equal(world.player.hp,105);
  world.unequipItem('helm');assert.equal(world.player.maxHp,125);assert.equal(world.player.hp,105);
});

test('the first kill guarantees loot and every boss drops at least magic loot once',()=>{
  const world=arena(),first=world.spawn('wolf');
  world.hurt(first,first.maxHp+1);assert.equal(world.lootDrops.length,1);
  const firstDrop=world.lootDrops[0];assert.equal(firstDrop.x,first.x);assert.equal(firstDrop.y,first.y);
  const boss=world.spawn('troll',true);world.hurt(boss,boss.maxHp+1);
  assert.equal(world.lootDrops.length,2);
  assert.ok(['magic','rare'].includes(world.lootDrops[1].item.rarity));
  assert.notEqual(firstDrop.item.id,world.lootDrops[1].item.id);
  world.hurt(boss,1000);assert.equal(world.lootDrops.length,2);
});

test('nearby loot automatically fills its empty equipment slot and applies stats',()=>{
  const world=arena(),loot=world.dropLoot({x:0,y:0,boss:false});world.step(.025);
  assert.equal(world.lootDrops.length,0);assert.equal(world.inventory.bag.length,0);
  assert.equal(world.inventory.equipment[loot.slot].id,loot.id);
  assert.equal(world.events.filter(e=>e.type==='lootPicked').length,1);
  assert.ok(world.events.find(e=>e.type==='lootPicked').autoEquipped.includes(loot.name));
});

test('a full bag leaves nearby loot on the ground and collects after making space',()=>{
  const world=arena();equip(world,item('worn-ring','ring',{haste:.05}));
  for(let i=0;i<36;i++)world.inventory.add(item(`bag-${i}`,'ring',{haste:.05}));
  const loot=item('tradeoff-drop','ring',{magicFind:.1});world.lootDrops.push({x:0,y:0,item:loot});
  for(let i=0;i<10;i++)world.step(.025);
  assert.equal(world.lootDrops.length,1);assert.equal(world.lootDrops[0].item.id,loot.id);
  assert.equal(world.inventory.bag.length,36);
  assert.equal(world.events.filter(e=>e.type==='inventoryFull').length,1,'full bag warning should not repeat every frame');
  world.inventory.discard('bag-0');world.step(.025);
  assert.equal(world.lootDrops.length,0);assert.equal(world.inventory.bag.length,36);
  assert.ok(world.inventory.bag.some(entry=>entry.id===loot.id));
});

test('opening inventory freezes movement, combat, timers, and ground loot pickup',()=>{
  const world=arena(),enemy=world.spawn('wolf');Object.assign(enemy,{x:20,y:0,speed:10});
  world.dropLoot({x:0,y:0,boss:false});world.status='inventory';
  const before={time:world.time,x:world.player.x,hp:world.player.hp,enemyX:enemy.x,bag:world.inventory.bag.length};
  for(let i=0;i<20;i++)world.step(.05,{x:1});
  assert.deepEqual({time:world.time,x:world.player.x,hp:world.player.hp,enemyX:enemy.x,bag:world.inventory.bag.length},before);
  assert.equal(world.lootDrops.length,1);
});

test('save snapshots carry equipment to a new run without run passives or duplicate stat application',()=>{
  const first=arena();equip(first,item('staff','weapon',{damage:.2,haste:.1}));
  equip(first,item('vest','armor',{maxHp:30,armor:3}));upgrade(first,'power');
  first.inventory.add(item('spare','ring',{magnet:15}));
  const saved=JSON.parse(JSON.stringify(first.inventory.snapshot()));
  const second=arena({seed:1222,inventory:saved});
  assert.equal(second.player.damage,1.2);assert.equal(second.player.haste,1.1);
  assert.equal(second.player.maxHp,130);assert.equal(second.player.hp,130);assert.equal(second.player.armor,3);
  assert.equal(second.inventory.bag[0].id,'spare');
  second.refreshEquipment();assert.equal(second.player.damage,1.2);
  saved.equipment.weapon.stats.damage=10;assert.equal(second.player.damage,1.2);
  second.unequipItem('weapon');assert.equal(second.player.damage,1);
  assert.equal(first.inventory.equipment.weapon.id,'staff');
});
