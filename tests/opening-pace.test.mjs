import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World,ENEMY_SPRITES,enemyFootprint} from '../survivors/core.mjs';
import {pickupGuides} from '../survivors/pickup-guides.mjs';
const manifest=JSON.parse(readFileSync(new URL('../survivors/assets/manifest.json',import.meta.url),'utf8'));
test('spawn footprints match the rendered Allods sprite atlases',()=>{for(const [id,dimensions]of Object.entries(ENEMY_SPRITES))assert.deepEqual(dimensions,[manifest.sprites[{skeleton:'skeleton_f1',zombie:'zombie_f1'}[id]||id].cellWidth,manifest.sprites[{skeleton:'skeleton_f1',zombie:'zombie_f1'}[id]||id].cellHeight]);});
test('opening provides eight enemies immediately and fills a bounded nearby horde quickly',()=>{
  const w=new World({seed:42});w.skills={};w.player.invulnerable=100;w.step(.025);assert.equal(w.enemies.length,8);
  for(let i=0;i<160;i++)w.step(.025);assert.ok(w.enemies.length>=18&&w.enemies.length<=20);
  assert.ok(w.enemies.some(e=>Math.abs(e.x-w.player.x)<400&&Math.abs(e.y-w.player.y)<300),'enemies reach the screen within four seconds');
  for(let i=0;i<400;i++)w.step(.025);assert.ok(w.enemies.length<25,'opening pressure is bounded instead of infinite packs');
});
test('spawn art starts within a small gap of the screen across all edges, types and boss scales',()=>{
  const w=new World({seed:8128});
  for(const type of Object.keys(ENEMY_SPRITES))for(const boss of [false,true])for(let n=0;n<100;n++){
    const e=w.spawn(type,boss),s=enemyFootprint(type,boss),dx=e.x-w.player.x,dy=e.y-w.player.y;
    const gaps=[dx-s.halfWidth-400,-dx-s.halfWidth-400,dy-s.above-300,-dy-s.below-300].filter(d=>d>=0);
    assert.ok(gaps.length);assert.ok(Math.min(...gaps)<29,'whole sprite starts at most 28 pixels from a visible edge');
  }
});
test('pickup guidance points to offscreen loot, XP and needed healing inside HUD margins',()=>{
  const w=new World({seed:1});w.player.hp=50;w.lootDrops=[{x:700,y:0,item:{rarity:'rare'}}];w.gems=[{x:-650,y:0,type:'xp'},{x:0,y:-500,type:'heal'},{x:0,y:0,type:'xp'}];
  const guides=pickupGuides(w,{width:800,height:600});assert.deepEqual(guides.map(g=>g.kind),['loot','xp','heal']);
  assert.ok(guides.find(g=>g.kind==='loot').x>700);assert.ok(guides.find(g=>g.kind==='xp').x<100);assert.equal(guides.find(g=>g.kind==='heal').y,88);
  for(const p of guides){assert.ok(p.x>=24&&p.x<=776);assert.ok(p.y>=88&&p.y<=488);}
  w.player.hp=w.player.maxHp;assert.ok(!pickupGuides(w,{width:800,height:600}).some(g=>g.kind==='heal'));
});
test('visible pickups have no edge arrow and distant pickups do not clutter the view',()=>{const w=new World();w.lootDrops=[{x:50,y:0,item:{rarity:'magic'}},{x:2000,y:0,item:{rarity:'rare'}}];assert.deepEqual(pickupGuides(w,{width:800,height:600}),[]);});
