import test from 'node:test';
import assert from 'node:assert/strict';
import {SPELLS,castOriginal,stepOriginal,absorbIncoming,statusDuration,physicalRoll,movementMultiplier,blocksMovement} from '../survivors/original-spells.mjs';

function fixture(){
  const world={player:{x:0,y:0,hp:40,maxHp:100,damage:1,dx:1,dy:0,moving:true},enemies:[],projectiles:[],fields:[],effects:[],allies:[],corpses:[],events:[],nextId:100,rng:()=>.1,
    emit(type,data){this.events.push({type,...data});},
    nearest(p=this.player,range=700){return this.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<range).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||null;},
    hurt(e,amount,element){e.hp-=amount;this.hits.push({id:e.id,amount,element});},hits:[]};
  world.enemies=[{id:1,x:100,y:0,hp:1000,maxHp:1000,radius:14},{id:2,x:120,y:20,hp:1000,maxHp:1000,radius:14}];return world;
}
test('only the 24 source-described spells are offered, with original identities',()=>{
  assert.equal(Object.keys(SPELLS).length,24);
  assert.equal(SPELLS.bolt.name,'Fire Arrow');assert.equal(SPELLS.lightning.name,'Lightning');assert.equal(SPELLS.frost.name,'Blizzard');
  for(const id of ['orbit','meteor','acid','darkness','light','curse','slow'])assert.equal(SPELLS[id],undefined);
});
test('Fire Arrow, Ice Missile and Stone Missile are homing single-target projectiles; Fireball alone splashes',()=>{
  const w=fixture();for(const id of ['bolt','ice','stone','fireball'])assert.equal(castOriginal(w,id,1),true);
  assert.deepEqual(w.projectiles.map(p=>p.element),['fire','water','earth','fire']);
  for(const p of w.projectiles){assert.equal(p.homing,true);assert.equal(p.targetId,1);assert.equal(p.pierce,1);assert.equal(p.hits.size,0);}
  assert.deepEqual(w.projectiles.slice(0,3).map(p=>p.radius),[0,0,0]);assert.ok(w.projectiles[3].radius>0);
});
test('Lightning hits one foe, Prismatic Spray hits multiple foes simultaneously',()=>{
  const w=fixture();castOriginal(w,'lightning',2);assert.equal(w.hits.length,1);assert.equal(w.hits[0].id,1);
  w.hits=[];w.effects=[];castOriginal(w,'prismatic',2);assert.equal(w.hits.length,2);
  assert.ok(w.effects.every(e=>e.x===w.player.x&&e.y===w.player.y-15));
});
test('Blizzard damages continuously at the target, without invented freeze or slow',()=>{
  const w=fixture();castOriginal(w,'frost',1);assert.equal(w.fields[0].x,100);assert.equal(w.hits.length,0);
  stepOriginal(w,.05);const first=w.enemies[0].hp;stepOriginal(w,.4);assert.ok(w.enemies[0].hp<first);assert.equal(w.enemies[0].slow,undefined);assert.equal(w.enemies[0].statuses,undefined);
});
test('Poison Cloud applies lingering poison after a victim leaves its area',()=>{
  const w=fixture();castOriginal(w,'poison',1);stepOriginal(w,.05);assert.ok(w.enemies[0].statuses.poison.ttl>0);
  w.enemies[0].x=500;const hp=w.enemies[0].hp;stepOriginal(w,.45);assert.ok(w.enemies[0].hp<hp);
  for(let n=0;n<80;n++)stepOriginal(w,.05);assert.equal(w.enemies[0].statuses.poison,undefined);
});
test('element protections reduce matching damage and effect duration, not physical damage',()=>{
  const w=fixture();castOriginal(w,'protectFire',1);assert.ok(absorbIncoming(w.player,100,'fire')<100);assert.equal(absorbIncoming(w.player,100,'water'),100);assert.equal(absorbIncoming(w.player,100,'physical'),100);assert.ok(statusDuration(w.player,'fire',5)<5);assert.equal(statusDuration(w.player,'water',5),5);
  stepOriginal(w,20);assert.equal(absorbIncoming(w.player,100,'fire'),100);
});
test('Shield spends its finite pool absorbing only part of incoming damage',()=>{
  const w=fixture();castOriginal(w,'shield',1);const initial=w.player.statuses.shield.pool,damage=absorbIncoming(w.player,30);
  assert.ok(damage>0&&damage<30);assert.equal(w.player.statuses.shield.pool,initial-(30-damage));
  absorbIncoming(w.player,1000);assert.equal(w.player.statuses.shield.pool,0);assert.equal(absorbIncoming(w.player,20),20);
});
test('Haste increases movement; Bless biases physical weapon rolls only',()=>{
  const w=fixture();castOriginal(w,'hasteSpell',1);assert.ok(movementMultiplier(w.player)>1);
  assert.equal(physicalRoll(w,10,20),11);castOriginal(w,'bless',1);assert.equal(physicalRoll(w,10,20),20);assert.equal(w.player.damage,1);
});
test('Stone Curse petrifies one victim and Wall of Earth blocks movement',()=>{
  const w=fixture();castOriginal(w,'stonecurse',1);assert.ok(w.enemies[0].statuses.stonecurse.ttl>0);assert.equal(w.enemies[1].statuses,undefined);
  castOriginal(w,'earthwall',1);assert.equal(blocksMovement(w,100,0),true);assert.equal(blocksMovement(w,0,0),false);
  stepOriginal(w,20);assert.equal(blocksMovement(w,100,0),false);assert.equal(w.enemies[0].statuses.stonecurse,undefined);
});
test('Wall of Fire damages along its segment rather than its entire bounding circle',()=>{
  const w=fixture();castOriginal(w,'firewall',1);w.enemies[1].x=150;w.enemies[1].y=0;stepOriginal(w,.05);
  assert.ok(w.enemies[0].hp<1000);assert.equal(w.enemies[1].hp,1000);
});
test('Heal restores one wounded target; Drain Life cannot heal more than life actually drained',()=>{
  const w=fixture();castOriginal(w,'heal',1);assert.equal(w.player.hp,58);w.player.hp=40;w.enemies[0].hp=5;castOriginal(w,'drain',1);assert.equal(w.player.hp,45);
  w.player.hp=100;assert.equal(castOriginal(w,'heal',1),false);
});
test('Animate Dead requires and consumes a corpse, summons defend caster, and army is bounded',()=>{
  const w=fixture();assert.equal(castOriginal(w,'animate',1),false);w.corpses=[{x:80,y:20,ttl:10}];assert.equal(castOriginal(w,'animate',1),true);assert.equal(w.corpses.length,0);assert.equal(w.allies[0].type,'zombie');
  assert.equal(castOriginal(w,'summon',1),true);assert.equal(w.allies[1].type,'wolf');const ally=w.allies[1];ally.x=80;ally.y=0;stepOriginal(w,.05);assert.ok(w.hits.length>0);
  while(w.allies.length<8)castOriginal(w,'summon',1);assert.equal(castOriginal(w,'summon',1),false);
});
test('Teleport instantly relocates caster to a safe specified destination; invisibility is a timed aggro status',()=>{
  const w=fixture();castOriginal(w,'teleport',1);assert.ok(Math.hypot(w.player.x,w.player.y)>100);assert.equal(w.player.dash,undefined);assert.equal(w.effects.filter(e=>e.kind==='teleport').length,2);
  castOriginal(w,'invisibility',1);assert.ok(w.player.statuses.invisibility.ttl>0);stepOriginal(w,20);assert.equal(w.player.statuses.invisibility,undefined);
});
