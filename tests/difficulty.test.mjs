import test from 'node:test';
import assert from 'node:assert/strict';
import {World,DIFFICULTIES} from '../survivors/core.mjs';
test('Normal is the default and invalid difficulty settings fall back safely',()=>{
  assert.deepEqual(Object.keys(DIFFICULTIES),['easy','normal','hard']);
  for(const difficulty of [undefined,'bad','__proto__',null])assert.equal(new World({difficulty}).difficulty,'normal');
});
test('difficulty scales actual regular and boss health, damage and speed',()=>{
  for(const boss of [false,true]){
    const enemies=Object.keys(DIFFICULTIES).map(difficulty=>new World({seed:42,difficulty}).spawn('wolf',boss));
    for(const key of ['hp','damage','speed']){assert.ok(enemies[0][key]<enemies[1][key]);assert.ok(enemies[1][key]<enemies[2][key]);}
    assert.equal(enemies[0].hp,enemies[1].hp*.5);assert.equal(enemies[2].hp,enemies[1].hp*1.2);
  }
});
test('three settings produce different opening waves and reinforcement rates',()=>{
  const worlds=Object.keys(DIFFICULTIES).map(difficulty=>{const w=new World({seed:42,difficulty});w.skills={};w.player.invulnerable=100;w.step(.025);return w;});
  assert.deepEqual(worlds.map(w=>w.enemies.length),[6,8,10]);
  assert.ok(worlds[0].spawnTimer>worlds[1].spawnTimer);assert.ok(worlds[1].spawnTimer>worlds[2].spawnTimer);
});
test('difficulty reaches actual hostile projectile damage',()=>{
  const damages=Object.keys(DIFFICULTIES).map(difficulty=>{const w=new World({seed:42,difficulty});w.skills={};w.spawnTimer=Infinity;const e=w.spawn('orc');Object.assign(e,{x:160,y:0,speed:0,attackCooldown:0});w.step(.025);return w.enemyProjectiles[0].damage;});
  assert.ok(damages[0]<damages[1]&&damages[1]<damages[2]);
});
test('Hard boosts ground gold, boss gold and run bonuses once and stacks with Gold Find',()=>{
  const w=new World({difficulty:'hard'});assert.equal(w.goldAmount(10),15);
  w.player.goldFind=1;assert.equal(w.goldAmount(10),30);
  const boss=w.spawn('troll',true);w.hurt(boss,boss.hp+1);assert.equal(w.gold,45);
  w.kills=120;w.time=300;w.status='won';assert.equal(w.runReward(),45+105);
  const normal=new World();normal.gold=45;normal.kills=120;normal.time=300;normal.status='won';assert.equal(normal.runReward(),115);
});
test('Hard loot has stronger matching rolls and improved quality odds',()=>{
  const drop=(difficulty,roll)=>{const w=new World({difficulty});w.rng=()=>roll;return w.dropLoot({x:0,y:0,boss:false});};
  const normal=drop('normal',.1),hard=drop('hard',.1);
  assert.equal(normal.rarity,'common');assert.equal(hard.rarity,'common');assert.ok(Math.abs(hard.stats.spellDamage-normal.stats.spellDamage*1.25)<.001);
  assert.equal(drop('normal',.5).rarity,'common');assert.equal(drop('hard',.5).rarity,'magic');
  assert.equal(drop('normal',.85).rarity,'magic');assert.equal(drop('hard',.85).rarity,'rare');
});
