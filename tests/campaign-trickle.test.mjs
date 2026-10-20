import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {wavePlan,CAMPAIGN_RULES} from '../survivors/campaign.mjs';
import {arenaFor,arenaWalkable} from '../survivors/map-arenas.mjs';
import {snapshotRun,restoreRun} from '../survivors/run-state.mjs';
const scene=(difficulty='normal')=>{const w=new World({campaign:true,seed:42,difficulty});w.campaign.waveTimer=Infinity;w.skills={};w.player.invulnerable=10000;return w;};
const ticks=(w,n)=>{for(let i=0;i<n;i++)w.step(.01);};
test('one local monster arrives per half second between swarms without becoming a leader',()=>{
 const w=scene();ticks(w,49);assert.equal(w.metrics.spawned,0);ticks(w,1);assert.equal(w.metrics.spawned,1);ticks(w,50);assert.equal(w.metrics.spawned,2);assert.equal(w.campaign.wave,0);
 for(const e of w.enemies){assert.ok(arenaFor(w).roster.includes(e.type));assert.ok(arenaWalkable(arenaFor(w),e.x,e.y,e.radius));assert.equal(e.minorBoss,undefined);assert.equal(e.boss,false);}
});
test('background pacing scales with difficulty and adds to the burst arrival estimate',()=>{
 for(const difficulty of ['easy','normal','hard']){const w=scene(difficulty),plan=wavePlan(w);assert.equal(plan.trickleInterval,CAMPAIGN_RULES.trickleInterval/w.rules.spawnRate);ticks(w,300);assert.equal(w.metrics.spawned,Math.floor((3+1e-8)/plan.trickleInterval));assert.equal(plan.totalArrivalsPerSecond,plan.arrivalsPerSecond+plan.trickleArrivalsPerSecond);}
});
test('pauses, level-up and camp stop the background clock without a resume burst',()=>{
 const w=scene();ticks(w,20);for(const status of ['paused','inventory','levelup','camp']){w.status=status;ticks(w,200);assert.equal(w.metrics.spawned,0);}w.status='playing';ticks(w,29);assert.equal(w.metrics.spawned,0);ticks(w,1);assert.equal(w.metrics.spawned,1);
});
test('saving mid-interval preserves the remaining delay and old saves initialize it safely',()=>{
 const w=scene();ticks(w,20);const copy=restoreRun(snapshotRun(w));assert.ok(copy);ticks(copy,29);assert.equal(copy.metrics.spawned,0);ticks(copy,1);assert.equal(copy.metrics.spawned,1);
 const legacy=snapshotRun(w);delete legacy.state.campaign.trickleTimer;const migrated=restoreRun(legacy);ticks(migrated,49);assert.equal(migrated.metrics.spawned,0);ticks(migrated,1);assert.equal(migrated.metrics.spawned,1);
});
test('blocked background arrivals stay queued without accumulating a spawn backlog',()=>{
 const w=scene();w.spawnPosition=()=>({x:0,y:0});w.fields=[{kind:'earthwall',x1:-30,y1:0,x2:30,y2:0,width:26,ttl:10}];ticks(w,250);assert.equal(w.metrics.spawned,0);assert.equal(w.campaign.queue.length,1);w.fields=[];ticks(w,1);assert.equal(w.metrics.spawned,1);assert.equal(w.campaign.queue.length,0);
});
test('the extraction fight keeps background pressure, while the next area resets its clock',()=>{
 const w=scene();w.campaign.phase='extract';w.campaign.remaining=20;w.campaign.exit={x:1000,y:1000,armed:true};ticks(w,50);assert.equal(w.metrics.spawned,1);w.status='camp';w.campaign.phase='camp';assert.ok(w.nextArea());assert.equal(w.campaign.trickleTimer,null);assert.equal(w.enemies.length,0);
});
