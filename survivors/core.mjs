import {monsterCombat} from './monster-combat.mjs';
import {selectMapRoute,arenaFor,arenaWalkable,arenaWithin,nativeSpawn,safeArenaPoint,arenaDirection} from './map-arenas.mjs';
import {createArea,placeDeposits,openExit,stepCampaign,advanceArea,terrainTime} from './campaign.mjs';
import {nextReward,chooseReward,spellModifiers,ordinaryOffers,applyGift,ordinaryPool,shopPriceScale,campPrice,repriceCamp} from './knowledge.mjs';
import {POWERUPS,grantPowerup} from './powerups.mjs';
import {updateChampionEncounters} from './encounters.mjs';
import {applyEquipment,effectiveSpellRank,hitChance} from './equipment-combat.mjs';
import {castingPool,canLearn,learnedCount,SPELL_CAPS,replacementIds,spellGroup} from './spell-loadout.mjs';
import {ENEMY_SPELLBOOKS,stepEnemyCaster,stepEnemyFields,enemyDamage} from './enemy-spells.mjs';
// Independent survival simulation. World units are pixels; all timers use seconds.
import {Inventory,makeItem,equipmentStats} from './loot.mjs';
import {MONSTERS,ENEMY_SPRITES,projectileVfxById} from './monsters.mjs';
import {SPELLS,SELF_BUFFS,castOriginal,stepOriginal,resistance,absorbIncoming,movementMultiplier,blocksMovement,physicalRoll} from './original-spells.mjs';
export const SKILLS=SPELLS;
export const CLASSES={
  mage:{name:'Mage',sprite:'mage',skill:'bolt',hp:100,speed:150,text:'Fire Arrow + Fireball / focused and area magic'},
  warrior:{name:'Warrior',sprite:'warrior',skill:'shield',hp:145,speed:140,text:'Shield / automatic melee attacks'},
  ranger:{name:'Archer',sprite:'ranger',skill:'poison',hp:110,speed:170,text:'Poison Cloud / automatic bow attacks'},
};
export const ENEMIES=Object.keys(MONSTERS);
export const EQUIPMENT_DROP_CHANCE=.004;
export const DIFFICULTIES=Object.freeze({
  easy:Object.freeze({name:'Easy',description:'Forgiving combat; mostly standing is viable. Collect upgrades and reach the exit.',health:.5,damage:.35,speed:.85,density:.8,spawnRate:.85,hitGrace:.8,healthGrowth:0,damageGrowth:0,overstayHealth:0,overstayDamage:0,gold:1,lootPower:1,magicFind:0}),
  normal:Object.freeze({name:'Normal',description:'Move, dodge and plan your build. Enemy pressure grows across the first regions.',health:1,damage:1,speed:1,density:1,spawnRate:1,hitGrace:.42,healthGrowth:.5,damageGrowth:2,overstayHealth:.2,overstayDamage:.6,gold:1,lootPower:1,magicFind:0}),
  hard:Object.freeze({name:'Hard',description:'Survival demands movement and a strong build. +50% gold, +25% item stats and better magic/rare odds.',health:1.2,damage:1.1,speed:1.1,density:1.3,spawnRate:1.2,hitGrace:.4,healthGrowth:.5,damageGrowth:2,overstayHealth:.35,overstayDamage:.6,gold:1.5,lootPower:1.25,magicFind:1}),
});
export {ENEMY_SPRITES};
export function enemyFootprint(type='wolf',boss=false){const [width,height]=ENEMY_SPRITES[type]||[132,132];return {halfWidth:Math.max(width/2,15),above:height-2,below:Math.max(2,6)};}
export function random(seed=12345) {let a=seed>>>0; const rng=()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};rng.state=()=>a;rng.restore=value=>a=value>>>0;return rng;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class World {
  constructor({hero='mage',seed=Date.now(),duration=600,bonuses={},inventory={},viewport={width:800,height:600},difficulty='normal',campaign=false,areaCount=12}={}) {
    this.difficulty=Object.hasOwn(DIFFICULTIES,difficulty)?difficulty:'normal';this.rules=DIFFICULTIES[this.difficulty];
    this.rng=random(seed); this.seed=seed; this.hero=CLASSES[hero]?hero:'mage'; const c=CLASSES[this.hero];
    this.duration=duration;this.time=0;this.status='playing';this.enemies=[];this.projectiles=[];this.enemyProjectiles=[];this.gems=[];this.effects=[];this.fields=[];this.powerups=[];this.championMarks=new Set();this.allies=[];this.neutrals=[];this.ambientStages=new Set();this.corpses=[];this.basicCooldown=0;this.events=[];this.kills=0;this.nextId=1;this.spawnTimer=0;this.bosses=new Set();this.choices=[];this.pendingLevels=0;
    this.player={x:0,y:0,hp:c.hp+(bonuses.vitality||0)*10,maxHp:c.hp+(bonuses.vitality||0)*10,speed:c.speed,level:1,xp:0,nextXp:7,damage:1+(bonuses.power||0)*.04,haste:1,magnet:72+(bonuses.magnet||0)*8,armor:0,regen:0,invulnerable:0,dash:0,dashCooldown:0,dx:0,dy:1};
    this.player.statuses={};this.player.magicFind=(bonuses.magicFind||0)*.1;this.player.goldFind=(bonuses.goldFind||0)*.1;
    this.inventory=new Inventory(inventory,this.hero);this.lootDrops=[];this.nextLootId=1;this.enemyFields=[];
    Object.assign(this.player,{attack:0,defense:0,spellDamage:0,attackSpeed:0});
    this.baseStats=Object.fromEntries(['maxHp','speed','damage','haste','magnet','armor','regen','magicFind','goldFind','attack','defense','spellDamage','attackSpeed'].map(key=>[key,this.player[key]]));
    this.classBases={...this.baseStats};this.statSources={level:{},camp:{}};this.localBonuses={};this.individualPurchases={};this.behaviors={};this.milestones=[];this.learningQueue=[];this.rewardKind='ordinary';this.campaign=campaign?createArea(0,selectMapRoute(this.rng,areaCount)):null;this.metrics={damageTaken:0,damageDealt:0,healing:0,casts:0,spawned:0,oreGold:0,shieldAbsorbed:0};
    this.refreshEquipment();this.player.hp=this.player.maxHp;
    this.skills={[c.skill]:1,...(campaign&&this.hero==='mage'?{fireball:1}:{})};this.cooldowns={};this.cooldownDurations={};this.cooldownWaiting={};this.gold=0;this.bossDefeated=false;this.finalBossDefeated=false;this.openingWave=true;
    this.setViewport(viewport.width,viewport.height);if(this.campaign)placeDeposits(this);
  }
  get terrainTime(){return terrainTime(this);}
  nextArea(){return advanceArea(this);}
  spellModifiers(id){return spellModifiers(this,id);}
  prepareCamp(){if(this.status!=='camp')return;repriceCamp(this);if(!this.campaign.shopOffers.length)this.rollCamp();}
  rollCamp(){if(this.status!=='camp')return false;const a=this.campaign;a.shopSerial++;a.shopOffers=ordinaryOffers(this,5).map((c,i)=>({...c,price:campPrice(this,c.rarity),offerId:`${a.index}:${a.shopSerial}:${i}`}));return true;}
  campRerollCost(){return Math.ceil(8*(1+this.campaign.rerolls)*shopPriceScale(this));}
  rerollCamp(){const pool=ordinaryPool(this);if(!pool.spells.length&&!pool.passives.length)return false;if(this.status!=='camp'||this.gold<this.campRerollCost())return false;this.gold-=this.campRerollCost();this.campaign.rerolls++;return this.rollCamp();}
  buyCamp(offerId){if(this.status!=='camp')return false;const a=this.campaign,i=a.shopOffers.findIndex(c=>c.offerId===offerId),c=a.shopOffers[i];if(!c||c.price!==campPrice(this,c.rarity)||c.price===null||this.gold<c.price||!applyGift(this,c,'camp'))return false;this.gold-=c.price;a.shopOffers.splice(i,1);return true;}
  resolveCampMilestones(){if(this.status!=='camp'||!this.milestones.length)return false;this.campReward=true;nextReward(this);return true;}
  emit(type,data={}) {this.events.push({type,...data});}
  castingSkills(){return castingPool(this.skills,this.player);}
  replacementSkills(id){return replacementIds(this.skills,id);}
  refreshEquipment(){const before=this.castingSkills();applyEquipment(this,equipmentStats(this.inventory.equipment,this.hero));const after=new Set(this.castingSkills().map(s=>s.id));for(const {id} of before)if(!after.has(id)){delete this.cooldowns?.[id];delete this.player.statuses[id];}}
  equipItem(id){if(!this.inventory.equip(id))return false;this.refreshEquipment();return true;}
  unequipItem(slot){if(!this.inventory.unequip(slot))return false;this.refreshEquipment();return true;}
  moveItem(id,target){if(!this.inventory.move(id,target))return false;this.refreshEquipment();return true;}
  goldAmount(base){const scaled=base*(1+this.player.goldFind)*this.rules.gold,whole=Math.floor(scaled),fraction=scaled-whole;return whole+(fraction>0&&this.rng()<fraction?1:0);}
  runReward(){const bonus=Math.floor(this.kills/12)+Math.floor(this.time/30)+(this.status==='won'?50:0);return this.gold+Math.round(bonus*this.rules.gold);}
  dropLoot(enemy){
    const owned=new Set([...this.inventory.bag,...Object.values(this.inventory.equipment).filter(Boolean),...this.lootDrops.map(drop=>drop.item)].map(item=>item.id));
    let id;do{id=`${this.seed}:${this.nextLootId++}`;}while(owned.has(id));
    const item=makeItem(this.rng,{hero:this.hero,level:this.player.level,boss:!!(enemy.boss||enemy.minorBoss||enemy.elite),id,magicFind:this.player.magicFind+this.rules.magicFind,statMultiplier:this.rules.lootPower});
    const landing=safeArenaPoint(this,enemy);this.lootDrops.push({x:landing.x,y:landing.y,item,warned:false});if(this.lootDrops.length>100)this.lootDrops.shift();
    this.emit('lootDrop',{x:enemy.x,y:enemy.y,rarity:item.rarity});return item;
  }
  dropPowerup(enemy,kind=Object.keys(POWERUPS)[Math.floor(this.rng()*Object.keys(POWERUPS).length)]){
    if(!Object.hasOwn(POWERUPS,kind))return null;
    const landing=safeArenaPoint(this,{x:enemy.x+12,y:enemy.y+10});const drop={id:this.nextId++,kind,x:landing.x,y:landing.y,ttl:45};this.powerups.push(drop);
    if(this.powerups.length>40)this.powerups.shift();return drop;
  }
  heal(amount,target=this.player){const actual=Math.max(0,Math.min(target.maxHp-target.hp,amount));target.hp+=actual;if(target===this.player)this.metrics.healing+=actual;return actual;}
  damagePlayer(amount,element='physical'){
    const p=this.player;if(p.invulnerable>0||amount<=0)return 0;
    if(element==='physical'&&p.defense>0&&this.rng()<Math.min(.6,p.defense/(p.defense+100))){this.emit('evade');return 0;}
    const beforeShield=p.statuses.shield?.pool||0;const dealt=absorbIncoming(p,Math.max(1,amount-(element==='physical'?p.armor:0)),element);
    this.metrics.shieldAbsorbed+=Math.max(0,beforeShield-(p.statuses.shield?.pool||0));p.hp-=dealt;this.metrics.damageTaken+=dealt;p.invulnerable=this.campaign?(this.campaign.index===0?this.rules.hitGrace+Math.max(0,.65-this.rules.hitGrace)*Math.max(0,1-this.campaign.time/120):this.rules.hitGrace):.65;this.emit('hurt');return dealt;
  }
  nearest(p=this.player,range=700+(this.player.sight||0),exclude=new Set()) {let best=null,d=range;for(const e of this.enemies){const n=dist(p,e);if(e.hp>0&&!exclude.has(e.id)&&n<d){best=e;d=n;}}return best;}
  setViewport(width,height) {
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('Viewport must have positive finite dimensions');
    this.viewport={width,height};
  }
  spawnPosition(type='wolf',boss=false) {
    const bounded=nativeSpawn(this,enemyFootprint(type,boss),type==='dragon'?32:14);if(bounded)return bounded;
    // Spawn just outside the view using each sprite's actual foot-anchored
    // bounds. Only the bottom edge needs room for the entire body above feet.
    const angle=this.rng()*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle),shape=enemyFootprint(type,boss),gap=12;
    const horizontal=this.viewport.width/2+shape.halfWidth+gap;
    const vertical=this.viewport.height/2+(dy<0?shape.below:shape.above)+gap;
    const edge=Math.min(horizontal/Math.abs(dx),vertical/Math.abs(dy));
    const radius=edge+this.rng()*16;
    return {x:this.player.x+dx*radius,y:this.player.y+dy*radius};
  }
  spawn(type,boss=false,plannedPosition=null){
    const canonical={skeleton:'skeleton_f1',zombie:'zombie_f1'}[type]||type;
    const def=MONSTERS[canonical];if(!def)throw new Error(`Unknown monster: ${type}`);
    const position=plannedPosition||this.spawnPosition(canonical,boss),combat=monsterCombat(this,canonical,{boss}),hp=combat.hp;
    const e={id:this.nextId++,type:canonical,name:def.name,...position,hp,maxHp:hp,
      speed:combat.speed,
      radius:canonical==='dragon'?30:14,damage:combat.damage,boss,slow:0,hit:0,
      phase:this.rng()*10,attackCooldown:1+this.rng()*2,spawnedAt:this.time,statuses:{},
      attackTime:0,moving:false,lastSeen:{x:this.player.x,y:this.player.y}};
    if(e.arrival)this.effects.push({kind:'teleport',vfx:'teleport',x:e.x,y:e.y,ttl:.8,maxTtl:.8});if(def.hostile||boss)this.enemies.push(e);else this.neutrals.push(e);this.metrics.spawned++;if(boss)this.emit('boss',{name:def.name});return e;
  }
  hurt(e,amount,element='physical'){
    if(e.hp<=0||e.arrival>0||amount<=0)return 0;
    if(element==='physical'&&(this.player.attack>0||e.defense>0)&&this.rng()>hitChance(this.player.attack||0,e.defense||0))return 0;
    const dealt=absorbIncoming(e,amount*this.player.damage*(element==='physical'?1:1+this.player.spellDamage),element),actual=Math.min(e.hp,dealt);
    e.hp-=dealt;this.metrics.damageDealt+=actual;e.hit=.12;
    if(e.hp<=0){
      this.kills++;this.corpses.push({id:this.nextId++,type:e.type,x:e.x,y:e.y,dx:e.dx,dy:e.dy,ttl:25});
      if(this.corpses.length>80)this.corpses.shift();
      if(e.boss||e.minorBoss||e.elite||this.kills===1||this.rng()<EQUIPMENT_DROP_CHANCE)this.dropLoot(e);
      const landing=safeArenaPoint(this,e);this.gems.push({x:landing.x,y:landing.y,value:e.boss?35:e.minorBoss?12:1+(this.rng()<.12?2:0),type:'xp'});
      if(this.rng()<.04||e.boss)this.gems.push({...safeArenaPoint(this,{x:landing.x+8,y:landing.y}),type:'heal',value:e.boss?35:12});
      if(e.boss){this.gold+=this.goldAmount(15);this.bossDefeated=true;if(e.finalBoss)this.finalBossDefeated=true;this.emit('bossKilled',{finalBoss:!!e.finalBoss});openExit(this,e);}
      else if(e.minorBoss){this.gold+=this.goldAmount(6);this.emit('championKilled',{name:e.name});}
      else if(this.rng()<Math.min(.5,.12*(1+this.player.goldFind*.4)))this.gems.push({...safeArenaPoint(this,{x:landing.x-7,y:landing.y}),type:'gold',value:Math.max(1,this.goldAmount(2+Math.floor(this.terrainTime/180)))});
      if(e.minorBoss||e.boss||this.rng()<.004)this.dropPowerup(e);
      this.emit('kill',{x:e.x,y:e.y});
    }
    return actual;
  }
  area(x,y,r,damage,kind='explosion',slow=0,element='fire'){
    this.effects.push({kind,x,y,r,ttl:.5,maxTtl:.5});
    for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-x,e.y-y)<r+e.radius){this.hurt(e,damage,element);e.slow=Math.max(e.slow,slow);}
  }
  spellInterval(id,rank=this.skills?.[id]||0){return Math.max(SPELLS[id].cooldown*.2,SPELLS[id].cooldown/(this.player.haste*this.spellModifiers(id).tempo*(1+this.effectiveRank(id,rank)*.035)));}
  effectiveRank(id,rank=this.skills?.[id]||0){return Math.min(30,effectiveSpellRank(this,id,rank,SPELLS[id]?.element)*this.spellModifiers(id).rank);}
  cast(id,rank=1){if(!SPELLS[id])return false;const result=castOriginal(this,id,this.effectiveRank(id,rank));if(result!==false){this.metrics.casts++;if(SELF_BUFFS.has(id)&&this.player.statuses[id])this.player.statuses[id].moveMultiplier=this.spellModifiers(id).movement;}return result;}
  offer() {
    if(this.campaign){nextReward(this);return;}
    const pool=[];for(const [id,s] of Object.entries(SKILLS)){const rank=this.skills[id]||0;if(rank<8&&canLearn(this.skills,id))pool.push({id,type:'skill',name:s.name,description:rank?`Rank ${rank+1} · increased spell potency.`:s.description,rank:rank+1});}
    const passives=[['power','Arcane force','Deal 15% more damage.'],['haste','Quickening','Cast spells 10% faster.'],['vitality','Heart of the allod','Gain 25 maximum health and heal 25.'],['speed','Wayfarer','Move 8% faster.'],['magnet','Soul harvest','Collect experience from farther away.'],['regen','Renewal','Recover 0.5 health each second.']];
    for(const [id,name,description] of passives)pool.push({id,type:'passive',name,description});
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const replacements=Object.keys(SKILLS).filter(id=>!this.skills[id]&&learnedCount(this.skills,spellGroup(id))>=SPELL_CAPS[spellGroup(id)]);
    const full=Object.entries(SPELL_CAPS).every(([group,cap])=>learnedCount(this.skills,group)>=cap);
    this.choices=full?[...pool.filter(c=>c.type==='skill'&&this.skills[c.id]),...pool.filter(c=>c.type==='passive')].slice(0,3):pool.slice(0,3);
    if(replacements.length){const id=replacements[Math.floor(this.rng()*replacements.length)],spell=SKILLS[id];this.choices.push({id,type:'replace',rank:1,name:spell.name,description:`Replace a learned ${spellGroup(id)} spell with ${spell.name} at rank 1.`});}this.status='levelup';this.emit('levelup');
  }
  choose(index,replaceId=null) {
    if(this.campaign){const ok=chooseReward(this,index,replaceId);if(ok&&this.campReward&&this.status==='playing'){this.campReward=false;this.status='camp';}return ok;}
    if(this.status!=='levelup'||!this.choices[index])return false;const c=this.choices[index],p=this.player;
    if(c.type==='replace'){if(!Object.hasOwn(this.skills,replaceId)||this.skills[c.id]||!replacementIds(this.skills,c.id).includes(replaceId))return false;this.skills=Object.fromEntries(Object.entries(this.skills).map(([id,rank])=>id===replaceId?[c.id,1]:[id,rank]));delete this.cooldowns[replaceId];delete this.player.statuses[replaceId];this.cooldowns[c.id]=0;}
    else if(c.type==='skill'){if(!canLearn(this.skills,c.id))return false;this.skills[c.id]=c.rank;this.cooldowns[c.id]=0;}
    else if(c.id==='power')this.baseStats.damage+=.15;else if(c.id==='haste')this.baseStats.haste+=.1;else if(c.id==='vitality')this.baseStats.maxHp+=25;else if(c.id==='speed')this.baseStats.speed+=this.classBases.speed*.08;else if(c.id==='magnet')this.baseStats.magnet+=35;else if(c.id==='regen')this.baseStats.regen+=.5;
    if(c.type==='passive'){this.refreshEquipment();if(c.id==='vitality')p.hp=Math.min(p.maxHp,p.hp+25);}
    this.pendingLevels--;this.choices=[];this.status='playing';if(this.pendingLevels>0)this.offer();return true;
  }
  addXp(value) {const p=this.player;p.xp+=value*(1+(p.mind||0)*.01);while(p.xp>=p.nextXp){p.xp-=p.nextXp;p.level++;if(this.campaign&&p.level%5===0)this.learningQueue.push(p.level);const healed=Math.min(p.maxHp-p.hp,32);p.hp+=healed;this.metrics.healing+=healed;this.effects.push({kind:'healing',vfx:'healing',x:p.x,y:p.y,ttl:.7,maxTtl:.7});p.nextXp=Math.floor(p.nextXp*1.22+3);this.pendingLevels++;}if(this.pendingLevels&&this.status==='playing')this.offer();}
  dash() {const p=this.player;if(this.status==='playing'&&p.dashCooldown<=0){p.dash=.23;p.dashCooldown=4;p.invulnerable=.35;this.emit('dash');}}
  step(dt,input={}) {
    if(this.status!=='playing')return;dt=clamp(dt,0,.05);this.time+=dt;const p=this.player;
    p.invulnerable=Math.max(0,p.invulnerable-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.dash=Math.max(0,p.dash-dt);this.heal(p.regen*dt);
    let x=input.x||0,y=input.y||0;const len=Math.hypot(x,y);if(len){x/=len;y/=len;p.dx=x;p.dy=y;}if(p.dash>0){x=p.dx;y=p.dy;}p.moving=!!(len||p.dash);const move=p.speed*movementMultiplier(p)*(p.dash>0?3.5:1)*dt;const nx=p.x+x*move,ny=p.y+y*move;if(!blocksMovement(this,nx,p.y,12))p.x=nx;if(!blocksMovement(this,p.x,ny,12))p.y=ny;
    this.spawnTimer-=dt;let minute=this.time/60;
    if(this.campaign)stepCampaign(this,dt);if(this.status!=='playing')return;
    if(!this.campaign&&this.spawnTimer<=0&&this.time<this.duration){
      this.spawnTimer=Math.max(.18,.65-minute*.045)/this.rules.spawnRate;
      const count=Math.max(1,Math.round((this.openingWave?8:2+Math.floor(minute/2))*this.rules.density)),density=Math.round(Math.min(240,18+Math.floor(minute*18))*this.rules.density);this.openingWave=false;
      const stages=[['wolf','goblin','spider','bee','legg','turtle'],['orc','goblin_s','zombie_f1','zombie_f2','bat','succubus'],['orc_s','orc_sh','troll','ogre','zombie_f3','zombie_f4','zombie_a2','zombie_a3','zombie_a4','succubus','skeleton_m3'],['skeleton_f1','skeleton_f2','skeleton_f3','skeleton_f4','skeleton_a1','skeleton_a2','skeleton_a3','skeleton_a4','ghost','dino'],['skeleton_m3','skeleton_m4','necromant','dragon','star','mainnecro']];
      const stage=Math.min(4,Math.floor(this.time/120)),pool=stages.slice(Math.max(0,stage-1),stage+1).flat();
      for(let n=0;n<count;n++)if(this.enemies.length<density)this.spawn(pool[Math.floor(this.rng()*pool.length)]);
    }
    const ambientStage=Math.min(4,Math.floor(this.terrainTime/120));
    if(!this.campaign&&!this.ambientStages.has(ambientStage)){this.ambientStages.add(ambientStage);this.spawn(['squirrel','sheep','druid','orc_good','troll_good'][ambientStage]);}
    for(const e of this.neutrals){const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;e.dx=dx/d;e.dy=dy/d;e.moving=d>220&&d<1000;if(e.moving){e.x+=e.dx*35*dt;e.y+=e.dy*35*dt;}}
    this.neutrals=this.neutrals.filter(e=>dist(e,p)<1600);
    const marks=this.campaign?[]:[...[120,240,360,480].filter(t=>t<this.duration-15),this.duration-15];
    for(const mark of marks)if(this.time>=mark&&!this.bosses.has(mark)){
      this.bosses.add(mark);const type=mark===this.duration-15?'mainnecro':({120:'orc_sh',240:'troll',360:'necromant',480:'dragon'}[mark]||'troll');
      const boss=this.spawn(type,true);boss.finalBoss=mark===this.duration-15;
    }
    if(!this.campaign)updateChampionEncounters(this);
    for(const {id,rank} of this.castingSkills()){
      if(!SPELLS[id])continue;this.cooldowns[id]=(this.cooldowns[id]||0)-dt;
      if(!this.campaign&&id==='shield'&&p.statuses.shield?.pool<=0)this.cooldowns[id]=Math.min(this.cooldowns[id],1.5);
      if(this.cooldowns[id]<=0){
        const active=p.statuses[id];if(SELF_BUFFS.has(id)&&active?.ttl>.3&&(id!=='shield'||active.pool>0)){this.cooldowns[id]=Math.min(.25,active.ttl-.25);continue;}
        const cast=this.cast(id,rank),normal=this.spellInterval(id,rank);
        // Buff duration does not shorten the displayed recast interval. A short
        // buff must expire before its cooldown permits the next automatic cast.
        this.cooldowns[id]=cast===false?.3:normal;
        this.cooldownWaiting[id]=cast===false;
        if(cast!==false)this.cooldownDurations[id]=this.cooldowns[id];
      }
    }
    this.basicCooldown-=dt;
    if(this.hero!=='mage'&&this.basicCooldown<=0){
      const target=this.nearest(p,(this.hero==='warrior'?(this.campaign?85:70):500)+(p.range||0));
      if(target){this.basicCooldown=(this.hero==='warrior'?.75:1.1)/(1+p.attackSpeed);
        const damage=physicalRoll(this,this.hero==='warrior'?12:9,this.hero==='warrior'?24:18);
        if(this.hero==='warrior'){if(this.campaign){for(const e of this.enemies)if(e.hp>0&&dist(e,p)<85+(p.range||0))this.hurt(e,damage,'physical');}else this.hurt(target,damage,'physical');this.effects.push({kind:'melee',x:target.x,y:target.y,ttl:.2,maxTtl:.2});}
        else{const a=Math.atan2(target.y-p.y,target.x-p.x);this.projectiles.push({kind:'arrow',vfx:projectileVfxById[1]||'arrow',element:'physical',x:p.x,y:p.y,vx:Math.cos(a)*360,vy:Math.sin(a)*360,ttl:3,damage,pierce:this.campaign?3:1,hits:new Set()});}
      }
    }
    stepOriginal(this,dt);
    const contactHits=[];
    for(const e of this.enemies){
      if(e.hp<=0)continue;if(e.arrival>0){e.arrival=Math.max(0,e.arrival-dt);continue;}e.slow=Math.max(0,e.slow-dt);e.hit=Math.max(0,e.hit-dt);e.attackTime=Math.max(0,e.attackTime-dt);
      const def=MONSTERS[e.type],invisible=p.statuses.invisibility?.ttl>0&&dist(e,p)>70;
      if(!invisible)e.lastSeen={x:p.x,y:p.y};
      let target=invisible?e.lastSeen:p;
      for(const ally of this.allies)if(ally.hp>0&&dist(e,ally)<dist(e,target))target=ally;
      let dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;e.dx=dx/d;e.dy=dy/d;
      const projectile=def.projectile??def.projectileId,caster=!!ENEMY_SPELLBOOKS[e.type],ranged=!!projectile||caster;
      const petrified=e.statuses.stonecurse?.ttl>0;
      // Searching ranged enemies must approach the last seen position rather
      // than stop at firing range while unable to detect an invisible target.
      const velocity=e.speed*(e.slow>0?.38:1)*(petrified?0:1)*(ranged&&!invisible&&d<240?0:1)*(invisible&&target===e.lastSeen&&d<10?0:1);
      e.moving=velocity>0&&e.attackTime<=0&&!e.casting;
      if(e.moving){const nx=e.x+e.dx*velocity*dt,ny=e.y+e.dy*velocity*dt;if(def.flying?arenaWithin(arenaFor(this),nx,ny,e.radius):!blocksMovement(this,nx,ny,e.radius)){e.x=nx;e.y=ny;}else if(this.campaign){const point=arenaDirection(this,e);if(point){const d=Math.hypot(point.x-e.x,point.y-e.y)||1,step=Math.min(d,velocity*dt);e.dx=(point.x-e.x)/d;e.dy=(point.y-e.y)/d;const x=e.x+e.dx*step,y=e.y+e.dy*step;if(!blocksMovement(this,x,y,e.radius)){e.x=x;e.y=y;}}}}
      e.attackCooldown-=dt;
      if(caster)stepEnemyCaster(this,e,target,dt,!petrified&&!(invisible&&target===e.lastSeen));
      else if(!petrified&&e.attackCooldown<=0&&d<(ranged?550:e.radius+24)&&!(invisible&&target===e.lastSeen)){
        e.attackCooldown=ranged?3.5:1.1;e.attackTime=.6;
        if(ranged){const speed=projectile===12?220:180;
          this.enemyProjectiles.push({x:e.x,y:e.y,vx:e.dx*speed,vy:e.dy*speed,ttl:4,damage:e.damage,vfx:projectileVfxById[projectile]||'stone',element:projectile===12?'fire':'physical',targetAlly:target!==p?target.id:null});
        }else if(target===p)contactHits.push(e.damage);else target.hp-=e.damage*(1-resistance(target,'physical'));
      }
      const region=arenaFor(this),recycleDistance=region?Math.hypot(region.width*32,region.height*32)+500:Math.max(1200,Math.hypot(this.viewport.width/2,this.viewport.height/2)+600);
      if(dist(e,p)>recycleDistance){Object.assign(e,this.spawnPosition(e.type,e.boss));e.spawnedAt=this.time;}
    }
    if(contactHits.length)this.damagePlayer(Math.max(...contactHits),'physical');
    // A small spatial hash keeps dense hordes apart without an O(n²) collision pass.
    const cells=new Map();for(const e of this.enemies){if(e.hp<=0||this.time-e.spawnedAt<.1)continue;const cx=Math.floor(e.x/40),cy=Math.floor(e.y/40);for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)for(const o of cells.get(`${cx+ox},${cy+oy}`)||[]){let dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy),min=(e.radius+o.radius)*.72;if(d>0&&d<min){const f=(min-d)*.35;e.x+=dx/d*f;e.y+=dy/d*f;o.x-=dx/d*f;o.y-=dy/d*f;}}const key=`${cx},${cy}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e);}
    if(this.campaign)for(const e of this.enemies)if(MONSTERS[e.type]?.flying?!arenaWithin(arenaFor(this),e.x,e.y,e.radius):!arenaWalkable(arenaFor(this),e.x,e.y,e.radius))Object.assign(e,safeArenaPoint(this,e,e.radius));
    for(const b of this.projectiles){
      b.ttl-=dt;
      if(b.homing){const target=this.enemies.find(e=>e.id===b.targetId&&e.hp>0);if(target){const d=dist(b,target)||1;b.vx=(target.x-b.x)/d*b.speed;b.vy=(target.y-b.y)/d*b.speed;}else{b.ttl=0;continue;}}
      const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
      for(const e of this.enemies){
        if(e.hp<=0||b.hits?.has(e.id)||b.homing&&e.id!==b.targetId)continue;
        const dx=b.x-oldX,dy=b.y-oldY,len=dx*dx+dy*dy,t=len?clamp(((e.x-oldX)*dx+(e.y-oldY)*dy)/len,0,1):0;
        if(Math.hypot(e.x-oldX-dx*t,e.y-oldY-dy*t)>=e.radius+8)continue;
        b.hits?.add(e.id);
        if(b.radius||b.splash){this.area(e.x,e.y,b.radius||b.splash,b.damage,'explosion',0,b.element);}
        else{this.hurt(e,b.damage,b.element||'physical');this.effects.push({kind:b.vfx||'firebolt',x:e.x,y:e.y,ttl:.25,maxTtl:.25});}
        if(--b.pierce<=0||b.homing)b.ttl=0;if(b.ttl<=0)break;
      }
    }
    this.projectiles=this.projectiles.filter(b=>b.ttl>0);
    for(const b of this.enemyProjectiles){
      const target=b.targetAlly?this.allies.find(a=>a.id===b.targetAlly&&a.hp>0):p;
      if(b.homing&&target){const d=dist(b,target)||1;b.vx=(target.x-b.x)/d*b.speed;b.vy=(target.y-b.y)/d*b.speed;}
      b.ttl-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(target&&dist(b,target)<17){b.ttl=0;enemyDamage(this,target,b.damage,b.element||'physical');
        if(b.radius){this.effects.push({kind:'explosion',x:b.x,y:b.y,ttl:.4,maxTtl:.4,r:b.radius});for(const other of [p,...this.allies])if(other!==target&&other.hp>0&&dist(b,other)<b.radius)enemyDamage(this,other,b.damage,b.element);}
      }
    }
    this.enemyProjectiles=this.enemyProjectiles.filter(b=>b.ttl>0);
    stepEnemyFields(this,dt);
    for(const drop of this.powerups){drop.ttl-=dt;if(drop.ttl>0&&dist(drop,p)<25&&grantPowerup(this,drop.kind))drop.collected=true;}
    this.powerups=this.powerups.filter(drop=>drop.ttl>0&&!drop.collected);
    for(const drop of this.lootDrops)if(dist(drop,p)<26){const result=this.inventory.pickup(drop.item,{autoEquip:true});if(result.ok){if(result.equipped.length)this.refreshEquipment();if(this.campaign)this.gold+=result.gold;drop.collected=true;this.emit('lootPicked',{item:drop.item,kept:result.kept,autoEquipped:result.equipped.map(change=>change.item.name),autoSold:result.sold.length,saleGold:result.gold});}else if(!drop.warned){drop.warned=true;this.emit('inventoryFull');}}else drop.warned=false;
    this.lootDrops=this.lootDrops.filter(drop=>!drop.collected);
    for(const g of this.gems){const d=dist(g,p);if(d<p.magnet||g.attracted){g.attracted=true;const v=Math.min(d,Math.max(240,500-d)*dt);if(d>0){g.x+=(p.x-g.x)/d*v;g.y+=(p.y-g.y)/d*v;}}if(d<18){if(g.type==='xp')this.addXp(g.value);else if(g.type==='gold')this.gold+=g.value;else this.heal(g.value);g.collected=true;this.emit('pickup',{kind:g.type});}}
    this.gems=this.gems.filter(g=>!g.collected);if(this.gems.length>1300){const xp=this.gems.filter(g=>g.type==='xp');if(xp.length>300){const merged=new Set(xp.slice(0,300));xp[300].value+=xp.slice(0,300).reduce((a,g)=>a+g.value,0);this.gems=this.gems.filter(g=>!merged.has(g));}}
    this.enemies=this.enemies.filter(e=>e.hp>0);for(const e of this.effects)e.ttl-=dt;this.effects=this.effects.filter(e=>e.ttl>0);
    if(p.hp<=0){p.hp=0;this.status='dead';this.emit('end');}else if(!this.campaign&&this.time>=this.duration&&this.finalBossDefeated){this.status='won';this.emit('end');}
  }
}
