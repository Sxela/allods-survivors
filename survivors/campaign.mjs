import {MAP_ARENAS,arenaFor,selectMapRoute,safeArenaPoint,cellPosition,arenaWalkable} from './map-arenas.mjs';
import {MONSTERS} from './monsters.mjs';
import {BIOMES} from './biomes.mjs';
import {blocksMovement} from './original-spells.mjs';

// Native map/crop creature identities; wave counts, promotion and timing are survival adaptations.
export const ROUTE=MAP_ARENAS;
export const CAMPAIGN_RULES=Object.freeze({bossAt:120,evacuation:30,waveInterval:24,trickleInterval:.5,spawnBudget:4,miningSeconds:3,exitDistance:128,exitOffset:160,exitArmSeconds:1,exitHoldSeconds:1,exitRadius:32});
// Burst waves plus a steady local-roster trickle between them. Both use the
// same bounded creation queue; no alive-population cap silently discards arrivals.
export function wavePlan(world,wave=world.campaign.wave+1){
 const a=world.campaign,routeProgress=a.index/Math.max(1,a.route.length-1),growth=Math.min(25,Math.floor(Math.max(0,wave-1)/2)*5),routeGrowth=Math.round(20*routeProgress),min=Math.round((25+routeGrowth+growth)*world.rules.density),max=Math.round((40+routeGrowth+growth)*world.rules.density),interval=CAMPAIGN_RULES.waveInterval/(world.rules.spawnRate*(a.phase==='extract'?1.5:1));
 const trickleInterval=CAMPAIGN_RULES.trickleInterval/world.rules.spawnRate;
 return {min,max,interval,arrivalsPerSecond:(min+max)/2/interval,trickleInterval,trickleArrivalsPerSecond:1/trickleInterval,totalArrivalsPerSecond:(min+max)/2/interval+1/trickleInterval};
}
export function createArea(index=0,route=[]){return {index,route,mapId:route[index],time:0,phase:'combat',wave:0,waveTimer:0,trickleTimer:null,queue:[],bossSpawned:false,exit:null,remaining:null,shopOffers:[],rerolls:0,shopSerial:0,deposits:[]};}
export function areaName(world){return arenaFor(world)?.name||BIOMES[Math.min(4,world.campaign.index)].name;}
export function terrainTime(world){return world.campaign?(world.campaign.index/Math.max(1,world.campaign.route.length-1))*480+Math.min(119,world.campaign.time):world.time;}
export function placeDeposits(world){
  world.campaign.deposits=[-1,1].map((direction,i)=>({id:`ore-${world.campaign.index}-${i}`,...safeArenaPoint(world,{x:world.player.x+direction*190,y:world.player.y+95}),remaining:2,progress:0}));
}
// Choose connected native floor away from both combat positions, including
// when a flying guardian dies over water or against the edge of the crop.
export function exitPosition(world,enemy){
 const a=arenaFor(world),p=world.player;let best=null,score=Infinity;
 if(a)for(let i=0;i<a.floor.length;i++){
  if(!a.floor[i])continue;const q=cellPosition(a,i);if(!arenaWalkable(a,q.x,q.y,12))continue;
  const playerDistance=Math.hypot(q.x-p.x,q.y-p.y),bossDistance=Math.hypot(q.x-enemy.x,q.y-enemy.y);
  if(Math.min(playerDistance,bossDistance)<CAMPAIGN_RULES.exitDistance)continue;
  const value=Math.abs(bossDistance-CAMPAIGN_RULES.exitOffset)+Math.max(0,playerDistance-240)*.5;
  if(value<score){best=q;score=value;}
 }
 return best||safeArenaPoint(world,{x:enemy.x+CAMPAIGN_RULES.exitOffset,y:enemy.y});
}
export function openExit(world,enemy){
  const a=world.campaign;if(!a||a.phase!=='combat'||!enemy.areaBoss)return;
  // The arena floor is connected; remove temporary walls so the reward and exit remain reachable.
  world.fields=world.fields.filter(f=>f.kind!=='earthwall');
  a.phase='extract';a.remaining=CAMPAIGN_RULES.evacuation;
  a.exit={...exitPosition(world,enemy),armed:false,hold:0};world.emit('exitOpened',{seconds:a.remaining});
}
export function stepCampaign(world,dt){
  const a=world.campaign,p=world.player,route=arenaFor(world);a.time+=dt;
  if(a.phase==='extract'){
    a.remaining=Math.max(0,a.remaining-dt);
    if(a.remaining<=0){world.status='dead';p.hp=0;world.emit('extractionMissed');world.emit('end');return;}
    const d=Math.hypot(p.x-a.exit.x,p.y-a.exit.y);
    // First let the portal activate; then require deliberate stationary entry.
    a.exit.armed=a.remaining<=CAMPAIGN_RULES.evacuation-CAMPAIGN_RULES.exitArmSeconds+1e-9;
    a.exit.hold=a.exit.armed&&d<CAMPAIGN_RULES.exitRadius&&!p.moving?(a.exit.hold||0)+dt:0;
    if(a.exit.hold>=CAMPAIGN_RULES.exitHoldSeconds-1e-9){a.phase='camp';world.status='camp';world.emit('extracted');return;}
  }
  const trickleInterval=CAMPAIGN_RULES.trickleInterval/world.rules.spawnRate;
  // Older saves acquire a fresh interval; paused/camp time never accrues spawns.
  a.trickleTimer??=trickleInterval;
  a.waveTimer-=dt;
  if(a.waveTimer<=0){
    a.wave++;const plan=wavePlan(world,a.wave);a.waveTimer=plan.interval;a.trickleTimer=trickleInterval;
    const count=plan.min+Math.floor(world.rng()*(plan.max-plan.min+1));
    for(let i=0;i<count;i++)a.queue.push({type:route.roster[Math.floor(world.rng()*route.roster.length)],leader:i===0&&a.wave%3===0});
  }
  else if(!a.queue.length){
    a.trickleTimer-=dt;
    if(a.trickleTimer<=1e-9){a.trickleTimer+=trickleInterval;a.queue.push({type:route.roster[Math.floor(world.rng()*route.roster.length)],leader:false});}
  }
  // Queue every requested spawn; budget creation work instead of silently dropping a wave.
  for(let i=0;i<CAMPAIGN_RULES.spawnBudget&&a.queue.length;i++){
    const request=a.queue[0],point=world.spawnPosition(request.type);
    if(blocksMovement(world,point.x,point.y,14))break;
    a.queue.shift();const e=world.spawn(request.type,false,point);
    if(request.leader){e.elite=true;e.minorBoss=true;e.name=`Captain ${e.name}`;e.hp*=3;e.maxHp=e.hp;e.damage*=1.15;world.emit('champion',{name:e.name});}
  }
  if(a.time>=CAMPAIGN_RULES.bossAt&&!a.bossSpawned){a.bossSpawned=true;const bossType=a.index===a.route.length-1?'mainnecro':[...route.roster].sort((x,y)=>(MONSTERS[y].tier||0)-(MONSTERS[x].tier||0))[0];const boss=world.spawn(bossType,true);boss.areaBoss=true;boss.finalBoss=a.index===a.route.length-1;}
  for(const ore of a.deposits){
    if(!ore.remaining)continue;
    const mining=!p.moving&&Math.hypot(ore.x-p.x,ore.y-p.y)<44;
    ore.progress=mining?ore.progress+dt:0;
    if(ore.progress>=CAMPAIGN_RULES.miningSeconds){ore.progress=0;ore.remaining--;const gold=world.goldAmount(24+Math.round(36*Math.min(1,a.index/Math.max(1,a.route.length-1))));world.gold+=gold;world.metrics.oreGold+=gold;world.emit('mined',{gold});}
  }
}
export function advanceArea(world){
  if(!world.campaign||world.status!=='camp')return false;
  if(world.campaign.index===world.campaign.route.length-1){world.status='won';world.emit('end');return true;}
  const index=world.campaign.index+1;world.campaign=createArea(index,world.campaign.route);world.player.x=0;world.player.y=0;for(const ally of world.allies)Object.assign(ally,safeArenaPoint(world,{x:35,y:25}));placeDeposits(world);
  for(const key of ['enemies','projectiles','enemyProjectiles','enemyFields','gems','effects','fields','powerups','corpses','lootDrops','neutrals'])world[key]=[];
  world.status='playing';world.emit('areaEntered',{name:areaName(world)});return true;
}
