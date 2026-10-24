import test from 'node:test';
import assert from 'node:assert/strict';
import {World,SKILLS} from '../survivors/core.mjs';
import {MONSTERS,projectileVfxById} from '../survivors/monsters.mjs';
function arena(){const w=new World({seed:42});w.skills={};w.spawnTimer=Infinity;w.player.invulnerable=100;return w;}
function enemy(w,type='wolf',x=100,y=0){const e=w.spawn(type);Object.assign(e,{x,y,hp:1000,maxHp:1000,speed:0,attackCooldown:99});return e;}
function advance(w,seconds){for(let i=0;i<seconds/.025;i++)w.step(.025);}
test('Fire Arrow follows a turning target, does not pierce, and cannot harm a neighboring enemy',()=>{
  const w=arena(),target=enemy(w),neighbor=enemy(w,'wolf',100,20);w.cast('bolt',1);target.y=60;
  w.step(.025);assert.ok(w.projectiles[0].vy>0);advance(w,.5);
  assert.equal(target.hp,972);assert.equal(neighbor.hp,1000);assert.equal(w.projectiles.length,0);
});
test('Fireball explodes at its homing target and damages neighbors only on impact',()=>{
  const w=arena(),target=enemy(w,'wolf',160),near=enemy(w,'wolf',160,40),far=enemy(w,'wolf',350,0);
  w.cast('fireball',1);assert.equal(near.hp,1000);advance(w,.7);
  assert.equal(target.hp,958);assert.equal(near.hp,958);assert.equal(far.hp,1000);
});
test('Shield and elemental resistance combine once in the live damage path',()=>{
  const w=arena();w.player.invulnerable=0;w.cast('protectFire',1);w.cast('shield',1);
  const before=w.player.hp,expected=20*(1-.39)*(1-.55);
  w.damagePlayer(20,'fire');assert.ok(Math.abs(before-w.player.hp-expected)<1e-8);
});
test('Petrification stops enemy movement and attacks until the status expires',()=>{
  const w=arena(),e=enemy(w,'wolf',25);w.player.invulnerable=0;e.speed=100;e.attackCooldown=0;
  w.cast('stonecurse',1);const before={x:e.x,hp:w.player.hp};w.step(.025);
  assert.equal(e.x,before.x);assert.equal(w.player.hp,before.hp);
});
test('Invisibility makes distant enemies seek last seen position rather than the hidden player',()=>{
  const w=arena(),e=enemy(w,'wolf',300);e.speed=60;w.cast('invisibility',1);w.player.y=200;
  w.step(.025);assert.equal(e.dy,0);assert.ok(e.dx<0);
});
test('ranged enemies approach the last seen position while invisibility prevents target acquisition',()=>{
  for(const type of ['goblin_s','orc_sh']){
    const w=arena(),e=enemy(w,type,180);e.speed=60;e.attackCooldown=0;
    w.cast('invisibility',1);w.player.y=200;w.step(.025);
    assert.ok(e.x<180,`${type} must search instead of waiting forever at firing range`);
    assert.equal(e.dy,0);assert.equal(w.enemyProjectiles.length,0);assert.ok(!e.casting);
  }
});

test('Original projectile associations drive enemy attacks without invented boss spreads',()=>{
  for(const type of ['orc','goblin_s','skeleton_a1','dragon']){
    const w=arena(),e=enemy(w,type,180);e.attackCooldown=0;w.step(.025);if(type==='dragon')advance(w,.525);
    assert.equal(w.enemyProjectiles.length,1);assert.equal(w.enemyProjectiles[0].vfx,projectileVfxById[MONSTERS[type].projectileId]);
  }
  const w=arena(),boss=enemy(w,'troll',25);boss.boss=true;boss.attackCooldown=0;w.step(.025);assert.equal(w.enemyProjectiles.length,0);
});
test('Non-hostile artwork sets are ambient actors and cannot be targeted for loot',()=>{
  const w=arena();for(const type of ['squirrel','sheep','druid','orc_good','troll_good'])w.spawn(type);
  assert.equal(w.enemies.length,0);assert.equal(w.neutrals.length,5);assert.equal(w.nearest(),null);
});
test('Defeated units create a corpse, Animate Dead consumes it, and raised allies defend the caster',()=>{
  const w=arena(),e=enemy(w,'wolf',45);w.hurt(e,2000);assert.equal(w.corpses.length,1);
  assert.equal(w.cast('animate',1),true);assert.equal(w.corpses.length,0);assert.equal(w.allies.length,1);
  const foe=enemy(w,'wolf',60);advance(w,1);assert.ok(foe.hp<1000);
});
test('Each biome adds original hostile types, with no adaptation spells in upgrade choices',()=>{
  const sets=[];
  for(const stage of [0,1,2,3,4]){const w=arena();w.time=stage*120+10;w.spawnTimer=0;w.openingWave=true;w.step(.025);sets.push(w.enemies.filter(e=>!e.boss).map(e=>e.type));assert.ok(w.enemies.every(e=>MONSTERS[e.type]));}
  assert.notDeepEqual(sets[0],sets[4]);assert.equal(SKILLS.orbit,undefined);assert.equal(SKILLS.meteor,undefined);
});
