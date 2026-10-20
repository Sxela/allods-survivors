import {visibleEnemyCount} from '../survivors/monster-combat.mjs';
import {arenaDirection,arenaFor,arenaWalkable,safeArenaPoint} from '../survivors/map-arenas.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {World,random} from '../survivors/core.mjs';
import {tacticalInput,shouldDash} from './balance-policy.mjs';
import {parseArgs} from 'node:util';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=(await fs.readdir(path.join(root,'survivors'))).filter(f=>f.endsWith('.mjs')).sort();
const harnessHash=crypto.createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex');
const policyHash=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'tools/balance-policy.mjs'))).digest('hex');
const hashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,crypto.createHash('sha256').update(await fs.readFile(path.join(root,'survivors',file))).digest('hex')])));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const priority={fireball:9,frost:9,shield:9,heal:8,lightning:7,prismatic:7,poison:7,power:6,haste:6,vitality:7,regen:7};
const buildProfiles={
 healing:{...priority,heal:20,shield:18,vitality:14,regen:13,haste:12,fireball:11,frost:10,bolt:10,power:9,keep:2},
 balanced:{...priority,bolt:12,fireball:12,frost:11,heal:10,shield:10,haste:9,power:9,vitality:8,regen:7,prismatic:8,keep:2},
 damage:{...priority,fireball:18,frost:17,prismatic:16,lightning:16,bolt:15,power:14,haste:13,heal:4,shield:5,vitality:3,regen:2,keep:2},
};
function priorities(w){return buildProfiles[args.build]||(args.build==='starter'?{...priority,[{mage:'bolt',warrior:'shield',ranger:'poison'}[w.hero]]:10}:priority);}
function pick(w,policyRng){const priority=priorities(w);let best=args.build==='random'?Math.floor(policyRng()*w.choices.length):0;if(args.build!=='random')for(let i=1;i<w.choices.length;i++)if((priority[w.choices[i].id]||1)>(priority[w.choices[best].id]||1))best=i;const c=w.choices[best];return w.choose(best,c.type==='replace'?w.replacementSkills(c.id).at(-1):null);}
function buildState(w){const p=w.player,pool=w.castingSkills(),spell=id=>{const entry=pool.find(s=>s.id===id);return entry?{learned:w.skills[id]||0,effective:+w.effectiveRank(id,entry.rank).toFixed(2),interval:+w.spellInterval(id,entry.rank).toFixed(2),source:entry.source}:null;},heal=spell('heal'),shield=spell('shield');return {maxHp:+p.maxHp.toFixed(1),armor:+p.armor.toFixed(1),regen:+p.regen.toFixed(2),healRank:heal?.effective||0,healInterval:heal?.interval??null,shieldRank:shield?.effective||0,heal,shield,haste:+p.haste.toFixed(2),damage:+p.damage.toFixed(2),spellDamage:+p.spellDamage.toFixed(2)};}
const {values:args}=parseArgs({options:{build:{type:'string',default:'legacy'},seeds:{type:'string',default:'8128,42,1337,2026,9001'},heroes:{type:'string',default:'mage,warrior,ranger'},difficulties:{type:'string',default:'easy,normal,hard'},policies:{type:'string',default:'collect,stationary'},areas:{type:'string',default:'12'},out:{type:'string',default:'.build/balance/campaign.json'},'max-wall-ms':{type:'string',default:'30000'},'max-seconds':{type:'string'}}});
const seeds=args.seeds.split(',').map(Number),heroes=args.heroes.split(','),difficulties=args.difficulties.split(','),policies=args.policies.split(',');
const areaCount=args.areas==='all'?Infinity:Number(args.areas),wallBudget=Number(args['max-wall-ms']),horizon=args['max-seconds']===undefined?null:Number(args['max-seconds']);
if(!['legacy','starter','healing','balanced','damage','random'].includes(args.build)||!seeds.length||seeds.some(s=>!Number.isInteger(s)||s<0||s>0xffffffff)||heroes.some(h=>!['mage','warrior','ranger'].includes(h))||difficulties.some(d=>!['easy','normal','hard'].includes(d))||policies.some(p=>!['collect','stationary','tactical','camping','settled','settled2','skilled'].includes(p))||!(areaCount>0)||!Number.isFinite(wallBudget)||!(wallBudget>0)||(horizon!==null&&(!Number.isFinite(horizon)||horizon<=0)))throw new Error('Invalid balance arguments');
const rows=[];
for(const seed of seeds)for(const hero of heroes)for(const difficulty of difficulties)for(const policy of policies){
 const w=new World({hero,difficulty,seed,campaign:true,areaCount,viewport:{width:640,height:536}}),started=performance.now(),policyRng=random(seed^0xa65e5921);let purchases=0,choices=0,transitions=0,steps=0,totalCost=0,dashes=0;
 const densitySamples=[],checkpoints=[],regions=[],recentHits=[],incomingByElement={};let lastDensity=-1,lastCheckpoint=-30,peakAlive=0,stalledSeconds=0,areaStart=0,areaMetrics={...w.metrics},areaGold=0,areaSpent=0,boss=null,movingSeconds=0,stationarySeconds=0,areaMoving=0,areaStationary=0;
 const healingBySpell={heal:0,drain:0},originalCast=w.cast.bind(w);w.cast=(id,...args)=>{const before=w.metrics.healing,result=originalCast(id,...args);if(id in healingBySpell)healingBySpell[id]+=w.metrics.healing-before;return result;};
 const originalDamage=w.damagePlayer.bind(w);w.damagePlayer=(amount,element='physical')=>{const dealt=originalDamage(amount,element);if(dealt>0){incomingByElement[element]=(incomingByElement[element]||0)+dealt;recentHits.push({time:+w.time.toFixed(2),element,damage:+dealt.toFixed(2),nearby:w.enemies.filter(e=>dist(e,w.player)<120).slice(0,5).map(e=>e.type)});if(recentHits.length>10)recentHits.shift();}return dealt;};
 const originalHurt=w.hurt.bind(w);w.hurt=(e,...args)=>{if(e.areaBoss&&!boss)boss={type:e.type,maxHp:e.maxHp,spawnedAt:e.spawnedAt};const result=originalHurt(e,...args);if(e.areaBoss&&e.hp<=0&&boss&&!boss.killedAt)boss.killedAt=w.time;return result;};
 function finishRegion(outcome){regions.push({area:w.campaign.index+1,mapId:w.campaign.mapId,outcome,seconds:+(w.time-areaStart).toFixed(1),level:w.player.level,health:+w.player.hp.toFixed(1),gold:w.gold,visibleMean:+(densitySamples.filter(s=>s.area===w.campaign.index+1).reduce((n,s)=>n+s.visible,0)/Math.max(1,densitySamples.filter(s=>s.area===w.campaign.index+1).length)).toFixed(1),arrivalsPerSecond:+((w.metrics.spawned-areaMetrics.spawned)/Math.max(.05,w.time-areaStart)).toFixed(2),earnedGold:w.gold-areaGold+totalCost-areaSpent,spent:totalCost-areaSpent,damageTaken:+(w.metrics.damageTaken-areaMetrics.damageTaken).toFixed(1),healing:+(w.metrics.healing-areaMetrics.healing).toFixed(1),build:buildState(w),movingSeconds:+(movingSeconds-areaMoving).toFixed(1),stationarySeconds:+(stationarySeconds-areaStationary).toFixed(1),shieldAbsorbed:+(w.metrics.shieldAbsorbed-areaMetrics.shieldAbsorbed).toFixed(1),boss:boss?{type:boss.type,maxHp:boss.maxHp,ttk:boss.killedAt?+(boss.killedAt-boss.spawnedAt).toFixed(1):null,remainingHp:+(w.enemies.find(e=>e.areaBoss)?.hp||0).toFixed(1)}:null});}

 while(!['dead','won'].includes(w.status)&&w.time<(horizon??w.campaign.route.length*200)&&steps<Math.ceil(w.campaign.route.length*200/.05)+1){
   if(performance.now()-started>wallBudget){w.probeAbort='wall-clock budget';break;}
   if(w.status==='levelup'){if(!pick(w,policyRng)){w.probeAbort='blocked reward';break;}choices++;continue;}
   if(w.status==='camp'){
     w.prepareCamp();const priority=priorities(w);const offers=[...w.campaign.shopOffers].sort((a,b)=>args.build==='random'?0:(priority[b.id]||1)-(priority[a.id]||1));
     const offer=offers.find(c=>c.price<=w.gold);if(offer&&w.buyCamp(offer.offerId)){purchases++;totalCost+=offer.price;w.resolveCampMilestones();continue;}
     finishRegion('extracted');w.nextArea();transitions++;areaStart=w.time;areaMetrics={...w.metrics};areaGold=w.gold;areaSpent=totalCost;areaMoving=movingSeconds;areaStationary=stationarySeconds;boss=null;continue;
   }
   let input={};
   if(policy==='collect'||policy==='camping'&&(!!w.campaign.exit||w.campaign.time%24<5)||(policy==='settled'||policy==='settled2')&&(w.campaign.index<(policy==='settled2'?1:2)||!!w.campaign.exit)){
     let target=w.campaign.exit;if(!target&&hero==='warrior')target=w.enemies.find(e=>e.areaBoss&&e.hp>0)||w.enemies.filter(e=>e.hp>0).sort((a,b)=>dist(a,w.player)-dist(b,w.player))[0];
     if(!target){const pickups=[...w.lootDrops,...w.gems];target=pickups.sort((a,b)=>dist(a,w.player)-dist(b,w.player))[0];}
     if(target&&arenaFor(w)){const goal=safeArenaPoint(w,target);target=arenaDirection(w,w.player,goal)||goal;}let x=target?target.x-w.player.x:Math.cos(w.time*.35),y=target?target.y-w.player.y:Math.sin(w.time*.35);const length=Math.hypot(x,y)||1;x/=length;y/=length;
     // Simple local avoidance, not a human win-rate model or full navigation bot.
     if(!w.campaign.exit)for(const e of w.enemies)if(e.hp>0){const d=dist(e,w.player);const avoid=hero==='warrior'?28:90;if(d<avoid){x+=(w.player.x-e.x)/Math.max(1,d)*(avoid-d)/40;y+=(w.player.y-e.y)/Math.max(1,d)*(avoid-d)/40;}}
     input={x,y};
   }
   if(policy==='tactical'||policy==='skilled')input=tacticalInput(w,policy==='skilled'?{seekGuardian:true,extractPriority:true}:{});
   if(policy==='skilled'&&shouldDash(w)){w.dash();if(w.player.dashCooldown>0)dashes++;}
   if(w.campaign.exit&&dist(w.campaign.exit,w.player)<28)input={};
   const before={x:w.player.x,y:w.player.y};const t=performance.now();w.step(.05,input);w.probeMs=(w.probeMs||0)+performance.now()-t;steps++;if(dist(before,w.player)>.1)movingSeconds+=.05;else stationarySeconds+=.05;
   if((input.x||input.y)&&dist(before,w.player)<.1)stalledSeconds+=.05;
   peakAlive=Math.max(peakAlive,w.enemies.length);if(!boss){const e=w.enemies.find(e=>e.areaBoss);if(e)boss={type:e.type,maxHp:e.maxHp,spawnedAt:e.spawnedAt};}
   if(w.time-lastDensity>=1){densitySamples.push({time:+w.time.toFixed(1),area:w.campaign.index+1,visible:visibleEnemyCount(w)});lastDensity=w.time;}
   if(w.time-lastCheckpoint>=30){checkpoints.push({time:+w.time.toFixed(1),area:w.campaign.index+1,level:w.player.level,hp:+w.player.hp.toFixed(1),gold:w.gold,visible:visibleEnemyCount(w),alive:w.enemies.length,damageTaken:+w.metrics.damageTaken.toFixed(1),healing:+w.metrics.healing.toFixed(1),shieldAbsorbed:+w.metrics.shieldAbsorbed.toFixed(1),build:buildState(w)});lastCheckpoint=w.time;}
   w.events.length=0;
 }
 if(w.status!=='won')finishRegion(w.probeAbort||w.status);
 rows.push({densitySamples,route:w.campaign.route,regions,checkpoints,incomingByElement,recentHits,peakAlive,build:buildState(w),healingBySpell,dashes,movingSeconds:+movingSeconds.toFixed(1),stationarySeconds:+stationarySeconds.toFixed(1),stalledSeconds:+stalledSeconds.toFixed(1),deathCause:w.status==='dead'?(w.campaign.remaining===0?'missed extraction':'health'):null,hero,difficulty,policy,seed,rejectedChoices:w.probeAbort?w.choices:undefined,outcome:w.probeAbort||(['dead','won'].includes(w.status)?w.status:'horizon'),activeSeconds:+w.time.toFixed(1),area:w.campaign.index+1,level:w.player.level,kills:w.kills,gold:w.gold,purchases,spent:totalCost,choices,transitions,health:+w.player.hp.toFixed(1),skills:w.skills,metrics:w.metrics,alive:w.enemies.length,queued:w.campaign.queue.length,simulationMs:+(w.probeMs||0).toFixed(1)});
 console.log(`${rows.length}/${seeds.length*heroes.length*difficulties.length*policies.length} seed=${seed} ${hero}/${difficulty}/${policy}: ${rows.at(-1).outcome} area=${w.campaign.index+1} time=${w.time.toFixed(1)}`);
}
const report={hashes,harnessHash,policyHash,configuration:{build:args.build,seeds,heroes,difficulties,policies,areaCount:Number.isFinite(areaCount)?areaCount:'all',wallBudget,horizon},scope:'Earned starts, paired seeds across configured classes/difficulties, collection/avoidance and stationary exploit probes. No free gear, currency, healing, mining, rerolls, equipment-shop purchases or extraction teleport. Uses native floor flow fields for collection/exit travel. Stationary bots still choose upgrades and buy camp offers. Tactical policy adds local contact/projectile/marked-area avoidance and fights near melee reach. Camping collects for five seconds out of each 24-second cycle and navigates exits; settled collects normally in regions 1-2 then stays still in combat and navigates exits. Build profiles include healing-first, balanced, damage-first and independently seeded random choices. Skilled also seeks guardians and uses the real dash cooldown; other policies do not dash. No claim of human win rate. Horizon/CPU abort is not victory. Timings measure simulation CPU, not rendering performance.',rows};
const out=path.resolve(root,args.out);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));
console.table(rows.map(({hero,difficulty,policy,seed,outcome,activeSeconds,area,level,kills,purchases})=>({hero,difficulty,policy,seed,outcome,activeSeconds,area,level,kills,purchases})));
console.log(`Report: ${path.relative(root,out)}`);
