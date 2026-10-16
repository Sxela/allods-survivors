import test from 'node:test';
import assert from 'node:assert/strict';
import {lightningPath,VfxRenderer} from '../survivors/vfx.mjs';
import {World} from '../survivors/core.mjs';
test('lightning is a dense smooth curved path with anchored endpoints and no separate forks',()=>{
  const path=lightningPath(10,20,310,20,1);assert.deepEqual(path[0],{x:10,y:20});assert.ok(Math.hypot(path.at(-1).x-310,path.at(-1).y-20)<1e-8);assert.ok(path.some(p=>p.y>45));
  for(let i=1;i<path.length;i++){assert.ok(path[i].x>=path[i-1].x);assert.ok(Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y)<7);}
  const calls=[],renderer=new VfxRenderer({}, {}, {});renderer.draw=(id,x,y)=>calls.push({id,x,y});renderer.chain(10,20,310,20,1,.2);
  assert.equal(calls.length,path.length*2+1);assert.ok(calls.every(c=>c.id==='lightning'));
});
test('Lightning strikes one target; Prismatic Spray emits simultaneous independent caster-to-enemy beams',()=>{
  for(const [spell,count] of [['lightning',1],['prismatic',3]]){
    const w=new World();for(let i=0;i<4;i++){const e=w.spawn('wolf');Object.assign(e,{x:100+i*30,y:i*30,hp:1000,maxHp:1000});}
    assert.equal(w.cast(spell,1),true);assert.equal(w.effects.length,count);assert.equal(w.enemies.filter(e=>e.hp<1000).length,count);
    for(const beam of w.effects){assert.equal(beam.x,w.player.x);assert.equal(beam.y,w.player.y-15);assert.equal(beam.ttl,.35);assert.equal(beam.kind,spell==='lightning'?'lightning':'chain');}
  }
});
