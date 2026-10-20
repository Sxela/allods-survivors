import {wavePlan} from '../survivors/campaign.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {World,random,enemyFootprint} from '../survivors/core.mjs';
import {MAP_ARENAS,selectMapRoute,arenaBounds,arenaHeight,arenaWalkable,arenaCell,nativeSpawn,arenaDirection,setActiveArena,nativeHeightAt,nativeTileAt} from '../survivors/map-arenas.mjs';
import {MONSTERS} from '../survivors/monsters.mjs';

test('all eligible maps retain bounded original tiles, heights, crop origins and connected floor',()=>{
 assert.ok(MAP_ARENAS.length>100);const ids=new Set();
 for(const a of MAP_ARENAS){assert.ok(!ids.has(a.id));ids.add(a.id);assert.ok(a.width<=48&&a.height<=40);assert.equal(a.tiles.length,a.width*a.height);assert.equal(a.heights.length,a.tiles.length);assert.equal(a.floor.length,a.tiles.length);assert.match(a.sourceHash,/^[a-f0-9]{64}$/);assert.ok(a.origin[0]+a.width<=a.sourceSize[0]&&a.origin[1]+a.height<=a.sourceSize[1]);assert.ok(a.tiles.every(t=>Number.isInteger(t)&&t>=0&&t<1024));assert.ok(a.heights.every(h=>Number.isInteger(h)&&h>=-128&&h<=127));assert.ok(arenaWalkable(a,0,0,32));assert.ok(a.roster.length&&a.roster.every(id=>MONSTERS[id]?.hostile));
  const seen=new Set([a.spawn]),q=[a.spawn];for(let n=0;n<q.length;n++){const i=q[n],x=i%a.width,y=Math.floor(i/a.width);for(const j of [x?i-1:-1,x<a.width-1?i+1:-1,y?i-a.width:-1,y<a.height-1?i+a.width:-1])if(j>=0&&a.floor[j]&&!seen.has(j)){seen.add(j);q.push(j);}}
  assert.equal(seen.size,a.floor.reduce((n,v)=>n+v,0),a.id);assert.ok(seen.size>=a.tiles.length*.8);assert.ok(a.props.length<=64);
 }
});
test('routes are deterministic, include more than five maps, and all-map mode visits every eligible map once',()=>{
 assert.deepEqual(selectMapRoute(random(42)),selectMapRoute(random(42)));assert.equal(selectMapRoute(random(42)).length,12);assert.notDeepEqual(selectMapRoute(random(42)),selectMapRoute(random(43)));const all=selectMapRoute(random(7),Infinity);assert.equal(all.length,MAP_ARENAS.length);assert.equal(new Set(all).size,all.length);
});
test('native spawns stay on reachable floor inside the crop on desktop, portrait and zoomed views',()=>{
 for(const a of MAP_ARENAS){const w=new World({campaign:true,seed:42});w.campaign.route=[a.id];w.campaign.mapId=a.id;w.campaign.index=0;w.skills={};w.campaign.waveTimer=Infinity;
  for(const viewport of [{width:640,height:536},{width:600,height:1218},{width:300,height:609}]){w.setViewport(viewport.width,viewport.height);for(const type of ['wolf','dragon']){const radius=type==='dragon'?32:14,p=nativeSpawn(w,enemyFootprint(type),radius);assert.ok(arenaWalkable(a,p.x,p.y,radius),a.id);const bounds=arenaBounds(a);assert.ok(p.x>=bounds.left&&p.x<bounds.right&&p.y>=bounds.top&&p.y<bounds.bottom);if(p.arrival)assert.ok(Math.hypot(p.x,p.y)>100,a.id);else{const shape=enemyFootprint(type),y=p.y-arenaHeight(a,p.x,p.y)+arenaHeight(a,0,0);assert.ok(p.x-shape.halfWidth>viewport.width/2+10||p.x+shape.halfWidth<-viewport.width/2-10||y-shape.above>viewport.height/2+10||y+shape.below<-viewport.height/2-10,a.id+' projected offscreen spawn');}}}
  const point=nativeSpawn(w,enemyFootprint('wolf'),14);assert.ok(arenaDirection(w,{...point,radius:14})||Math.hypot(point.x,point.y)<40,a.id);
  const b=arenaBounds(a);w.player.x=b.right-1;w.player.y=b.bottom-1;assert.ok(!arenaWalkable(a,w.player.x,w.player.y,12));
 }
});
test('native tile and height rendering use the selected source crop and return to procedural terrain explicitly',()=>{
 const w=new World({campaign:true,seed:42}),a=MAP_ARENAS.find(a=>a.id===w.campaign.mapId);setActiveArena(w);assert.equal(nativeTileAt(0,0),a.tiles[a.spawn]);assert.ok(Number.isFinite(nativeHeightAt(0,0)));assert.equal(nativeTileAt(100000,100000),-1);setActiveArena(null);assert.equal(nativeHeightAt(0,0),null);assert.equal(nativeTileAt(0,0),null);
});
test('long native routes preserve the actual region after area five when saved and continued',async()=>{
 const {snapshotRun,restoreRun}=await import('../survivors/run-state.mjs');const w=new World({campaign:true,seed:42});w.campaign.index=7;w.campaign.mapId=w.campaign.route[7];const restored=restoreRun(snapshotRun(w));assert.ok(restored);assert.equal(restored.campaign.index,7);assert.equal(restored.campaign.mapId,w.campaign.mapId);assert.deepEqual(restored.campaign.route,w.campaign.route);
});
test('all-region pressure is bounded by route progress instead of the absolute map index',()=>{
 for(const count of [12,Infinity]){const w=new World({campaign:true,seed:42,areaCount:count});w.campaign.index=w.campaign.route.length-1;w.campaign.mapId=w.campaign.route[w.campaign.index];w.skills={};w.player.invulnerable=10000;w.step(.05);const plan=wavePlan(w,1),spawnedCount=w.enemies.length+w.campaign.queue.length;assert.equal(plan.min,45);assert.equal(plan.max,60);assert.ok(spawnedCount>=plan.min&&spawnedCount<=plan.max);assert.ok(w.terrainTime<600);}
});
