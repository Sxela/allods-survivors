import test from 'node:test';
import {shouldDash} from '../tools/balance-policy.mjs';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
test('balance CLI replays paired seeds, distinguishes horizons and records source/diagnostic evidence',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'survivors-balance-'));
 try{const run=async name=>{const out=path.join(temp,name);execFileSync(process.execPath,['tools/balance-campaign.mjs','--seeds=42,1337','--heroes=mage','--difficulties=normal','--policies=tactical','--build=starter','--areas=all','--max-seconds=1','--out='+out],{cwd:root,stdio:'pipe',timeout:30000});return JSON.parse(await readFile(out,'utf8'));};
  const a=await run('a.json'),b=await run('b.json');assert.equal(a.rows.length,2);assert.equal(a.configuration.areaCount,'all');assert.equal(a.configuration.build,'starter');assert.match(a.harnessHash,/^[a-f0-9]{64}$/);assert.match(a.policyHash,/^[a-f0-9]{64}$/);assert.ok(a.hashes['monster-data.mjs']);
  for(let i=0;i<a.rows.length;i++){const {simulationMs:timingA,...rowA}=a.rows[i],{simulationMs:timingB,...rowB}=b.rows[i];assert.deepEqual(rowA,rowB);assert.equal(rowA.outcome,'horizon');assert.equal(rowA.route.length,202);assert.equal(rowA.regions.length,1);assert.equal(rowA.regions[0].outcome,'playing');assert.equal(rowA.purchases,0);assert.equal(rowA.deathCause,null);assert.ok(rowA.checkpoints.length);}
  assert.deepEqual(a.rows.map(r=>r.seed),[42,1337]);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('balance CLI rejects invalid scenarios rather than silently testing fallback classes or policies',()=>{
 for(const arg of ['--build=unknown','--heroes=missing','--policies=unknown','--seeds=NaN','--max-seconds=-1','--areas=0']){const result=spawnSync(process.execPath,['tools/balance-campaign.mjs',arg],{cwd:root,encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/Invalid balance arguments/);}
});

test('earned sustain probes support build planning and mostly-standing policies with recovery diagnostics',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'survivors-sustain-'));
 try{for(const [build,policy] of [['healing','camping'],['balanced','settled'],['damage','tactical'],['random','tactical'],['balanced','skilled']]){const out=path.join(temp,build+'.json');execFileSync(process.execPath,['tools/balance-campaign.mjs','--heroes=mage','--seeds=42','--difficulties=normal','--build='+build,'--policies='+policy,'--max-seconds=1','--out='+out],{cwd:root,stdio:'pipe',timeout:30000});const report=JSON.parse(await readFile(out,'utf8')),row=report.rows[0];assert.equal(report.configuration.build,build);assert.equal(row.policy,policy);assert.equal(row.outcome,'horizon');assert.equal(row.build.maxHp,100);assert.equal(row.build.heal,null);assert.ok(row.movingSeconds+row.stationarySeconds>=1);assert.deepEqual(row.healingBySpell,{heal:0,drain:0});}}
 finally{await rm(temp,{recursive:true,force:true});}
});


test('skilled probe requests only ready dashes for visible contact danger or extraction',()=>{
 const w={status:'playing',player:{x:0,y:0,dashCooldown:0},campaign:{exit:null},enemies:[],enemyProjectiles:[],effects:[]};
 assert.equal(shouldDash(w),false);
 w.enemies.push({x:20,y:0,radius:12,hp:10});assert.equal(shouldDash(w),true);
 w.player.dashCooldown=.1;assert.equal(shouldDash(w),false);
 w.player.dashCooldown=0;w.status='camp';assert.equal(shouldDash(w),false);
 w.status='playing';w.enemies[0].arrival=true;assert.equal(shouldDash(w),false);
 w.campaign.exit={x:80,y:0};assert.equal(shouldDash(w),true);
 w.campaign.exit={x:500,y:0};assert.equal(shouldDash(w),false);
});
