import test from 'node:test';
import assert from 'node:assert/strict';
import { World, random, enemyFootprint } from '../survivors/core.mjs';

function arena(options={}) {
  const world=new World({seed:314159,duration:600,...options});
  world.spawnTimer=Infinity;
  return world;
}
function target(world,{x=90,y=0,hp=1000,...other}={}) {
  const enemy=world.spawn('wolf');
  Object.assign(enemy,{x,y,hp,maxHp:hp,speed:0,damage:0,...other});
  return enemy;
}
function advance(world,seconds,input={}) {
  for(let i=0;i<Math.ceil(seconds/.025);i++)world.step(.025,input);
}
const xpOnFloor=world=>world.gems.filter(g=>g.type==='xp').reduce((sum,g)=>sum+g.value,0);

test('seeded random stream is reproducible and bounded',()=>{
  const a=random(42),b=random(42),c=random(43);
  const values=Array.from({length:500},()=>a());
  assert.deepEqual(values,Array.from({length:500},()=>b()));
  assert.notDeepEqual(values,Array.from({length:500},()=>c()));
  assert.ok(values.every(v=>v>=0&&v<1));
});

test('movement normalizes diagonals and clamps long frames',()=>{
  const world=arena();world.skills={};
  world.step(1,{x:1,y:1});
  assert.ok(Math.abs(Math.hypot(world.player.x,world.player.y)-7.5)<1e-9);
  assert.equal(world.time,.05);
});

test('bolt autocasts and damages a target without attack input',()=>{
  const world=arena(),enemy=target(world);
  advance(world,.4);
  assert.ok(enemy.hp<enemy.maxHp);
  assert.ok(world.events.some(e=>e.type==='cast'&&e.skill==='bolt'));
});

test('Blizzard damages its target area over time without adding a slow',()=>{
  const world=arena(),near=target(world,{x:80}),far=target(world,{x:250});world.skills={};
  world.cast('frost',2);assert.equal(near.hp,near.maxHp);advance(world,.5);
  assert.ok(near.hp<near.maxHp);assert.equal(near.slow,0);assert.equal(far.hp,far.maxHp);
});
test('Lightning hits one target while Prismatic Spray hits several simultaneously',()=>{
  const world=arena(),enemies=[target(world,{x:80}),target(world,{x:130}),target(world,{x:180})];
  world.cast('lightning',1);assert.deepEqual(enemies.map(e=>e.hp),[966,1000,1000]);
  assert.equal(world.effects.filter(e=>e.kind==='lightning').length,1);
  world.cast('prismatic',1);assert.deepEqual(enemies.map(e=>e.hp),[932,966,966]);
});
test('Fireball travels before exploding once on impact',()=>{
  const world=arena(),enemy=target(world,{x:180});world.skills={};
  world.cast('fireball',1);assert.equal(enemy.hp,1000);
  advance(world,.25);assert.equal(enemy.hp,1000);
  advance(world,.3);assert.equal(enemy.hp,958);
  advance(world,1);assert.equal(enemy.hp,958);
});
test('Poison Cloud damages repeatedly and warriors attack with a weapon',()=>{
  const poison=arena(),enemy=target(poison,{x:180});poison.skills={};
  poison.cast('poison',1);advance(poison,1);assert.ok(enemy.hp<980&&enemy.hp>900);
  const warrior=arena({hero:'warrior'}),close=target(warrior,{x:60,y:0});
  warrior.step(.025);assert.ok(close.hp<close.maxHp);assert.equal(warrior.skills.orbit,undefined);
});

test('XP crossing multiple levels retains remainder and queues every choice',()=>{
  const world=arena();world.addXp(100);
  assert.equal(world.player.level,6);assert.equal(world.player.xp,15);
  assert.equal(world.pendingLevels,5);assert.equal(world.status,'levelup');
  assert.equal(world.choices.length,3);assert.equal(new Set(world.choices.map(c=>c.id)).size,3);
  let picked=0;while(world.status==='levelup'){assert.equal(world.choose(0),true);picked++;}
  assert.equal(picked,5);assert.equal(world.pendingLevels,0);assert.equal(world.status,'playing');
  assert.equal(world.player.xp,15);assert.equal(world.choose(0),false);
});

test('level-up and explicit pause stop simulation time and attacks',()=>{
  const world=arena();target(world);world.addXp(7);
  const before={time:world.time,x:world.player.x,enemies:JSON.stringify(world.enemies),projectiles:world.projectiles.length};
  advance(world,2,{x:1,y:1});
  assert.deepEqual({time:world.time,x:world.player.x,enemies:JSON.stringify(world.enemies),projectiles:world.projectiles.length},before);
  world.choose(0);world.status='paused';advance(world,1,{x:1});assert.equal(world.time,0);
});

test('dash moves faster, protects from contact, and respects cooldown',()=>{
  const world=arena();world.skills={};target(world,{x:0,damage:30});world.player.dx=1;
  world.dash();world.step(.025,{x:1});
  assert.equal(world.player.hp,world.player.maxHp);assert.ok(world.player.x>10);
  const cooldown=world.player.dashCooldown;world.dash();assert.equal(world.player.dashCooldown,cooldown);
});

test('scheduled bosses spawn exactly once at milestones and final warning',()=>{
  const world=arena();world.skills={};world.time=119.99;world.step(.025);
  assert.equal(world.enemies.filter(e=>e.boss).length,1);
  advance(world,.1);assert.equal(world.enemies.filter(e=>e.boss).length,1);
  world.time=584.99;world.step(.025);
  assert.equal(world.bosses.size,5);
  assert.equal(world.enemies.filter(e=>e.finalBoss&&e.type==='mainnecro').length,1);
  assert.equal(world.enemies.filter(e=>e.finalBoss).length,1);
});

test('death is terminal and emits one end event',()=>{
  const dead=arena();dead.skills={};dead.player.hp=1;target(dead,{x:0,damage:20,attackCooldown:0});dead.step(.025);
  assert.equal(dead.status,'dead');assert.equal(dead.player.hp,0);
  const deadTime=dead.time;advance(dead,1);assert.equal(dead.time,deadTime);
  assert.equal(dead.events.filter(e=>e.type==='end').length,1);
});

test('surviving the timer leaves the final boss fight active',()=>{
  const world=arena();world.skills={};
  assert.equal(world.finalBossDefeated,false);
  world.time=599.99;world.step(.025);
  assert.equal(world.status,'playing');
  assert.equal(world.events.filter(e=>e.type==='end').length,0);
  assert.ok(world.enemies.some(e=>e.finalBoss&&e.hp>0));
});

test('final boss defeat before duration waits for timer, then victory is terminal',()=>{
  const won=arena();won.skills={};won.time=584.99;won.step(.025);
  const finalBoss=won.enemies.find(e=>e.finalBoss);assert.ok(finalBoss);
  won.hurt(finalBoss,finalBoss.hp+1);
  assert.equal(won.finalBossDefeated,true);
  won.step(.025);assert.equal(won.status,'playing');
  won.time=599.99;won.step(.025);assert.equal(won.status,'won');
  const wonTime=won.time;advance(won,1);assert.equal(won.time,wonTime);
  assert.equal(won.events.filter(e=>e.type==='end').length,1);
});

test('defeating only an intermediate boss cannot grant victory',()=>{
  const world=arena();world.skills={};world.time=119.99;world.step(.025);
  const intermediate=world.enemies.find(e=>e.boss);assert.ok(intermediate);
  assert.ok(!intermediate.finalBoss);world.hurt(intermediate,intermediate.hp+1);
  assert.equal(world.finalBossDefeated,false);
  world.time=599.99;world.step(.025);assert.equal(world.status,'playing');
});

test('defeating the final boss after the timer grants victory',()=>{
  const world=arena();world.skills={};world.time=599.99;world.step(.025);
  assert.equal(world.status,'playing');
  const finalBoss=world.enemies.find(e=>e.finalBoss);assert.ok(finalBoss);
  world.hurt(finalBoss,finalBoss.hp+1);world.step(.025);
  assert.equal(world.status,'won');assert.equal(world.finalBossDefeated,true);
  assert.equal(world.events.filter(e=>e.type==='end').length,1);
});

test('ordinary spawning stops at duration while the final boss fight continues',()=>{
  const world=arena();world.skills={};world.time=584.99;world.step(.025);
  world.time=600;world.spawnTimer=0;
  const before=world.enemies.filter(e=>!e.boss).length;
  advance(world,2);
  assert.equal(world.status,'playing');
  assert.equal(world.enemies.filter(e=>!e.boss).length,before);
});

test('boss death gives one reward and cannot be counted twice',()=>{
  const world=arena(),boss=world.spawn('troll',true);
  world.hurt(boss,boss.hp+1);world.hurt(boss,1000);
  assert.equal(world.kills,1);assert.equal(world.gold,15);
  assert.equal(xpOnFloor(world),35);
  assert.equal(world.events.filter(e=>e.type==='bossKilled').length,1);
});

test('identical seeded runs reproduce combat and upgrade choices',()=>{
  const run=()=>{
    const world=new World({seed:8128});
    for(let i=0;i<1800;i++){
      if(world.status==='levelup')world.choose(0);
      world.step(.025,{x:Math.cos(i/150),y:Math.sin(i/150)});
    }
    return {time:world.time,kills:world.kills,hp:world.player.hp,xp:world.player.xp,skills:world.skills,enemies:world.enemies.map(e=>[e.id,e.type,e.hp,e.x,e.y])};
  };
  assert.deepEqual(run(),run());
});

test('overflow consolidation conserves XP when first retained gem is healing',()=>{
  const world=arena();world.skills={};
  world.gems=Array.from({length:1301},(_,i)=>({x:10000+i,y:10000,type:i===300?'heal':'xp',value:i===300?12:1}));
  const before=xpOnFloor(world);world.step(.025);
  assert.equal(xpOnFloor(world),before,'XP must merge into an XP gem, never into a healing pickup');
  assert.equal(world.gems.filter(g=>g.type==='heal').reduce((sum,g)=>sum+g.value,0),12);
});

// Use the actual foot-anchored artwork and shadow, rather than a large empty
// buffer that delays the start of combat.
function assertHiddenSpawn(world,point,padding=12) {
  const dx=point.x-world.player.x,dy=point.y-world.player.y,shape=enemyFootprint(point.type,point.boss);
  const halfWidth=world.viewport.width/2,halfHeight=world.viewport.height/2;
  assert.ok(dx-shape.halfWidth>=halfWidth+padding-1e-7||dx+shape.halfWidth<=-halfWidth-padding+1e-7||dy-shape.above>=halfHeight+padding-1e-7||dy+shape.below<=-halfHeight-padding+1e-7,
    `spawn (${point.x}, ${point.y}) intrudes into padded ${world.viewport.width}x${world.viewport.height} camera at (${world.player.x}, ${world.player.y})`);
}
const viewports=[{width:800,height:600},{width:1920,height:1080},{width:3840,height:1080},{width:600,height:800},{width:1080,height:3840}];

test('seeded spawn positions hide full sprites on wide and tall cameras at arbitrary player positions',()=>{
  for(const viewport of viewports)for(const seed of [1,42,8128]){
    const world=arena({viewport,seed});
    for(const [x,y] of [[0,0],[13729,-9182],[-24000,39000]]){
      Object.assign(world.player,{x,y});
      for(let i=0;i<256;i++)assertHiddenSpawn(world,world.spawnPosition());
    }
  }
});

test('ordinary and boss spawn callers use the current camera after resizing',()=>{
  const world=arena({seed:761});
  for(const viewport of viewports){
    world.setViewport(viewport.width,viewport.height);
    Object.assign(world.player,{x:-9123,y:18047});
    for(let i=0;i<128;i++){
      assertHiddenSpawn(world,world.spawn('wolf'));
      assertHiddenSpawn(world,world.spawn('troll',true));
    }
    world.enemies=[];
  }
});

test('first wave enters outside the camera including full sprite padding',()=>{
  for(const viewport of viewports)for(const seed of [1,42,8128]){
    const world=new World({viewport,seed});world.skills={};
    Object.assign(world.player,{x:8172,y:-4912});world.step(.025);
    assert.ok(world.enemies.length>0);
    // Enemies move toward the player during the spawning frame.
    for(const enemy of world.enemies)assertHiddenSpawn(world,enemy,10);
  }
});

test('recycled ordinary enemies and bosses reappear outside the resized camera',()=>{
  const world=arena({seed:3301});world.skills={};
  for(const viewport of viewports){
    world.setViewport(viewport.width,viewport.height);
    Object.assign(world.player,{x:17418,y:-29003});
    for(let i=0;i<128;i++){
      const enemy=world.spawn(i%2?'troll':'wolf',!!(i%2));
      const angle=i*.61;
      Object.assign(enemy,{x:world.player.x+Math.cos(angle)*12000,y:world.player.y+Math.sin(angle)*12000,speed:0});
      world.step(.025);assertHiddenSpawn(world,enemy);
      assert.equal(world.enemies[0],enemy,'recycling preserves the existing enemy and its health');
      world.enemies=[];
    }
  }
});

test('visible enemies on large cameras are not recycled by the old fixed distance',()=>{
  for(const viewport of [{width:3840,height:1080},{width:1080,height:3840}]){
    const world=arena({viewport});world.skills={};
    Object.assign(world.player,{x:9018,y:-18217});
    const offset=viewport.width>viewport.height?{x:1800,y:0}:{x:0,y:1800};
    const enemy=target(world,{x:world.player.x+offset.x,y:world.player.y+offset.y});
    world.step(.025);
    assert.equal(enemy.x,world.player.x+offset.x);assert.equal(enemy.y,world.player.y+offset.y);
  }
});

test('viewport validation rejects invalid dimensions without corrupting the current camera',()=>{
  const world=arena({viewport:{width:1920,height:1080}});
  for(const [width,height] of [[0,600],[-1,600],[800,NaN],[Infinity,600],[800,-5]]){
    assert.throws(()=>world.setViewport(width,height),RangeError);
    assert.deepEqual(world.viewport,{width:1920,height:1080});
  }
});
