import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {spellGroup} from '../survivors/spell-loadout.mjs';
const full=()=>{const w=new World({seed:321});w.skills={bolt:2,shield:3,invisibility:2,fireball:1,poison:4,ice:5,lightning:2,heal:2};w.spawnTimer=Infinity;return w;};
test('full spell builds get three existing spell upgrades and a fourth unlearned spell replacement',()=>{
  const w=full();w.pendingLevels=1;w.offer();assert.equal(w.choices.length,4);
  for(const c of w.choices.slice(0,3)){assert.equal(c.type,'skill');assert.equal(c.rank,w.skills[c.id]+1);}
  assert.equal(w.choices[3].type,'replace');assert.equal(w.skills[w.choices[3].id],undefined);
});
test('replacement requires a valid chosen slot, consumes one level and keeps slot order and other ranks',()=>{
  const w=full();w.pendingLevels=1;w.offer();const incoming=w.choices[3].id,before={...w.skills};
  const removed=w.replacementSkills(incoming)[0];w.player.statuses[removed]={ttl:4,pool:20};w.cooldowns[removed]=3;
  assert.equal(w.choose(3),false);assert.equal(w.choose(3,'unknown'),false);assert.equal(w.pendingLevels,1);assert.deepEqual(w.skills,before);
  assert.equal(w.choose(3,removed),true);assert.equal(w.pendingLevels,0);assert.equal(w.status,'playing');
  assert.equal(w.skills[incoming],1);assert.equal(w.skills[removed],undefined);assert.equal(w.cooldowns[removed],undefined);assert.equal(w.player.statuses[removed],undefined);
  assert.equal(Object.keys(w.skills)[Object.keys(before).indexOf(removed)],incoming);assert.equal(Object.keys(w.skills).length,8);assert.equal(w.skills.poison,4);
});
test('queued levels remain pending correctly after replacement and maxed spells have passive fallbacks',()=>{
  const w=full();for(const id of Object.keys(w.skills))w.skills[id]=8;w.pendingLevels=2;w.offer();
  assert.ok(w.choices.slice(0,3).every(c=>c.type==='passive'));w.choose(3,w.replacementSkills(w.choices[3].id)[0]);
  assert.equal(w.pendingLevels,1);assert.equal(w.status,'levelup');assert.equal(w.choices.length,4);
});
test('smaller builds retain the usual three upgrade choices',()=>{const w=new World();w.offer();assert.equal(w.choices.length,3);assert.ok(w.choices.every(c=>c.type!=='replace'));});
test('Shield and Invisibility autocast on the player without targets and refresh before expiry',()=>{
  const w=new World();w.skills={shield:1,invisibility:1};w.spawnTimer=Infinity;
  for(let i=0;i<600;i++){w.step(.05);assert.ok(w.player.statuses.shield?.pool>0);assert.ok(w.player.statuses.invisibility?.ttl>0);}
});
test('a depleted shield is replenished automatically without requiring a nearby enemy',()=>{
  const w=new World();w.skills={shield:1};w.spawnTimer=Infinity;w.step(.05);w.player.statuses.shield.pool=0;
  for(let i=0;i<32;i++)w.step(.05);assert.ok(w.player.statuses.shield.pool>0);
});
