import {arenaById,arenaFor,safeArenaPoint,selectMapRoute} from './map-arenas.mjs';
import {World,CLASSES,DIFFICULTIES} from './core.mjs';
import {Inventory} from './loot.mjs';
import {SPELLS} from './original-spells.mjs';
import {repriceCamp} from './knowledge.mjs';
import {canLearn} from './spell-loadout.mjs';
// Explicit state boundary: no functions, source metadata, platform paths or renderer state.
const FIELDS=['hero','seed','difficulty','duration','time','status','player','baseStats','classBases','statSources','skills','cooldowns','cooldownDurations','cooldownWaiting','individualPurchases','localBonuses','behaviors','milestones','learningQueue','rewardKind','campReward','pendingLevels','choices','campaign','metrics','enemies','projectiles','enemyProjectiles','gems','effects','fields','powerups','championMarks','allies','neutrals','ambientStages','corpses','basicCooldown','kills','nextId','spawnTimer','bosses','gold','bossDefeated','finalBossDefeated','openingWave','lootDrops','nextLootId','enemyFields'];
const encode=value=>JSON.stringify(value,(_,v)=>v instanceof Set?{$set:[...v]}:v===Infinity?{$infinity:true}:v);
function decode(text){return JSON.parse(text,(key,v)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('Invalid save key');return v&&typeof v==='object'&&Object.keys(v).length===1?(Array.isArray(v.$set)?new Set(v.$set):v.$infinity===true?Infinity:v):v;});}
export function snapshotRun(world){
  if(!world?.campaign||['dead','won'].includes(world.status))return null;
  return JSON.parse(encode({version:1,rng:world.rng.state(),viewport:world.viewport,inventory:world.inventory.snapshot(),state:Object.fromEntries(FIELDS.filter(key=>Object.hasOwn(world,key)).map(key=>[key,world[key]]))}));
}
export function restoreRun(raw,viewport){
  try{
    const text=JSON.stringify(raw);if(!text||text.length>4_000_000)return null;
    const save=decode(text),s=save.state;
    if(save.version!==1||!s||!Object.hasOwn(CLASSES,s.hero)||!Object.hasOwn(DIFFICULTIES,s.difficulty)||!Number.isSafeInteger(s.seed)||!Number.isInteger(save.rng)||!Number.isFinite(s.time)||s.time<0||s.time>86400)return null;
    if(!s.campaign||!Number.isInteger(s.campaign.index)||s.campaign.index<0||s.campaign.index>=Math.max(12,s.campaign.route?.length||0)||!['combat','extract','camp'].includes(s.campaign.phase)||!['playing','paused','inventory','camp','levelup'].includes(s.status))return null;
    if(!s.player||!['hp','maxHp','x','y','level'].every(key=>Number.isFinite(s.player[key]))||s.player.hp<=0||s.player.hp>s.player.maxHp)return null;
    if(!Number.isFinite(s.gold)||s.gold<0||!Number.isFinite(s.pendingLevels)||s.pendingLevels<0||!s.skills||typeof s.skills!=='object')return null;
    if(!s.baseStats||!s.classBases||![...Object.values(s.baseStats),...Object.values(s.classBases)].every(n=>Number.isFinite(n)&&Math.abs(n)<1e6))return null;
    if(s.statSources){
      if(typeof s.statSources!=='object'||Array.isArray(s.statSources))return null;
      for(const source of ['level','camp']){const pool=s.statSources[source];if(pool&&(typeof pool!=='object'||Array.isArray(pool)||!Object.values(pool).every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)))return null;}
    }

    const area=s.campaign;
    if(!Number.isFinite(area.time)||area.time<0||!Array.isArray(area.queue)||area.queue.length>10000||!Array.isArray(area.deposits)||!Array.isArray(area.shopOffers))return null;
    if(area.phase==='extract'&&(!area.exit||!Number.isFinite(area.exit.x)||!Number.isFinite(area.exit.y)||!Number.isFinite(area.remaining)||area.remaining<=0||area.remaining>30))return null;
    if(!Array.isArray(s.milestones)||!Array.isArray(s.learningQueue)||!s.individualPurchases||!s.behaviors)return null;
    for(const key of ['enemies','projectiles','enemyProjectiles','gems','effects','fields','powerups','allies','corpses','lootDrops','choices'])if(!Array.isArray(s[key])||s[key].length>10000)return null;
    const world=new World({hero:s.hero,seed:s.seed,difficulty:s.difficulty,campaign:true,viewport:viewport||save.viewport});
    for(const key of FIELDS)if(Object.hasOwn(s,key))world[key]=s[key];
    if(!world.campaign.route){world.campaign.route=selectMapRoute(world.rng);world.campaign.mapId=world.campaign.route[world.campaign.index];const ox=world.player.x,oy=world.player.y;for(const key of ['enemies','allies','neutrals','gems','fields','enemyFields','projectiles','enemyProjectiles','effects','corpses','powerups','lootDrops'])for(const e of world[key]){e.x-=ox;e.y-=oy;if(Number.isFinite(e.x1)){e.x1-=ox;e.y1-=oy;e.x2-=ox;e.y2-=oy;}}world.player.x=0;world.player.y=0;world.campaign.deposits.forEach(e=>{e.x-=ox;e.y-=oy;});if(world.campaign.exit){world.campaign.exit.x-=ox;world.campaign.exit.y-=oy;}}
    if(!world.campaign.route.every(id=>arenaById(id))||!arenaFor(world))return null;
    for(const record of [world.player,world.baseStats,world.classBases,...world.enemies,...world.allies])for(const key of ['mana','maxMana','manaRegen','spirit'])delete record[key];
    for(const [id,bonus] of Object.entries(world.localBonuses||{})){if(bonus.cost){bonus.ward=(bonus.ward||0)+bonus.cost;delete bonus.cost;}world.localBonuses[id]=bonus;}
    for(const id of Object.keys(world.behaviors))world.behaviors[id]=world.behaviors[id].map(mode=>mode==='economy'?'mobile':mode);
    // Retire Wall of Earth without invalidating an otherwise usable saved run.
    for(const key of ['skills','cooldowns','cooldownDurations','cooldownWaiting','localBonuses','behaviors','individualPurchases'])if(world[key])delete world[key].earthwall;
    delete world.player['skill:earthwall'];delete world.player.statuses?.earthwall;
    world.fields=world.fields.filter(f=>f.kind!=='earthwall');
    world.effects=world.effects.filter(f=>f.kind!=='earthwall'&&f.vfx!=='earthwall');
    world.choices=world.choices.filter(c=>c?.id!=='earthwall');
    world.campaign.shopOffers=world.campaign.shopOffers.filter(c=>c?.id!=='earthwall');
    const migrateChoice=c=>{if(c.skillStat==='cost'){c.skillStat='ward';c.description=`+${(c.amount*100).toFixed(1)}% effective ward rank.`;}if(c.type==='behavior'&&c.mode==='economy'){c.mode='mobile';c.name='Mobile ward';c.description='+12% movement while active; -10% effective rank.';}else if(c.type==='behavior'&&c.id&&c.mode==='focus'&&c.description.includes('mana'))c.description='+20% effective rank; -10% movement while active.';};
    world.choices.forEach(migrateChoice);world.campaign.shopOffers.forEach(migrateChoice);repriceCamp(world);
    Object.assign(world.player,safeArenaPoint(world,world.player));for(const key of ['enemies','allies','neutrals','gems','powerups','lootDrops'])for(const e of world[key])Object.assign(e,safeArenaPoint(world,e,e.radius||12));
    world.campaign.deposits.forEach(e=>Object.assign(e,safeArenaPoint(world,e)));if(world.campaign.exit)Object.assign(world.campaign.exit,safeArenaPoint(world,world.campaign.exit));
    world.lootDrops=world.lootDrops.flatMap(drop=>{const item=new Inventory({bag:[drop.item]},world.hero).bag[0];return item?[{...drop,item}]:[];});
    const skills={};for(const [id,rank] of Object.entries(world.skills))if(SPELLS[id]&&Number.isFinite(rank)&&rank>0&&rank<=8&&canLearn(skills,id))skills[id]=rank;
    world.skills=skills;world.milestones=world.milestones.filter(id=>skills[id]);
    for(const field of ['behaviors','individualPurchases'])world[field]=Object.fromEntries(Object.entries(world[field]).filter(([id])=>skills[id]));
    if(world.status==='levelup'&&world.choices.some(c=>!c||!['skill','passive','learn','replace','keep','behavior'].includes(c.type)||typeof c.name!=='string'||typeof c.description!=='string'))return null;
    world.inventory=new Inventory(save.inventory,world.hero);world.refreshEquipment();world.rng.restore(save.rng);world.events=[];
    if(world.status==='levelup'&&!world.choices.length)world.offer();
    if(['paused','inventory'].includes(world.status))world.status=world.campaign.phase==='camp'?'camp':'playing';
    return world;
  }catch{return null;}
}
