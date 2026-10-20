import {nativeHeightAt,nativeDecorations,nativeTileAt} from './map-arenas.mjs';
import {terrainHash} from './biomes.mjs';
export const SCENERY_IDS=['oak1','oak2','elka1','bush1','stones','bones','column','statue','henge1','drtree1','pine1','iva1','scenery-altar1','scenery-bhut1','scenery-bighouse1','scenery-ruins1'];
export const LANDSCAPE_TERRAIN=['ground_water','native-terrain'];
export const LAKE_MAX_RADIUS=76;
export function landscapeFeatures(view){if(nativeTileAt(0,0)!==null)return [];
  const features=[{kind:'hill',x:-240,y:-60,rx:310,ry:240,height:105}],cell=640;
  for(let cy=Math.floor(view.top/cell)-1;cy<=Math.floor(view.bottom/cell)+1;cy++)for(let cx=Math.floor(view.left/cell)-1;cx<=Math.floor(view.right/cell)+1;cx++){
    const x=cx*cell+150+terrainHash(cx+91,cy+43)*340,y=cy*cell+150+terrainHash(cx-43,cy+71)*340;
    if(Math.hypot(x,y)<210)continue;
    const roll=terrainHash(cx+411,cy-93);
    if(roll<.31)features.push({kind:'lake',x,y,rx:44+terrainHash(cx+3,cy)*32,ry:32+terrainHash(cx,cy+7)*22,phase:terrainHash(cx,cy)*6});
    else if(roll<.78)features.push({kind:'hill',x,y,rx:300+terrainHash(cx+13,cy)*140,ry:230+terrainHash(cx,cy+19)*110,height:terrainHash(cx+8,cy+3)<.25?-46:55+terrainHash(cx+6,cy)*35});
  }
  return features.filter(f=>f.x+f.rx+20>view.left&&f.x-f.rx-20<view.right&&f.y+f.ry+20>view.top&&f.y-f.ry-20<view.bottom);
}
export function decorations(view){const native=nativeDecorations(view);if(native)return native;
  const objects=[],cell=224;
  for(let cy=Math.floor(view.top/cell)-1;cy<=Math.floor(view.bottom/cell)+1;cy++)for(let cx=Math.floor(view.left/cell)-1;cx<=Math.floor(view.right/cell)+1;cx++){
    const roll=terrainHash(cx+11,cy+29);if(roll>.25)continue;
    const x=cx*cell+40+terrainHash(cx+9,cy)*144,y=cy*cell+40+terrainHash(cx,cy+3)*144;if(Math.hypot(x,y)<180)continue;
    const pick=terrainHash(cx+22,cy+37),building=pick>.91;
    const id=building?SCENERY_IDS[12+Math.floor(terrainHash(cx,cy+99)*4)]:SCENERY_IDS[Math.floor(pick/.91*12)];
    objects.push({id,x,y,frame:0,prop:true,scale:building?.72:1,alpha:building?.78:1});
  }
  return objects;
}
function lakePath(ctx,f){ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,wave=1+.07*Math.sin(a*3+f.phase)+.04*Math.cos(a*5-f.phase),x=f.x+Math.cos(a)*f.rx*wave,y=f.y+Math.sin(a)*f.ry*wave;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
export function drawLandscape(ctx,view,images){
  for(const f of landscapeFeatures(view)){
    if(f.kind==='lake'){
      ctx.save();lakePath(ctx,f);ctx.lineWidth=12;ctx.strokeStyle='#635c3c70';ctx.stroke();ctx.clip();
      for(let ty=Math.floor((f.y-f.ry-8)/32);ty<=Math.floor((f.y+f.ry+8)/32);ty++)for(let tx=Math.floor((f.x-f.rx-8)/32);tx<=Math.floor((f.x+f.rx+8)/32);tx++){const img=images.ground_water;if(img)ctx.drawImage(img,Math.floor(terrainHash(tx,ty)*4)*32,0,32,32,tx*32,ty*32,32,32);}
      const edge=ctx.createRadialGradient(f.x-12,f.y-10,5,f.x,f.y,f.rx);edge.addColorStop(0,'#397ea60a');edge.addColorStop(.72,'#6b9c9a14');edge.addColorStop(1,'#b3a87255');ctx.fillStyle=edge;ctx.fillRect(f.x-f.rx-8,f.y-f.ry-8,f.rx*2+16,f.ry*2+16);ctx.restore();
    }
  }
}

// Visual relief only: simulation coordinates and navigation remain unchanged.
export const ELEVATION_PADDING=192;
function smoothNoise(x,y,cell){
  const cx=Math.floor(x/cell),cy=Math.floor(y/cell),u=x/cell-cx,v=y/cell-cy;
  const ease=t=>t*t*t*(t*(t*6-15)+10),a=ease(u),b=ease(v),mix=(x,y,t)=>x+(y-x)*t;
  return mix(mix(terrainHash(cx,cy),terrainHash(cx+1,cy),a),mix(terrainHash(cx,cy+1),terrainHash(cx+1,cy+1),a),b)*2-1;
}
export const TERRAIN_MESH_STEP=16;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
function heightAt(x,y){const native=nativeHeightAt(x,y);if(native!==null)return native;
  const features=landscapeFeatures({left:x-220,right:x+220,top:y-220,bottom:y+220});
  let height=38*smoothNoise(x,y,640)+16*smoothNoise(x+731,y-413,280),water=1;
  for(const f of features){const d=Math.hypot((x-f.x)/f.rx,(y-f.y)/f.ry);
    if(f.kind==='hill'&&d<1)height+=f.height*(1-d*d)**3;
    if(f.kind==='lake')water=Math.min(water,smooth((d-1.12)*Math.min(f.rx,f.ry)/150));
  }
  return height*water*smooth(Math.hypot(x,y)/320)||0;
}
// Identical triangle interpolation for sprite feet and the rendered surface.
export function terrainElevation(x,y){
  const step=TERRAIN_MESH_STEP,gx=Math.floor(x/step)*step,gy=Math.floor(y/step)*step,u=(x-gx)/step,v=(y-gy)/step;
  const tl=heightAt(gx,gy),tr=heightAt(gx+step,gy),bl=heightAt(gx,gy+step);
  if(u+v<=1)return tl+(tr-tl)*u+(bl-tl)*v;
  const br=heightAt(gx+step,gy+step);return br+(bl-br)*(1-u)+(tr-br)*(1-v);
}
export function terrainNormal(x,y){
  const dx=(heightAt(x+8,y)-heightAt(x-8,y))/16,dy=(heightAt(x,y+8)-heightAt(x,y-8))/16,length=Math.hypot(dx,dy,1);
  return [-dx/length,-dy/length,1/length];
}
export function elevatedPoint(point){
  const result={...point,y:point.y-terrainElevation(point.x,point.y)};
  if(Number.isFinite(point.x1))result.y1=point.y1-terrainElevation(point.x1,point.y1);
  if(Number.isFinite(point.x2))result.y2=point.y2-terrainElevation(point.x2,point.y2);
  return result;
}
export function elevatedWorld(world){
  const actor=p=>({...elevatedPoint(p),ground:{x:p.x,y:p.y}});
  const result={...world,player:actor(world.player)};
  for(const key of ['enemies','allies','neutrals','corpses','lootDrops','powerups','gems','fields','enemyFields','projectiles','enemyProjectiles','effects'])result[key]=(world[key]||[]).map(['enemies','allies','neutrals'].includes(key)?actor:elevatedPoint);
  return result;
}
// Cache a continuous triangular mesh. Adjacent chunks share boundary samples.
export function reliefChunk(source,cx,cy,createCanvas){
  const size=source.width,pad=ELEVATION_PADDING,out=createCanvas(size,size+pad*2),g=out.getContext('2d');g.imageSmoothingEnabled=false;
  const step=16;
  for(let y=0;y<size;y+=step)for(let x=0;x<size;x+=step){
    const z=(a,b)=>terrainElevation(cx*size+a,cy*size+b),tl=z(x,y),tr=z(x+step,y),bl=z(x,y+step),br=z(x+step,y+step);
    for(const upper of [true,false]){
      const hx=(upper?tr-tl:br-bl)/step,hy=(upper?bl-tl:br-tr)/step;
      const offset=upper?tl:tr+bl-br;
      g.save();g.beginPath();
      const points=upper?[[x,y,tl],[x+step,y,tr],[x,y+step,bl]]:[[x+step,y,tr],[x+step,y+step,br],[x,y+step,bl]];
      const mx=points.reduce((s,p)=>s+p[0],0)/3,my=points.reduce((s,p)=>s+p[1]-p[2]+pad,0)/3;
      points.forEach(([a,b,h],i)=>{const py=b-h+pad,dx=a-mx,dy=py-my,d=Math.hypot(dx,dy),px=a+dx/d*.55,qy=py+dy/d*.55;i?g.lineTo(px,qy):g.moveTo(px,qy);});g.closePath();g.clip();
      g.transform(1,-hx,0,1-hy,0,pad-offset+hx*x+hy*y);g.drawImage(source,0,0);
      const light=Math.max(-.22,Math.min(.22,(hx+hy)*.65));g.fillStyle=light>0?`rgba(245,228,174,${light})`:`rgba(3,12,24,${-light})`;g.fillRect(0,0,size,size);g.restore();
    }
  }
  return out;
}
