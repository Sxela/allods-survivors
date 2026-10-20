import {tacticalInput} from '../tools/balance-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {monsterCombat} from '../survivors/monster-combat.mjs';
import {inspectSpell} from '../survivors/inspection.mjs';
import {snapshotRun,restoreRun} from '../survivors/run-state.mjs';
const scene=difficulty=>{const w=new World({campaign:true,seed:42,difficulty});w.skills={};w.campaign.waveTimer=Infinity;w.campaign.trickleTimer=Infinity;return w;};
test('campaign hit grace ramps into Normal/Hard while Easy remains forgiving',()=>{
 const grace=(difficulty,index,time)=>{const w=scene(difficulty);w.campaign.index=index;w.campaign.time=time;w.damagePlayer(5);return w.player.invulnerable;};
 assert.equal(grace('easy',0,0),.8);assert.equal(grace('normal',0,0),.65);assert.equal(grace('hard',0,0),.65);
 for(const id of ['normal','hard']){assert.ok(grace(id,0,60)<grace(id,0,0));assert.ok(grace(id,0,60)>grace(id,1,0));assert.equal(grace(id,0,120),scene(id).rules.hitGrace);}
 assert.ok(grace('easy',2,120)>grace('normal',2,120));assert.ok(grace('normal',2,120)>grace('hard',2,120));
});
test('Normal and Hard pressure grows across early regions and remains bounded on long routes',()=>{
 for(const id of ['normal','hard']){const w=scene(id),sample=(index,time=0)=>{w.campaign.index=index;w.campaign.time=time;return monsterCombat(w,'wolf');};const early=sample(0),mid=sample(2),late=sample(4);assert.ok(mid.damage>early.damage);assert.ok(late.damage>mid.damage);assert.equal(sample(201).damage,late.damage);assert.ok(late.hp>early.hp);assert.equal(monsterCombat(w,'wolf',{boss:true}).hp,monsterCombat(w,'wolf').hp*16);}
 const easy=scene('easy'),first=monsterCombat(easy,'wolf').damage;easy.campaign.index=201;easy.campaign.time=10000;assert.equal(monsterCombat(easy,'wolf').damage,first);
});
test('prolonged fights strengthen new arrivals and bestiary spell damage consistently, with a cap',()=>{
 for(const id of ['normal','hard']){const w=scene(id);w.campaign.index=3;const sample=time=>{w.campaign.time=time;return monsterCombat(w,'orc_sh');};const early=sample(60),guardian=sample(120),limit=sample(210),later=sample(99999);assert.ok(guardian.damage>early.damage);assert.ok(limit.damage>guardian.damage);assert.equal(later.damage,limit.damage);assert.equal(later.hp,limit.hp);assert.ok(Math.abs(limit.spellDamage-limit.damage*.9)<1e-9);}
});
test('a broken campaign Shield waits its existing cooldown instead of rearming in 1.5 seconds',()=>{
 const w=scene('normal');w.skills={shield:2};w.step(.05);const casts=w.metrics.casts,remaining=w.cooldowns.shield;assert.ok(remaining>2);w.player.statuses.shield.pool=0;
 for(let i=0;i<40;i++)w.step(.05);assert.equal(w.metrics.casts,casts);assert.equal(w.player.statuses.shield.pool,0);assert.ok(w.cooldowns.shield>0);
 for(let i=0;i<Math.ceil(remaining/.05);i++)w.step(.05);assert.ok(w.metrics.casts>casts);assert.ok(w.player.statuses.shield.pool>0);
});
test('Heal uses its reduced sustain amount and shown cooldown on every difficulty',()=>{
 for(const id of ['easy','normal','hard']){const w=scene(id);w.skills={heal:4};w.player.hp=1;const info=inspectSpell(w,'heal');assert.equal(info.values.healing,36);assert.ok(w.cast('heal',4));assert.equal(w.player.hp,37);assert.equal(w.spellInterval('heal',4),info.interval);}
});
test('saved runs resume current difficulty pressure and remaining ward cooldown',()=>{
 const w=scene('hard');w.skills={shield:3};w.step(.05);w.player.statuses.shield.pool=0;const restored=restoreRun(snapshotRun(w));assert.ok(restored);assert.equal(restored.rules.hitGrace,w.rules.hitGrace);assert.equal(restored.cooldowns.shield,w.cooldowns.shield);for(let i=0;i<40;i++)restored.step(.05);assert.equal(restored.player.statuses.shield.pool,0);
});


test('zone-two sustain fixture: mid-rank Mage must move on Normal, including natural XP healing',()=>{
 // Controlled combat fixture, not an earned-start campaign/win-rate estimate.
 for(const seed of [42,8128,1337,2026,9001])for(const moving of [false,true]){
  const w=new World({hero:'mage',campaign:true,seed,difficulty:'normal',viewport:{width:640,height:536}});w.status='camp';w.campaign.phase='camp';w.nextArea();w.skills={bolt:3,fireball:3,heal:5,shield:5};w.baseStats.maxHp=140;w.baseStats.haste=1.2;w.baseStats.regen=.3;w.refreshEquipment();w.player.hp=w.player.maxHp;
  while(w.status==='playing'&&w.campaign.phase==='combat'&&w.time<240){w.step(.05,moving?tacticalInput(w):{});w.events.length=0;if(w.status==='levelup'){w.pendingLevels=0;w.learningQueue=[];w.milestones=[];w.choices=[];w.status='playing';}}
  if(moving){assert.equal(w.campaign.phase,'extract',`moving seed ${seed} can defeat the guardian`);assert.ok(w.player.hp>0);}else{assert.equal(w.status,'dead',`standing seed ${seed} must not sustain the fight`);assert.equal(w.player.hp<=0,true);}
 }
});
