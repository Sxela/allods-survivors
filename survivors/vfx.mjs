export const LIGHTNING_CORE_SCALE=.72;
export const LIGHTNING_SPRITE_SPACING=16*LIGHTNING_CORE_SCALE*.5;
export function lightningPath(x,y,x2,y2,time=0){
  const dx=x2-x,dy=y2-y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,steps=Math.max(2,Math.ceil(length/2));
  const curve=Array.from({length:steps+1},(_,i)=>{
    const t=i/steps,bow=Math.sin(t*Math.PI)*Math.min(38,length*.13),ripple=Math.sin(t*Math.PI*3-time*5)*Math.sin(t*Math.PI)*Math.min(5,length*.018);
    return {x:x+dx*t+nx*(bow+ripple),y:y+dy*t+ny*(bow+ripple)};
  });
  const points=[curve[0]];let gap=LIGHTNING_SPRITE_SPACING;
  for(let i=1;i<curve.length;i++){
    let start=curve[i-1];const end=curve[i];let distance=Math.hypot(end.x-start.x,end.y-start.y);
    while(distance>=gap){const t=gap/distance;start={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};points.push(start);distance=Math.hypot(end.x-start.x,end.y-start.y);gap=LIGHTNING_SPRITE_SPACING;}
    gap-=distance;
  }
  const end=curve.at(-1);if(Math.hypot(points.at(-1).x-end.x,points.at(-1).y-end.y)>1e-6)points.push(end);
  return points;
}
// Render original Allods effect frames; no synthetic replacement spell artwork.
export function sampleVfx(effect,{time=0,progress=null,dx=0,dy=1}={}) {
  const phases=effect.phases||effect.count;
  const phase=progress===null?Math.floor(Math.max(0,time)*(effect.fps||18))%phases:Math.min(phases-1,Math.floor(Math.max(0,Math.min(1,progress))*phases));
  let group=0,flipX=false;
  if(effect.directionMapping){
    const count=effect.directionMapping.fullDirections;
    const direction=(Math.round((Math.atan2(dy,dx)-Math.PI/2)*count/(Math.PI*2))+count)%count;
    flipX=direction>effect.directionMapping.mirrorHorizontalAfter;
    group=flipX?count-direction:direction;
  }
  const index=group*phases+phase;
  return {index,frame:effect.frames[index],flipX};
}

export class VfxRenderer {
  constructor(ctx,effects,images){this.ctx=ctx;this.effects=effects;this.images=images;this.used=new Set();}
  draw(id,x,y,options={}) {
    const effect=this.effects[id],image=this.images[`vfx:${id}`];if(!effect||!image)return false;
    const {frame,flipX}=sampleVfx(effect,options);if(!frame)return false;
    const {ctx}=this,scale=options.scale??1;
    ctx.save();ctx.globalAlpha*=options.alpha??1;ctx.globalCompositeOperation=options.blend||'source-over';
    ctx.translate(Math.round(x),Math.round(y));if(flipX)ctx.scale(-1,1);
    ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,-frame.anchorX*scale,-frame.anchorY*scale,frame.w*scale,frame.h*scale);
    ctx.restore();this.used.add(id);return true;
  }
  chain(x,y,x2,y2,time,progress,id='lightning') {
    const points=lightningPath(x,y,x2,y2,time),fade=Math.min(1,(1-progress)*3);
    // A single continuous curved ribbon, built from the source particles.
    for(let i=0;i<points.length;i++){
      const point=points[i];
      this.draw(id,point.x,point.y,{time:time+i*.018,scale:1.425,alpha:fade*.18,blend:'screen'});
      this.draw(id,point.x,point.y,{time:time+i*.018,scale:LIGHTNING_CORE_SCALE,alpha:fade*.9,blend:'screen'});
    }
    this.draw(id,x2,y2,{time,scale:1.875,alpha:fade,blend:'screen'});
  }
  nova(x,y,r,progress,time) {
    // Combine the original cyan freeze cloud and ice/dust wavefronts. Normal
    // alpha preserves the cloud; screen blending keeps dense particles from
    // clipping to white as repeated additive stamps do.
    this.draw('frost',x,y,{progress,scale:r/45,alpha:.22*(1-progress)});
    const radius=r*(.1+progress*.9),count=Math.max(40,Math.ceil(Math.PI*2*radius/7)),fade=Math.min(1,(1-progress)*4);
    for(let ring=0;ring<3;ring++)for(let i=0;i<count;i++){const angle=(i+ring*.37)*Math.PI*2/count,rr=Math.max(0,radius-ring*9),jitter=Math.sin(i*2.3+ring)*3;
      const px=x+Math.cos(angle)*(rr+jitter),py=y+Math.sin(angle)*(rr+jitter)*.8;
      this.draw(ring===0?'ice':'ice_dust',px,py,{time:time+i*.023+ring*.07,scale:ring===0?1.35:1,alpha:fade*(.65-ring*.17),blend:'screen'});
    }
    this.draw('ice_dust',x,y,{progress,scale:2,alpha:(1-progress)*.7,blend:'lighter'});
  }
  poison(x,y,r,time,alpha=1) {
    // Several original clouds cover the actual damaging field, rather than a
    // flat green ellipse. Source colors and animation remain unchanged.
    this.draw('poison',x,y,{time,scale:r/32,alpha});
    for(let i=0;i<6;i++){const a=i*Math.PI/3;
      this.draw('poison',x+Math.cos(a)*r*.48,y+Math.sin(a)*r*.48,{time:time+i*.13,scale:r/42,alpha:alpha*.8});
      this.draw('poison_hit',x+Math.cos(a+time*.2)*r*.68,y+Math.sin(a+time*.2)*r*.68,{time:time+i*.11,scale:1.3,alpha});
    }
  }
}
