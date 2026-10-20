import {arenaFor,arenaWalkable,safeArenaPoint,arenaDirection} from './map-arenas.mjs';
import {spellValues} from './spell-values.mjs';
// Spell identities and behavior follow the shipped English spells.txt descriptions.
// Damage, cooldowns, durations and ranges below are standalone survival balancing,
// not recovered original-engine constants. Icon names are extracted visual aliases.
const entry=(name,description,icon,vfx,cooldown,element,color='#b9c8e4')=>({name,description,icon,vfx,cooldown,element,color,glyph:'*'});
export const SPELLS={
  bolt:entry('Fire Arrow','Inflicts Fire damage to a single target','spell-firebolt','firebolt',.85,'fire','#f4a35d'),
  fireball:entry('Fireball','Inflicts Fire damage to all caught in its area of effect','spell-fireball','fireball',3.2,'fire'),
  firewall:entry('Wall of Fire','Inflicts Fire damage continuously to all caught in the area of effect','spell-firewall','firewall',5,'fire'),
  protectFire:entry('Protection from Fire','Increases resistance to Fire magic, lowering damage and duration of Fire effects','spell-fire-shield','protect_fire',12,'fire'),
  ice:entry('Ice Missile','Inflicts Water damage to a single target','spell-ice','ice',1,'water'),
  poison:entry('Poison Cloud','Inflicts Water damage continuously to all caught in the area of effect, also poisoning them','spell-poison','poison',4.5,'water','#a1c478'),
  frost:entry('Blizzard','Inflicts Water damage continuously to all caught in the area of effect','spell-ice-bolt','frost',5,'water','#9ad8ef'),
  protectWater:entry('Protection from Water','Increases resistance to Water magic, lowering damage and duration of Water effects','spell-ice-shield','protect_water',12,'water'),
  lightning:entry('Lightning','Inflicts Air damage to a single target','spell-lightning','lightning',2.2,'air','#e7da85'),
  prismatic:entry('Prismatic Spray','Inflicts Air damage to several targets at once','spell-chain-lightning','chain',4,'air'),
  invisibility:entry('Invisibility','Renders a unit invisible. The unit still can be detected, but not visually','spell-invisibility','steam',13,'air'),
  protectAir:entry('Protection from Air','Increases resistance to Air magic, lowering damage and duration of Air effects','spell-shield','orbit',12,'air'),
  stone:entry('Stone Missile','Inflicts Earth damage to a single target','spell-stones','stone',1.3,'earth'),
  earthwall:entry('Wall of Earth','Temporarily creates an impassable wall','spell-dust','earthwall',8,'earth'),
  stonecurse:entry('Stone Curse','Temporarily turns a single target to stone','spell-stone-shield','curse',5,'earth'),
  protectEarth:entry('Protection from Earth','Increases resistance to Earth magic, lowering damage and duration of Earth effects','spell-stone-shield','protect_earth',12,'earth'),
  bless:entry('Bless',"Increases warrior's chances to do maximum damage with a hand-held weapon",'spell-sword','bless',12,'astral'),
  hasteSpell:entry('Haste','Increases speed of a single unit','spell-haste','bless',11,'astral'),
  animate:entry('Animate Dead',"Raises zombie, skeleton, or ghost from a unit's corpse",'spell-skeleton','ghost',7,'astral'),
  teleport:entry('Teleport','Teleports the caster to a specified location','spell-portal','teleport',9,'astral'),
  heal:entry('Heal','Restores health to a single target','spell-healing','healing',7,'astral'),
  summon:entry('Summon','Summons a monster to defend the caster.','spell-summon','ghost',10,'astral'),
  drain:entry('Drain Life',"Drains a single victim's life, healing the caster at the same time",'spell-curse','drain',4,'astral'),
  shield:entry('Shield','Creates temporary shield to absorb part of the incoming damage','spell-magic','shield',11,'astral'),
};
const healTarget=(world,amount,target=world.player)=>world.heal?world.heal(amount,target):(target.hp=Math.min(target.maxHp,target.hp+amount));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const SELF_BUFFS=new Set(['protectFire','protectWater','protectAir','protectEarth','bless','hasteSpell','invisibility','shield']);
const statuses=e=>e.statuses||(e.statuses={});
const protection={fire:'protectFire',water:'protectWater',air:'protectAir',earth:'protectEarth'};
export function resistance(entity,element){const s=entity.statuses?.[protection[element]],gear=Math.min(.75,Math.max(0,entity[`${element}Resist`]||0));return Math.min(.9,1-(1-gear)*(1-(s?.ttl>0?s.reduction:0)));}
export function statusDuration(entity,element,duration){const s=entity.statuses?.[protection[element]];return duration*(s?.ttl>0?s.durationScale:1)*(1-Math.min(.75,Math.max(0,entity[`${element}Resist`]||0)));}
export function movementMultiplier(entity){const s=entity.statuses?.hasteSpell;const stance=Object.values(entity.statuses||{}).filter(s=>s.ttl>0&&s.moveMultiplier).reduce((v,s)=>v*s.moveMultiplier,1);return (s?.ttl>0?s.multiplier:1)*stance;}
export function physicalRoll(world,min,max,entity=world.player){min+=(entity.minDamage||0)+(entity.body||0)*.4+(entity.weaponSkill||0)*.2;max=Math.max(min,max+(entity.maxDamage||0)+(entity.body||0)*.7+(entity.weaponSkill||0)*.2);const s=entity.statuses?.bless;return s?.ttl>0&&world.rng()<s.maxRollChance?max:min+(max-min)*world.rng();}
// Return post-resistance, post-shield damage; armor remains the caller's concern.
export function absorbIncoming(entity,amount,element='physical'){
  let damage=Math.max(0,amount)*(1-resistance(entity,element));const shield=entity.statuses?.shield;
  if(shield?.ttl>0&&shield.pool>0){const blocked=Math.min(shield.pool,damage*shield.fraction);shield.pool-=blocked;damage-=blocked;}
  return damage;
}
const effect=(world,vfx,x,y,extra={})=>world.effects.push({kind:vfx,vfx,x,y,ttl:.7,maxTtl:.7,...extra});
function projectile(world,id,target,rank){
  const p=world.player,spell=SPELLS[id],speed=id==='stone'?260:390,angle=Math.atan2(target.y-p.y,target.x-p.x);
  world.projectiles.push({kind:id,vfx:spell.vfx,element:spell.element,targetId:target.id,x:p.x,y:p.y-12,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,speed,ttl:4,damage:spellValues(id,rank).damage,radius:spellValues(id,rank).radius||0,homing:true,hits:new Set(),pierce:1});
}
function segmentDistance(x,y,f){const dx=f.x2-f.x1,dy=f.y2-f.y1,t=Math.max(0,Math.min(1,((x-f.x1)*dx+(y-f.y1)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-(f.x1+dx*t),y-(f.y1+dy*t));}
export function blocksMovement(world,x,y,radius=12){return !arenaWalkable(arenaFor(world),x,y,radius)||world.fields.some(f=>f.kind==='earthwall'&&f.ttl>0&&segmentDistance(x,y,f)<f.width/2+radius);}
export const EARTH_WALL_MIN_DISTANCE=110;
function wall(world,kind,target,rank){const p=world.player,dx=target.x-p.x,dy=target.y-p.y,angle=Math.hypot(dx,dy)>.001?Math.atan2(dy,dx):Math.atan2(p.dy??1,p.dx??0),a=angle+Math.PI/2,values=spellValues(kind,rank),length=values.length,half=length/2;
  let x=target.x,y=target.y;
  if(kind==='earthwall'){const distance=Math.max(EARTH_WALL_MIN_DISTANCE,Math.min(300,Math.hypot(dx,dy)));x=p.x+Math.cos(angle)*distance;y=p.y+Math.sin(angle)*distance;world.fields=world.fields.filter(f=>f.kind!=='earthwall');}
  world.fields.push({kind,vfx:SPELLS[kind].vfx,x,y,x1:x-Math.cos(a)*half,y1:y-Math.sin(a)*half,x2:x+Math.cos(a)*half,y2:y+Math.sin(a)*half,width:kind==='earthwall'?26:38,r:half,ttl:values.duration,damage:values.damage||0,element:kind==='earthwall'?'earth':'fire',tick:0});
}
function addAlly(world,type,x,y,rank){const values=spellValues('summon',rank),hp=values.allyHp;world.allies.push({id:world.nextId++,type,...safeArenaPoint(world,{x,y},13),hp,maxHp:hp,radius:13,speed:115,damage:values.allyDamage,ttl:values.duration,attackCooldown:0,dx:0,dy:1,moving:false});effect(world,'ghost',x,y);}
export function castOriginal(world,id,rank=1){
  const spell=SPELLS[id];if(!spell)return false;
  world.allies??=[];world.corpses??=[];
  const p=world.player,target=world.nearest(),s=statuses(p),values=spellValues(id,rank);let cast=true;
  if(['bolt','ice','stone','fireball'].includes(id)){if(!target)return false;projectile(world,id,target,rank);}
  else if(id==='lightning'||id==='prismatic'){
    if(!target)return false;const targets=id==='lightning'?[target]:world.enemies.filter(e=>e.hp>0&&distance(p,e)<700+(p.sight||0)).sort((a,b)=>distance(p,a)-distance(p,b)).slice(0,values.targets);
    for(const e of targets){effect(world,id==='lightning'?'lightning':'chain',p.x,p.y-15,{x2:e.x,y2:e.y-15,ttl:.35,maxTtl:.35});world.hurt(e,values.damage,'air');}
  }else if(id==='poison'||id==='frost'){
    if(!target)return false;world.fields.push({kind:id,vfx:spell.vfx,x:target.x,y:target.y,r:values.radius,ttl:values.duration,tick:0,damage:values.damage,element:'water',rank});
  }else if(id==='firewall'||id==='earthwall'){if(!target)return false;wall(world,id,target,rank);}
  else if(id.startsWith('protect'))s[id]={ttl:values.duration,reduction:values.reduction,durationScale:Math.max(.2,.65-rank*.04)};
  else if(id==='stonecurse'){if(!target)return false;statuses(target).stonecurse={ttl:statusDuration(target,'earth',values.duration)};effect(world,'curse',target.x,target.y);}
  else if(id==='bless')s.bless={ttl:values.duration,maxRollChance:values.maxRollChance};
  else if(id==='hasteSpell')s.hasteSpell={ttl:values.duration,multiplier:values.movement};
  else if(id==='invisibility')s.invisibility={ttl:values.duration};
  else if(id==='shield')s.shield={ttl:values.duration,pool:values.absorption,maxPool:values.absorption,fraction:values.fraction};
  else if(id==='heal'){
    const recipient=[p,...world.allies].filter(e=>e.hp<e.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(!recipient)return false;
    healTarget(world,values.healing,recipient);effect(world,'healing',recipient.x,recipient.y);
  }else if(id==='drain'){
    if(!target)return false;const before=target.hp;world.hurt(target,values.damage,'astral');healTarget(world,Math.max(0,before-Math.max(0,target.hp)));effect(world,'drain',target.x,target.y,{x2:p.x,y2:p.y});
  }else if(id==='teleport'){
    // Autocast supplies a specified safe destination; it is an instant move,
    // unlike the existing dash. Prefer the player's movement direction.
    const startX=p.x,startY=p.y,angle=p.moving?Math.atan2(p.dy,p.dx):Math.atan2(p.y-(target?.y??p.y+1),p.x-(target?.x??p.x));
    let destination=null;for(let n=0;n<12;n++){const a=angle+n*Math.PI/6,x=p.x+Math.cos(a)*values.distance,y=p.y+Math.sin(a)*values.distance;if(!blocksMovement(world,x,y)&&!world.enemies.some(e=>e.hp>0&&Math.hypot(e.x-x,e.y-y)<e.radius+24)){destination={x,y};break;}}
    if(!destination)return false;Object.assign(p,destination);effect(world,'teleport',startX,startY);effect(world,'teleport',p.x,p.y);
  }else if(id==='animate'){
    if(world.allies.length>=8)return false;const corpse=world.corpses.filter(c=>c.ttl>0&&distance(p,c)<450).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(!corpse)return false;
    world.corpses.splice(world.corpses.indexOf(corpse),1);addAlly(world,['zombie','skeleton','ghost'][Math.floor(world.rng()*3)],corpse.x,corpse.y,rank);
  }else if(id==='summon'){
    if(world.allies.length>=8)return false;addAlly(world,'wolf',p.x+35,p.y+25,rank);
  }else cast=false;
  if(cast){if(['bless','hasteSpell','invisibility','shield',...Object.values(protection)].includes(id))effect(world,spell.vfx,p.x,p.y);world.emit('cast',{skill:id});}
  return cast;
}
export function stepOriginal(world,dt){
  world.allies??=[];world.corpses??=[];
  for(const e of [world.player,...world.enemies,...world.allies])for(const [key,status] of Object.entries(e.statuses||{})){
    if(key==='poison'&&e.hp>0){const alive=Math.min(dt,status.ttl);status.tick=(status.tick||0)+alive;while(status.tick>=.4){status.tick-=.4;world.hurt(e,status.dps*.4,'water');}}
    status.ttl-=dt;if(status.ttl<=0)delete e.statuses[key];
  }
  for(const f of world.fields){f.ttl-=dt;if(f.ttl<=0)continue;if(f.kind==='earthwall')continue;
    f.tick-=dt;while(f.tick<=0){f.tick+=.4;for(const e of world.enemies){if(e.hp<=0)continue;const inside=f.kind==='firewall'?segmentDistance(e.x,e.y,f)<f.width/2+e.radius:distance(f,e)<f.r+e.radius;if(!inside)continue;world.hurt(e,f.damage,f.element);
      if(f.kind==='poison')statuses(e).poison={ttl:statusDuration(e,'water',3),dps:3+f.rank*2,tick:0};
    }}
  }
  world.fields=world.fields.filter(f=>f.ttl>0);
  for(const ally of world.allies){ally.ttl-=dt;ally.attackCooldown-=dt;if(ally.hp<=0)continue;
    const target=world.nearest(ally,350),destination=target||world.player,d=distance(ally,destination)||1,reach=target?35:65;
    ally.dx=(destination.x-ally.x)/d;ally.dy=(destination.y-ally.y)/d;ally.moving=d>reach;
    if(ally.moving){const x=ally.x+ally.dx*ally.speed*dt,y=ally.y+ally.dy*ally.speed*dt;if(!blocksMovement(world,x,y,ally.radius)){ally.x=x;ally.y=y;}else{const next=arenaDirection(world,ally,destination);if(next){const length=Math.hypot(next.x-ally.x,next.y-ally.y)||1,step=Math.min(length,ally.speed*dt),nx=ally.x+(next.x-ally.x)/length*step,ny=ally.y+(next.y-ally.y)/length*step;if(!blocksMovement(world,nx,ny,ally.radius)){ally.x=nx;ally.y=ny;}}}}
    if(target&&d<reach+target.radius&&ally.attackCooldown<=0){ally.attackCooldown=.8;world.hurt(target,physicalRoll(world,ally.damage*.6,ally.damage,ally),'physical');effect(world,'bless',target.x,target.y,{ttl:.2,maxTtl:.2});}
  }
  world.allies=world.allies.filter(a=>a.ttl>0&&a.hp>0);
  for(const corpse of world.corpses)corpse.ttl-=dt;world.corpses=world.corpses.filter(c=>c.ttl>0);
}
