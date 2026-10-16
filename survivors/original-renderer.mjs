import {SPELLS} from './original-spells.mjs';
export function blizzardParticles(field,time){
  return Array.from({length:36},(_,i)=>{
    const angle=i*2.399963,r=Math.sqrt((i+.5)/36)*field.r;
    const phase=(time*(1.15+(i%5)*.09)+i*.61803398875)%1;
    const impactX=field.x+Math.cos(angle)*r,impactY=field.y+Math.sin(angle)*r;
    const height=(1-phase)*(110+(i%4)*12);
    return {x:impactX-height*.28,y:impactY-height,impactX,impactY,phase,scale:1.1+(i%3)*.3};
  });
}
export function drawPlayerShield(vfx,player,time,metrics={height:62,width:40}){
  const shield=player.statuses?.shield;if(!(shield?.ttl>0&&shield.pool>0))return false;
  const ctx=vfx.ctx,cx=player.x,cy=player.y-metrics.height/2,rx=Math.max(24,metrics.width*.5+8),ry=metrics.height/2+9;
  ctx.save();ctx.strokeStyle='#d0e2ee99';ctx.lineWidth=1.2;ctx.fillStyle='#b3d7ef0c';ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  // The source Shield is a faint 12px particle, not a complete body-sized
  // effect. Repeat its own frames over a shell without tinting the artwork.
  for(let i=0;i<28;i++){
    const a=i*Math.PI*2/28+time*.32,x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    for(let layer=0;layer<2;layer++)vfx.draw('shield',x,y,{time:time+i*.09,scale:2.2,alpha:.95,blend:'lighter'});
  }
  for(let i=0;i<10;i++){const a=i*2.399+time*.7;vfx.draw('shield',cx+Math.cos(a)*rx*.65,cy+Math.sin(a)*ry*.65,{time:time+i*.15,scale:1.6,alpha:.8,blend:'lighter'});}
  return true;
}
export function drawSpellFields(vfx,w){
  for(const f of [...w.fields,...(w.enemyFields||[])]){
    if(f.enemy){const ctx=vfx.ctx;ctx.save();ctx.strokeStyle='#dc786777';ctx.lineWidth=1.5;ctx.beginPath();if(f.kind==='firewall'){ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);}else ctx.ellipse(f.x,f.y,f.r,f.r*.65,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(f.kind==='poison'){vfx.poison(f.x,f.y,f.r,w.time,Math.min(1,f.ttl));continue;}
    if(f.kind==='firewall'||f.kind==='earthwall'){
      const length=Math.hypot(f.x2-f.x1,f.y2-f.y1),count=Math.ceil(length/18);
      for(let i=0;i<=count;i++)vfx.draw(f.vfx,f.x1+(f.x2-f.x1)*i/count,f.y1+(f.y2-f.y1)*i/count,{time:w.time+i*.08,scale:f.kind==='earthwall'?1:1.6});
    }else if(f.kind==='frost'){
      vfx.draw('frost',f.x,f.y,{time:w.time,scale:f.r/40,alpha:.3});
    }
  }
}
export function drawSpellEffects(vfx,w,metrics){
  // Airborne crystals render over actors; the mist remains on the ground.
  for(const f of w.fields)if(f.kind==='frost')for(const ice of blizzardParticles(f,w.time)){
    const alpha=Math.min(1,f.ttl*3,ice.phase*8);
    for(let tail=2;tail>0;tail--)vfx.draw('ice',ice.x-tail*3,ice.y-tail*11,{time:w.time,scale:ice.scale*.65,alpha:alpha*(.45-tail*.1),blend:'screen'});
    vfx.draw('ice',ice.x,ice.y,{time:w.time,scale:ice.scale,alpha,blend:'screen'});
    if(ice.phase>.8)vfx.draw('ice_dust',ice.impactX,ice.impactY,{progress:(ice.phase-.8)/.2,scale:1.4,alpha:Math.min(1,f.ttl*3),blend:'screen'});
  }
  for(const b of w.projectiles)vfx.draw(b.vfx||'firebolt',b.x,b.y-12,{time:w.time,dx:b.vx,dy:b.vy});
  for(const b of w.enemyProjectiles)vfx.draw(b.vfx||'stone',b.x,b.y-12,{time:w.time,dx:b.vx,dy:b.vy});
  for(const e of w.effects){
    const progress=1-e.ttl/e.maxTtl;
    if(e.kind==='lightning')vfx.chain(e.x,e.y,e.x2,e.y2,w.time,progress);
    else if(e.kind==='chain')vfx.chain(e.x,e.y,e.x2,e.y2,w.time,progress,'chain');
    else if(e.kind==='drain'){
      const n=Math.max(2,Math.ceil(Math.hypot(e.x2-e.x,e.y2-e.y)/18));
      for(let i=0;i<=n;i++)vfx.draw('drain',e.x+(e.x2-e.x)*i/n,e.y+(e.y2-e.y)*i/n,{time:w.time+i*.07,scale:.7,alpha:1-progress});
    }else if(e.kind==='melee')vfx.draw('bless',e.x,e.y-15,{progress,scale:.6});
    else vfx.draw(e.vfx||e.kind,e.x,e.y-12,{progress,scale:e.r?e.r/40:1.5,alpha:Math.min(1,e.ttl*4)});
  }
  for(const [id,status] of Object.entries(w.player.statuses||{})){
    if(status.ttl<=0||id==='invisibility'||id==='shield'&&status.pool<=0)continue;
    if(id==='shield'){drawPlayerShield(vfx,w.player,w.time,metrics);continue;}
    const spell=SPELLS[id];if(spell)vfx.draw(spell.vfx,w.player.x,w.player.y-18,{time:w.time,scale:1.5,alpha:.65});
  }
  for(const e of w.enemies){
    if(e.statuses.shield?.ttl>0&&e.statuses.shield.pool>0)vfx.draw('shield',e.x,e.y-25,{time:w.time,scale:4,alpha:1,blend:'screen'});
    if(e.statuses.stonecurse?.ttl>0)vfx.draw('curse',e.x,e.y-16,{time:w.time,scale:1.3,alpha:.7});
    if(e.statuses.poison?.ttl>0)vfx.draw('poison_hit',e.x,e.y-8,{time:w.time,alpha:.7});
  }
}
