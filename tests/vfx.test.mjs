import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleVfx,VfxRenderer} from '../survivors/vfx.mjs';
const {vfx}=JSON.parse(readFileSync(new URL('../survivors/assets/manifest.json',import.meta.url),'utf8'));

test('original directional fireball art points in all cardinal directions and mirrors rightward art',()=>{
  for(const [dx,dy,group,flipX] of [[0,1,0,false],[-1,0,4,false],[0,-1,8,false],[1,0,4,true]]){
    const sample=sampleVfx(vfx.fireball,{time:0,dx,dy});
    assert.equal(sample.index,group*4);assert.equal(sample.flipX,flipX);
  }
  const left=sampleVfx(vfx.fireball,{dx:-1,dy:-1,time:.1});
  const right=sampleVfx(vfx.fireball,{dx:1,dy:-1,time:.1});
  assert.equal(left.index,right.index);assert.equal(left.flipX,false);assert.equal(right.flipX,true);
});

test('one-shot animation clamps to its own final phase instead of another directional group',()=>{
  assert.equal(sampleVfx(vfx.explosion,{progress:0}).index,0);
  assert.equal(sampleVfx(vfx.explosion,{progress:1}).index,10);
  assert.equal(sampleVfx(vfx.explosion,{progress:2}).index,10);
  assert.equal(sampleVfx(vfx.explosion,{progress:-1}).index,0);
  assert.equal(sampleVfx(vfx.fireball,{progress:1,dx:0,dy:-1}).index,35);
});

test('all original VFX phases sample a centered frame within the extracted atlas',()=>{
  for(const effect of Object.values(vfx))for(let d=0;d<16;d++)for(let phase=0;phase<effect.phases;phase++){
    const a=Math.PI/2-d*Math.PI/8;
    const {index,frame}=sampleVfx(effect,{dx:Math.cos(a),dy:Math.sin(a),progress:phase/effect.phases});
    assert.ok(index>=0&&index<effect.count);assert.ok(frame);
    assert.equal(frame.anchorX,frame.w/2);assert.equal(frame.anchorY,frame.h/2);
    assert.ok(frame.x>=0&&frame.y>=0&&frame.x+frame.w<=effect.columns*effect.cellWidth);
  }
});

test('renderer draws source atlas pixels with centered anchors and horizontal mirror',()=>{
  const operations=[],ctx={globalAlpha:1,save(){},restore(){},translate(...args){operations.push(['translate',...args]);},scale(...args){operations.push(['scale',...args]);},drawImage(...args){operations.push(['image',...args]);}};
  const image={tag:'original-fireball'},renderer=new VfxRenderer(ctx,vfx,{'vfx:fireball':image});
  assert.equal(renderer.draw('fireball',20,30,{dx:1,dy:0}),true);
  assert.deepEqual(operations[0],['translate',20,30]);assert.deepEqual(operations[1],['scale',-1,1]);
  const imageOp=operations.find(o=>o[0]==='image');assert.equal(imageOp[1],image);
  assert.deepEqual(imageOp.slice(-4),[-66,-66,132,132]);
  assert.equal(renderer.draw('missing',20,30),false);assert.deepEqual([...renderer.used],['fireball']);
});
