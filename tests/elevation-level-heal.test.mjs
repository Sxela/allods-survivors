import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {terrainElevation,elevatedWorld,landscapeFeatures} from '../survivors/landscape.mjs';

test('relief has continuous hills and hollows, a flat clearing and level lakes',()=>{
  let low=0,high=0;
  for(let y=-2000;y<=2000;y+=31)for(let x=-2000;x<=2000;x+=31){
    const h=terrainElevation(x,y);low=Math.min(low,h);high=Math.max(high,h);
    assert.ok(Math.abs(h-terrainElevation(x+.1,y+.1))<.2);
  }
  assert.ok(low<-15);assert.ok(high>30);assert.equal(terrainElevation(0,0),0);
  for(const lake of landscapeFeatures({left:-2000,right:2000,top:-2000,bottom:2000}).filter(f=>f.kind==='lake')){assert.equal(terrainElevation(lake.x,lake.y),0);for(let dx=-lake.rx*1.8;dx<lake.rx*1.8;dx+=.2)assert.ok(Math.abs(terrainElevation(lake.x+dx,lake.y)-terrainElevation(lake.x+dx+.2,lake.y))<.7);}
});

test('render projection moves actors, effects and wall endpoints together without changing simulation',()=>{
  const w=new World();Object.assign(w.player,{x:731,y:440});
  const e=w.spawn('wolf');Object.assign(e,{x:731,y:440});
  w.effects=[{x:731,y:440,x2:800,y2:500}];
  const projected=elevatedWorld(w),h=terrainElevation(731,440);
  assert.equal(projected.player.y,440-h);assert.equal(projected.enemies[0].y,440-h);
  assert.equal(projected.effects[0].y,440-h);assert.equal(projected.effects[0].y2,500-terrainElevation(800,500));
  assert.equal(w.player.y,440);assert.equal(e.y,440);assert.equal(w.effects[0].y2,500);
});

test('every earned level grants exactly one free hero Heal, capped at max health',()=>{
  const w=new World();w.player.hp=1;w.player.mana=0;
  w.allies=[{hp:1,maxHp:1000}];w.addXp(w.player.nextXp);
  assert.equal(w.player.hp,33);assert.equal(w.player.mana,0);assert.equal(w.allies[0].hp,1);
  assert.equal(w.skills.heal,undefined);assert.equal(w.effects.filter(e=>e.kind==='healing').length,1);
  w.offer();assert.equal(w.player.hp,33);
  w.addXp(w.player.nextXp);assert.equal(w.player.hp,65);
  w.addXp(w.player.nextXp);assert.equal(w.player.hp,97);
  w.addXp(w.player.nextXp);assert.equal(w.player.hp,100);
  assert.equal(w.effects.filter(e=>e.kind==='healing').length,4);
});
