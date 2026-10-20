import {MAP_ARENAS} from './map-arenas-data.mjs';
import {MONSTERS} from './monsters.mjs';
export {MAP_ARENAS};
export const NATIVE_SCENERY_IDS=[...new Set(MAP_ARENAS.flatMap(a=>a.props.map(p=>p.id)))];
export const DEFAULT_AREA_COUNT=12;
const byId=new Map(MAP_ARENAS.map(a=>[a.id,a]));
const strength=a=>a.roster.reduce((n,id)=>n+(MONSTERS[id]?.tier||0),0)/a.roster.length;
export function selectMapRoute(rng,count=DEFAULT_AREA_COUNT){
  const ordered=[...MAP_ARENAS].sort((a,b)=>strength(a)-strength(b)||a.id.localeCompare(b.id)),n=Math.min(ordered.length,Number.isFinite(count)?Math.max(1,Math.floor(count)):ordered.length),route=[];
  for(let i=0;i<n;i++){const lo=Math.floor(i*ordered.length/n),hi=Math.floor((i+1)*ordered.length/n);route.push(ordered[lo+Math.floor(rng()*(hi-lo))].id);}
  return route;
}
export function arenaFor(world){return world?.campaign?byId.get(world.campaign.mapId)||byId.get(world.campaign.route?.[world.campaign.index]):null;}
export function arenaById(id){return byId.get(id)||null;}
const anchor=a=>({x:(a.spawn%a.width+.5)*32,y:(Math.floor(a.spawn/a.width)+.5)*32});
export function arenaBounds(a){const o=anchor(a);return {left:-o.x,top:-o.y,right:a.width*32-o.x,bottom:a.height*32-o.y};}
export function arenaWithin(a,x,y,radius=12){if(!a)return true;const b=arenaBounds(a);return x-radius>=b.left&&x+radius<b.right&&y-radius>=b.top&&y+radius<b.bottom;}
export function arenaCell(a,x,y){const o=anchor(a),cx=Math.floor((x+o.x)/32),cy=Math.floor((y+o.y)/32);return cx<0||cy<0||cx>=a.width||cy>=a.height?-1:cy*a.width+cx;}
export function cellPosition(a,i){const o=anchor(a);return {x:(i%a.width+.5)*32-o.x,y:(Math.floor(i/a.width)+.5)*32-o.y};}
export function arenaWalkable(a,x,y,radius=12){
  if(!a)return true;
  for(const [dx,dy] of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius],[-radius*.71,-radius*.71],[radius*.71,-radius*.71],[-radius*.71,radius*.71],[radius*.71,radius*.71]]){const i=arenaCell(a,x+dx,y+dy);if(i<0||!a.floor[i])return false;}
  return true;
}
const floorCache=new Map();
function floorCells(a,radius){const key=a.id+':'+radius;if(!floorCache.has(key))floorCache.set(key,a.floor.flatMap((v,i)=>v&&arenaWalkable(a,...Object.values(cellPosition(a,i)),radius)?[i]:[]));return floorCache.get(key);}
export function safeArenaPoint(world,point,radius=12){
  const a=arenaFor(world);if(!a||arenaWalkable(a,point.x,point.y,radius))return {...point};
  const cells=floorCells(a,radius);let best=null,d=Infinity;
  for(const i of cells){const p=cellPosition(a,i),n=(p.x-point.x)**2+(p.y-point.y)**2;if(n<d){best=p;d=n;}}
  return best||{x:0,y:0};
}
export function nativeSpawn(world,shape,radius=14){
  const a=arenaFor(world);if(!a)return null;
  const cells=floorCells(a,radius),p=world.player,v=world.viewport;const angle=world.rng()*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle),edge=Math.min((v.width/2+shape.halfWidth+16)/Math.abs(dx),(v.height/2+(dy<0?shape.below:shape.above)+16)/Math.abs(dy)),desired={x:dx*edge,y:dy*edge};
  let fallback=null,best=0,nearby=null,nearest=Infinity;
  for(let n=0;n<100;n++){
    const point=cellPosition(a,cells[Math.floor(world.rng()*cells.length)]),x=point.x-p.x,y=point.y-arenaHeight(a,point.x,point.y)-(p.y-arenaHeight(a,p.x,p.y)),d=Math.hypot(point.x-p.x,point.y-p.y);
    if(d>best){best=d;fallback=point;}
    if((x-shape.halfWidth>v.width/2+12||x+shape.halfWidth<-v.width/2-12||y-shape.above>v.height/2+12||y+shape.below<-v.height/2-12)&&(x-desired.x)**2+(y-desired.y)**2<nearest){nearest=(x-desired.x)**2+(y-desired.y)**2;nearby=point;}
  }
  if(nearby)return nearby;
  // A bounded arena can be entirely visible. Announce an arrival instead of contact spawning.
  return {...(fallback||{x:0,y:0}),arrival:.8};
}
const flowCache=new WeakMap();
export function arenaDirection(world,entity,target=world.player){
  const a=arenaFor(world);if(!a)return null;
  const radius=entity.radius>16?32:14,goal=arenaCell(a,target.x,target.y),key=a.id+':'+goal+':'+radius;
  let cache=flowCache.get(world);if(!cache){cache=new Map();flowCache.set(world,cache);}
  let flow=cache.get(key);
  if(!flow){
    if(cache.size>4)cache.clear();flow=new Int32Array(a.floor.length).fill(-1);const queue=[goal];flow[goal]=0;
    for(let q=0;q<queue.length;q++){const i=queue[q],x=i%a.width,y=Math.floor(i/a.width);for(const j of [x?i-1:-1,x<a.width-1?i+1:-1,y?i-a.width:-1,y<a.height-1?i+a.width:-1]){if(j<0||flow[j]>=0||!a.floor[j])continue;const p=cellPosition(a,j);if(!arenaWalkable(a,p.x,p.y,radius))continue;flow[j]=flow[i]+1;queue.push(j);}}
    cache.set(key,flow);
  }
  const i=arenaCell(a,entity.x,entity.y);if(i<0)return null;const x=i%a.width,y=Math.floor(i/a.width);let best=i;
  for(const j of [x?i-1:-1,x<a.width-1?i+1:-1,y?i-a.width:-1,y<a.height-1?i+a.width:-1])if(j>=0&&flow[j]>=0&&(flow[best]<0||flow[j]<flow[best]))best=j;
  return best===i?null:cellPosition(a,best);
}

let activeArena=null;
export function setActiveArena(world){activeArena=arenaFor(world);return activeArena;}
export function nativeTileAt(x,y){if(!activeArena)return null;const i=arenaCell(activeArena,x,y);return i<0?-1:activeArena.tiles[i];}
export function arenaHeight(a,x,y){
  if(!a)return null;const o=anchor(a),gx=(x+o.x)/32,gy=(y+o.y)/32,ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy;
  const h=(x,y)=>a.heights[Math.min(a.height-1,Math.max(0,y))*a.width+Math.min(a.width-1,Math.max(0,x))];
  return h(ix,iy)*(1-u)*(1-v)+h(ix+1,iy)*u*(1-v)+h(ix,iy+1)*(1-u)*v+h(ix+1,iy+1)*u*v;
}
export function nativeHeightAt(x,y){return arenaHeight(activeArena,x,y);}
export function nativeDecorations(view){if(!activeArena)return null;const a=activeArena,o=anchor(a);return a.props.map(p=>({...p,x:p.x+a.width*16-o.x,y:p.y+a.height*16-o.y,frame:0,prop:true})).filter(p=>p.x>view.left-150&&p.x<view.right+150&&p.y>view.top-50&&p.y<view.bottom+200);}
