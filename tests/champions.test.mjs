import test from 'node:test';
import assert from 'node:assert/strict';
import {World,enemyFootprint} from '../survivors/core.mjs';
import {championSchedule,spawnChampionEncounter} from '../survivors/encounters.mjs';
import {pickupGuides} from '../survivors/pickup-guides.mjs';
function arena(){const w=new World({seed:901});w.skills={};w.spawnTimer=Infinity;w.player.invulnerable=1000;return w;}
test('champion schedule starts at 35 seconds and keeps clear of major bosses and the finale',()=>{
  const marks=championSchedule();assert.equal(marks[0],35);assert.ok(marks.length>=8);
  for(const mark of marks){assert.ok(mark<570);for(const major of [120,240,360,480,585])assert.ok(Math.abs(major-mark)>=20);}
});
test('champion event spawns a leader and two escorts outside view with source attacks intact',()=>{
  const w=arena(),leader=spawnChampionEncounter(w,0);assert.equal(w.enemies.length,3);assert.equal(leader.minorBoss,true);assert.equal(leader.boss,false);
  for(const e of w.enemies){const s=enemyFootprint(e.type);assert.ok(e.x-s.halfWidth>400||e.x+s.halfWidth<-400||e.y-s.above>300||e.y+s.below<-300);}
  const ordinary=w.spawn(leader.type);assert.ok(leader.hp>ordinary.hp*3);
});
test('scheduled champion events fire once and cap simultaneous minor leaders',()=>{
  const w=arena();w.time=34.99;w.step(.025);assert.equal(w.enemies.filter(e=>e.minorBoss).length,1);
  w.step(.025);assert.equal(w.enemies.filter(e=>e.minorBoss).length,1);
  w.time=79.99;w.step(.025);assert.equal(w.enemies.filter(e=>e.minorBoss).length,2);
  w.time=169.99;w.step(.025);assert.equal(w.enemies.filter(e=>e.minorBoss).length,2);
});
test('minor boss death drops one magic-or-better item and power-up without granting final victory',()=>{
  const w=arena(),leader=spawnChampionEncounter(w);w.hurt(leader,leader.hp+1);
  assert.equal(w.powerups.length,1);assert.equal(w.lootDrops.length,1);assert.notEqual(w.lootDrops[0].item.rarity,'common');assert.equal(w.gold,6);
  assert.equal(w.bossDefeated,false);assert.equal(w.finalBossDefeated,false);assert.equal(w.events.filter(e=>e.type==='bossKilled').length,0);
  w.hurt(leader,10000);assert.equal(w.powerups.length,1);assert.equal(w.gold,6);
});
test('nearby power-up collects once and temporary buffs expire when play resumes',()=>{
  const w=arena();w.dropPowerup({x:-12,y:-10},'haste');w.step(.025);assert.equal(w.powerups.length,0);assert.equal(w.player.statuses.hasteSpell.multiplier,1.4);
  w.status='inventory';w.step(.05);assert.equal(w.player.statuses.hasteSpell.ttl,12);
  w.status='playing';for(let i=0;i<241;i++)w.step(.05);assert.equal(w.player.statuses.hasteSpell,undefined);
});
test('uncollected power-ups expire and offscreen power-ups receive guidance',()=>{
  const w=arena();w.dropPowerup({x:800,y:0},'magnet');assert.ok(pickupGuides(w,{width:800,height:600}).some(g=>g.kind==='powerup'&&g.label==='XP MAGNET'));
  w.powerups[0].ttl=.01;w.step(.025);assert.equal(w.powerups.length,0);
});
test('stronger pickup buffs survive a weaker learned spell autocast until near expiry',()=>{
  const w=arena();w.skills={shield:1,hasteSpell:1};w.step(.025);
  w.dropPowerup({x:-12,y:-10},'shield');w.dropPowerup({x:-12,y:-10},'haste');w.step(.025);
  for(let i=0;i<180;i++)w.step(.05);
  assert.equal(w.player.statuses.shield.pool,70);assert.equal(w.player.statuses.hasteSpell.multiplier,1.4);
});
