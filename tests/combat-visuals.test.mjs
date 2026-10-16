import test from 'node:test';
import assert from 'node:assert/strict';
import {blizzardParticles,drawPlayerShield} from '../survivors/original-renderer.mjs';
import {opaqueBounds,playerVitalLayout,drawPlayerVitals} from '../survivors/player-vitals.mjs';
test('Blizzard crystals fall down and toward their impact points inside the damage area',()=>{
  const field={x:120,y:80,r:90},a=blizzardParticles(field,.1),b=blizzardParticles(field,.15);
  assert.equal(a.length,36);
  for(let i=0;i<a.length;i++){
    assert.ok(Math.hypot(a[i].impactX-field.x,a[i].impactY-field.y)<=field.r);
    assert.ok(a[i].y<=a[i].impactY);
    if(b[i].phase>a[i].phase){assert.ok(b[i].y>a[i].y);assert.ok(b[i].x>a[i].x);}
  }
});
test('Shield uses many original particles throughout its active lifetime and stops when depleted',()=>{
  const calls=[],ctx={save(){},restore(){},beginPath(){},ellipse(){},fill(){},stroke(){}},vfx={ctx,draw(...args){calls.push(args);}};
  const p={x:100,y:100,statuses:{shield:{ttl:6,pool:25}}};
  assert.equal(drawPlayerShield(vfx,p,3),true);assert.ok(calls.length>50);assert.ok(calls.every(c=>c[0]==='shield'));
  assert.ok(calls.some(c=>c[2]<p.y-40));assert.ok(calls.some(c=>c[1]>p.x+20));
  calls.length=0;p.statuses.shield.pool=0;assert.equal(drawPlayerShield(vfx,p,3),false);assert.equal(calls.length,0);
});
test('health bar sits above measured opaque character artwork and clamps health ratios',()=>{
  const pixels=new Uint8ClampedArray(10*20*4);pixels[(5*10+3)*4+3]=255;pixels[(17*10+8)*4+3]=255;
  assert.deepEqual(opaqueBounds(pixels,10,20),{left:3,top:5,width:6,height:13});
  const layout=playerVitalLayout({x:400,y:300,hp:25,maxHp:100},{height:65,width:40});
  assert.equal(layout.y,218);assert.equal(layout.health,.25);
  assert.equal(playerVitalLayout({x:0,y:0,hp:-5,maxHp:100}).health,0);
});
test('overhead health and shield bars reflect remaining health and absorption',()=>{
  const fills=[],ctx={save(){},restore(){},fillRect(...args){fills.push(args);},strokeRect(){}};
  drawPlayerVitals(ctx,{x:400,y:300,hp:50,maxHp:100,statuses:{shield:{ttl:4,pool:10,maxPool:40}}});
  assert.ok(fills.some(c=>c[2]===24&&c[3]===5));assert.ok(fills.some(c=>c[2]===12&&c[3]===2));
});
