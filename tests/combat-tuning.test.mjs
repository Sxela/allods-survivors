import test from 'node:test';
import assert from 'node:assert/strict';
import {World,EQUIPMENT_DROP_CHANCE} from '../survivors/core.mjs';
import {ENEMY_SPELLBOOKS,enemyDamage} from '../survivors/enemy-spells.mjs';
import {VfxRenderer,lightningPath} from '../survivors/vfx.mjs';
const arena=()=>{const w=new World({seed:733});w.skills={};w.spawnTimer=Infinity;return w;};
const add=(w,type,x=200)=>{const e=w.spawn(type);Object.assign(e,{x,y:0,speed:0,attackCooldown:0,hp:10000,maxHp:10000});return e;};
const advance=(w,time)=>{for(let i=0;i<Math.ceil(time/.05);i++)w.step(.05);};

test('ordinary drop chance is five times lower; all champion and boss kinds guarantee equipment',()=>{
  assert.equal(EQUIPMENT_DROP_CHANCE,.02/5);const w=arena();let drops=0;w.dropLoot=()=>drops++;
  for(const modifiers of [{},{elite:true},{minorBoss:true},{boss:true}]){const e=add(w,'wolf');Object.assign(e,modifiers);w.hurt(e,e.hp+1);}
  assert.equal(drops,4);
});

test('Magic Find changes quality without changing the equipment-drop gate',()=>{
  const quality=find=>{const w=arena();w.player.magicFind=find;w.rng=()=>.5;return w.dropLoot({x:0,y:0}).rarity;};
  assert.equal(quality(0),'common');assert.equal(quality(10),'rare');
  const count=find=>{const w=arena();w.player.magicFind=find;let n=0;w.dropLoot=()=>n++;for(let i=0;i<10000;i++){const e=add(w,'wolf');w.hurt(e,e.hp+1);w.enemies=[];w.gems=[];}return n;};
  assert.equal(count(0),count(10));
});

test('Wall of Earth is retired and cannot be cast',()=>{const w=arena();assert.equal(w.cast('earthwall',8),false);assert.equal(w.fields.length,0);});

test('the curved beams use 50% larger cores spaced about half a sprite apart',()=>{
  const calls=[],renderer=new VfxRenderer({}, {}, {});renderer.draw=(id,x,y,options)=>calls.push({id,x,y,...options});renderer.chain(0,0,300,0,1,.2,'chain');
  const cores=calls.filter(c=>c.scale===.72);assert.ok(cores.length>40&&cores.length<60);assert.equal(cores.length,lightningPath(0,0,300,0,1).length);
  const spacing=Math.hypot(cores[1].x-cores[0].x,cores[1].y-cores[0].y),overlap=1-spacing/(16*.72);assert.ok(overlap>.43&&overlap<.55);assert.ok(calls.every(c=>c.id==='chain'));
});

test('cooldown durations track successful casts and freeze with the simulation',()=>{
  const w=arena();w.skills={lightning:1};const e=add(w,'wolf');e.attackCooldown=99;w.step(.05);
  assert.ok(w.cooldowns.lightning>0);assert.equal(w.cooldownDurations.lightning,w.cooldowns.lightning);const before=w.cooldowns.lightning;
  w.status='paused';w.step(.05);assert.equal(w.cooldowns.lightning,before);w.status='playing';w.step(.05);assert.ok(w.cooldowns.lightning<before);
});

test('skeleton mages cast real Air attacks after a wind-up, and Air resistance reduces the damage',()=>{
  const cast=resist=>{const w=arena();w.player.airResist=resist;w.player.defense=500;add(w,'skeleton_m3');w.step(.05);assert.ok(w.enemies[0].casting);assert.equal(w.player.hp,100);advance(w,.6);return w;};
  const plain=cast(0),ward=cast(.5);assert.ok(plain.player.hp<100);assert.ok(Math.abs((100-ward.player.hp)-(100-plain.player.hp)*.5)<1e-8);assert.ok(plain.effects.some(e=>e.kind==='chain'));
});

test('succubi and dragons launch native Water missiles, and Water resistance affects real impacts',()=>{
  for(const type of ['succubus','dragon']){
    const run=resist=>{const w=arena();w.player.waterResist=resist;const e=add(w,type,140);e.castIndex=ENEMY_SPELLBOOKS[type].attacks.indexOf('ice');advance(w,.6);assert.equal(w.enemyProjectiles[0]?.element,'water');advance(w,.6);return w;};
    const plain=run(0),ward=run(.5);assert.ok(plain.player.hp<100);assert.ok(Math.abs((100-ward.player.hp)-(100-plain.player.hp)*.5)<1e-8);
  }
});

test('petrification interrupts enemy wind-ups; shamans alternate Fire and Earth missiles',()=>{
  const w=arena(),mage=add(w,'skeleton_m3');w.step(.05);mage.statuses.stonecurse={ttl:5};advance(w,1);assert.equal(mage.casting,null);assert.equal(w.player.hp,100);
  for(const [index,element] of [[0,'fire'],[1,'earth']]){const a=arena(),shaman=add(a,'orc_sh',300);shaman.castIndex=index;advance(a,.6);assert.equal(a.enemyProjectiles[0].element,element);}
});

test('enemy shields absorb damage and necromancer life drain heals only actual damage',()=>{
  const w=arena(),e=add(w,'necromant');e.hp=9000;e.statuses.shield={ttl:5,pool:50,fraction:.65};assert.ok(w.hurt(e,20,'air')<20);assert.ok(e.statuses.shield.pool<50);
  w.player.invulnerable=100;e.castIndex=0;e.statuses={};const hp=e.hp;advance(w,.6);assert.equal(e.hp,hp);
  w.player.invulnerable=0;w.player.airResist=.5;assert.equal(enemyDamage(w,w.player,20,'air'),10);
});
