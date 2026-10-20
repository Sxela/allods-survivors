import {SPELLS,resistance} from './original-spells.mjs';
// Spell identities follow the documented monster families. Cast selection,
// wind-up, ranges and damage are standalone survival balance values.
export const ENEMY_SPELLBOOKS=Object.freeze({
  orc_sh:{attacks:['bolt','stone'],support:['heal','shield'],interval:4},
  skeleton_m3:{attacks:['prismatic','drain'],support:['heal','shield'],interval:4.5},
  skeleton_m4:{attacks:['prismatic','drain'],support:['heal','shield'],interval:4.2},
  necromant:{attacks:['drain','bolt','prismatic','firewall'],support:['shield'],interval:4.5},
  dragon:{attacks:['fireball','ice'],support:['heal'],interval:4.2},
  succubus:{attacks:['bolt','ice','poison','prismatic','fireball'],support:['heal','shield'],interval:4.6},
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function enemyDamage(world,target,amount,element){
  if(!target||target.hp<=0)return 0;
  if(target===world.player)return Math.min(target.hp,world.damagePlayer(amount,element));
  const dealt=Math.min(target.hp,amount*(1-resistance(target,element)));target.hp-=dealt;return dealt;
}
function spellTarget(world,cast){return cast.targetAlly?world.allies.find(a=>a.id===cast.targetAlly&&a.hp>0):world.player;}
function resolveCast(world,enemy,cast){
  const target=spellTarget(world,cast),spell=SPELLS[cast.spell];if(!target||target.hp<=0||distance(enemy,target)>620)return;
  const aim=cast.aim||target;if(world.campaign&&['prismatic','drain'].includes(cast.spell)&&distance(target,aim)>55){world.emit('enemyDodged',{caster:enemy.id});return;}
  const damage=enemy.damage*.9,visual=(kind,x,y,extra={})=>world.effects.push({kind,vfx:kind,x,y,ttl:.4,maxTtl:.4,enemy:true,...extra});
  if(cast.spell==='heal'){enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.damage*1.8);visual('healing',enemy.x,enemy.y);}
  else if(cast.spell==='shield'){const pool=25+enemy.damage*2;enemy.statuses.shield={ttl:7,pool,maxPool:pool,fraction:.65};visual('shield',enemy.x,enemy.y);}
  else if(cast.spell==='prismatic'){
    const targets=[target,...[world.player,...world.allies].filter(a=>a.hp>0&&a!==target&&distance(enemy,a)<550)].slice(0,3);
    for(const victim of targets){visual('chain',enemy.x,enemy.y-15,{x2:victim.x,y2:victim.y-15});enemyDamage(world,victim,damage,'air');}
  }else if(cast.spell==='drain'){
    const actual=enemyDamage(world,target,damage,'astral');enemy.hp=Math.min(enemy.maxHp,enemy.hp+actual);visual('drain',target.x,target.y-15,{x2:enemy.x,y2:enemy.y-15});
  }else if(cast.spell==='poison'||cast.spell==='firewall'){
    const angle=Math.atan2(aim.y-enemy.y,aim.x-enemy.x)+Math.PI/2;
    world.enemyFields.push({kind:cast.spell,vfx:spell.vfx,x:aim.x,y:aim.y,r:cast.spell==='poison'?55:65,x1:aim.x-Math.cos(angle)*65,y1:aim.y-Math.sin(angle)*65,x2:aim.x+Math.cos(angle)*65,y2:aim.y+Math.sin(angle)*65,width:32,ttl:3.5,tick:.55,damage:damage*.4,element:spell.element,enemy:true});
  }else{
    const dx=aim.x-enemy.x,dy=aim.y-enemy.y,d=Math.hypot(dx,dy)||1,speed=cast.spell==='stone'?220:265;
    world.enemyProjectiles.push({x:enemy.x,y:enemy.y,vx:dx/d*speed,vy:dy/d*speed,speed,homing:!world.campaign,ttl:3,damage,vfx:spell.vfx,element:spell.element,radius:cast.spell==='fireball'?48:0,targetAlly:cast.targetAlly,sourceId:enemy.id});
  }
  world.emit('enemyCast',{skill:cast.spell,caster:enemy.id,element:spell.element});
}
export function stepEnemyCaster(world,enemy,target,dt,allowed){
  const book=ENEMY_SPELLBOOKS[enemy.type];if(!book)return;
  if(!allowed){enemy.casting=null;return;}
  if(enemy.casting){
    enemy.casting.remaining-=dt;
    if(enemy.casting.remaining<=0){const cast=enemy.casting;enemy.casting=null;resolveCast(world,enemy,cast);}
    return;
  }
  if(enemy.attackCooldown>0||distance(enemy,target)>550)return;
  const index=enemy.castIndex||0;let spell=book.attacks[index%book.attacks.length];
  if(index%3===2&&book.support.includes('heal')&&enemy.hp<enemy.maxHp*.55)spell='heal';
  else if(index%4===3&&book.support.includes('shield')&&!(enemy.statuses.shield?.ttl>0&&enemy.statuses.shield.pool>0))spell='shield';
  enemy.castIndex=index+1;enemy.attackCooldown=book.interval;enemy.attackTime=.65;
  const warning=world.campaign?.7:.5;enemy.casting={spell,remaining:warning,targetAlly:target!==world.player?target.id:null,...(world.campaign?{aim:{x:target.x,y:target.y}}:{})};
  if(world.campaign&&!['heal','shield'].includes(spell))world.effects.push({kind:'enemy-target',x:target.x,y:target.y,r:55,ttl:warning,maxTtl:warning,enemy:true});
  world.effects.push({kind:'enemy-windup',vfx:SPELLS[spell].vfx,x:enemy.x,y:enemy.y-18,ttl:.5,maxTtl:.5,enemy:true});
}
function segmentDistance(x,y,f){const dx=f.x2-f.x1,dy=f.y2-f.y1,t=Math.max(0,Math.min(1,((x-f.x1)*dx+(y-f.y1)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-f.x1-dx*t,y-f.y1-dy*t);}
export function stepEnemyFields(world,dt){
  for(const field of world.enemyFields){field.ttl-=dt;if(field.ttl<=0)continue;field.tick-=dt;
    while(field.tick<=0){field.tick+=.7;for(const target of [world.player,...world.allies]){
      if(target.hp<=0)continue;const inside=field.kind==='firewall'?segmentDistance(target.x,target.y,field)<field.width/2+(target.radius||12):distance(target,field)<field.r+(target.radius||12);
      if(inside)enemyDamage(world,target,field.damage,field.element);
    }}
  }
  world.enemyFields=world.enemyFields.filter(f=>f.ttl>0);
}
