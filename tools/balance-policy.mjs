import {arenaDirection,arenaFor,safeArenaPoint} from '../survivors/map-arenas.mjs';
import {blocksMovement} from '../survivors/original-spells.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Live positions and cast warnings; no free progression or simulation edits.
// A second policy separates steering failures from changes to game balance.
export function tacticalInput(w,{seekGuardian=false,extractPriority=false}={}){
 const p=w.player,enemies=w.enemies.filter(e=>e.hp>0&&!e.arrival),near=enemies.filter(e=>distance(e,p)<240);
 let target=w.campaign.exit,enemyTarget=false;
 if(!target&&w.hero==='warrior'){target=enemies.find(e=>e.areaBoss)||enemies.reduce((best,e)=>!best||distance(e,p)<distance(best,p)?e:best,null);enemyTarget=!!target;}
 if(!target&&seekGuardian){target=enemies.find(e=>e.areaBoss);enemyTarget=!!target;}
 if(!target){const pickups=[...w.lootDrops,...w.gems,...w.powerups];target=pickups.reduce((best,e)=>!best||distance(e,p)<distance(best,p)?e:best,null);}
 let goal=target?{x:target.x,y:target.y}:{x:p.x+Math.cos(w.time*.35)*120,y:p.y+Math.sin(w.time*.35)*120};
 if(enemyTarget){const d=distance(target,p)||1,reach=w.hero==='warrior'?70+(p.range||0)+(target.radius>20?10:0):300;goal={x:target.x+(p.x-target.x)/d*reach,y:target.y+(p.y-target.y)/d*reach};}
 if(arenaFor(w)){goal=safeArenaPoint(w,goal);goal=arenaDirection(w,p,goal)||goal;}
 const dx=goal.x-p.x,dy=goal.y-p.y,len=Math.hypot(dx,dy)||1,desire=Math.min(1,len/20),speed=p.speed;
 let best={x:0,y:0},bestScore=-Infinity;
 for(let i=-1;i<16;i++){
  const a=i*Math.PI/8,x=i<0?0:Math.cos(a),y=i<0?0:Math.sin(a),future={x:p.x+x*speed*.25,y:p.y+y*speed*.25};
  if(blocksMovement(w,p.x+x*speed*.05,p.y+y*speed*.05,12)||blocksMovement(w,future.x,future.y,12))continue;
  let score=(x*dx+y*dy)/len*desire+(i<0?(1-desire)*.5:0);
  for(const e of near){const d=distance(e,p)||1,approach=e.speed*.25,ex=e.x+(p.x-e.x)/d*approach,ey=e.y+(p.y-e.y)/d*approach,safe=e.radius+(w.hero==='warrior'?32:75),n=Math.hypot(future.x-ex,future.y-ey);if(n<safe)score-=4*(extractPriority&&w.campaign.exit?.armed ? .35 : 1)*(1-n/safe);}
  for(const b of w.enemyProjectiles){const n=Math.hypot(future.x-b.x-b.vx*.25,future.y-b.y-b.vy*.25);if(n<35)score-=3*(1-n/35);}
  for(const f of [...w.enemyFields,...w.effects.filter(f=>f.kind==='enemy-target')]){const d=Math.hypot(future.x-f.x,future.y-f.y),radius=f.r||65;if(d<radius+15)score-=2*(1-d/(radius+15));}
  if(score>bestScore){bestScore=score;best={x,y};}
 }
 return best;
}

// Optional skilled probe: normal game controls, including its bounded dash cooldown.
export function shouldDash(w){
 const p=w.player;if(w.status!=='playing'||p.dashCooldown>0)return false;
 if(w.campaign.exit&&distance(w.campaign.exit,p)<140&&distance(w.campaign.exit,p)>32)return true;
 return w.enemies.some(e=>e.hp>0&&!e.arrival&&distance(e,p)<e.radius+40)||w.enemyProjectiles.some(b=>Math.hypot(p.x-b.x-b.vx*.2,p.y-b.y-b.vy*.2)<40)||w.effects.some(e=>e.kind==='enemy-target'&&distance(e,p)<(e.r||65)+15);
}
