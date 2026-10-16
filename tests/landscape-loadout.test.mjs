import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {landscapeFeatures,decorations,LAKE_MAX_RADIUS,SCENERY_IDS} from '../survivors/landscape.mjs';
import {castingPool,spellGroup,canLearn} from '../survivors/spell-loadout.mjs';
import {battlefieldSize} from '../survivors/vanilla-hud.mjs';
const view={left:-3000,right:3000,top:-3000,bottom:3000};
const gear=(stats)=>({id:'gear-spells',name:'Spellkeeper',slot:'amulet',rarity:'rare',stats});
const full={bolt:1,ice:1,fireball:1,lightning:1,frost:1,shield:1,invisibility:1,heal:1};

test('small lakes and low hills are deterministic, isolated features; scenery stays sparse',()=>{
  const features=landscapeFeatures(view);assert.deepEqual(features,landscapeFeatures(view));assert.ok(features.some(f=>f.kind==='hill'));
  const lakes=features.filter(f=>f.kind==='lake');assert.ok(lakes.length>5);
  for(const f of lakes){assert.ok(f.rx<=LAKE_MAX_RADIUS);assert.ok(f.ry<=54);for(const other of lakes)if(f!==other)assert.ok(Math.hypot(f.x-other.x,f.y-other.y)>f.rx+other.rx+20);}
  const props=decorations(view);assert.deepEqual(props,decorations(view));assert.ok(props.length<300);assert.ok(props.some(p=>p.id.startsWith('scenery-')));assert.ok(props.some(p=>['column','statue','henge1'].includes(p.id)));assert.ok(props.every(p=>SCENERY_IDS.includes(p.id)&&Math.hypot(p.x,p.y)>=180));
});

test('lakes, hills, and buildings never block player movement',()=>{
  const points=[...landscapeFeatures(view).slice(0,4),...decorations(view).filter(p=>p.id.startsWith('scenery-')).slice(0,4)];
  for(const point of points){const w=new World();w.skills={};w.spawnTimer=Infinity;w.player.invulnerable=100;w.player.x=point.x-60;w.player.y=point.y;
    for(let i=0;i<20;i++)w.step(.05,{x:1});assert.ok(Math.abs(w.player.x-(point.x+90))<1e-6);}
});

test('the HUD reserves its own area without changing the logical framebuffer',()=>{
  assert.deepEqual(battlefieldSize(800,600),{width:640,height:536});assert.deepEqual(battlefieldSize(600,800),{width:440,height:736});
});

test('equipment grants unlearned autocasts at the bonus rank and removing it stops them',()=>{
  const w=new World({inventory:{bag:[gear({'skill:lightning':3,'skill:shield':2})]}});w.skills={};w.spawnTimer=Infinity;const e=w.spawn('wolf');Object.assign(e,{x:70,y:0,hp:10000,maxHp:10000,speed:0});
  w.equipItem('gear-spells');assert.deepEqual(w.skills,{});assert.equal(w.effectiveRank('lightning',0),3);w.step(.05);
  assert.equal(e.hp,10000-(22+3*12));assert.ok(w.player.statuses.shield?.pool>0);assert.ok(w.castingSkills().every(s=>s.source==='gear'));
  w.unequipItem('amulet');assert.deepEqual(w.castingSkills(),[]);assert.equal(w.player.statuses.shield,undefined);const hp=e.hp;
  for(let i=0;i<100;i++)w.step(.05);assert.equal(e.hp,hp);assert.deepEqual(w.skills,{});
});

test('learned spells take priority; gear never exceeds five offense and three defense casts',()=>{
  const pool=castingPool(full,{'skill:poison':3,'skill:firewall':3,'skill:hasteSpell':3});assert.equal(pool.length,8);assert.ok(pool.every(s=>s.source==='learned'));
  assert.equal(pool.filter(s=>s.group==='offense').length,5);assert.equal(pool.filter(s=>s.group==='defense').length,3);
  assert.equal(canLearn(full,'poison'),false);assert.equal(canLearn(full,'hasteSpell'),false);
  const mixed=castingPool({bolt:2},{'skill:bolt':3,'skill:firewall':3,'skill:shield':2});assert.equal(mixed.length,3);assert.equal(mixed.find(s=>s.id==='bolt').rank,2);
});

test('replacement stays in its category, with eight learned spells and gear bonuses preserved',()=>{
  const w=new World();w.skills={...full};w.pendingLevels=1;w.offer();assert.equal(w.choices.length,4);const incoming=w.choices[3].id,removed=w.replacementSkills(incoming)[0],wrong=Object.keys(full).find(id=>spellGroup(id)!==spellGroup(incoming));
  assert.equal(w.choose(3,wrong),false);assert.equal(w.choose(3,removed),true);assert.equal(Object.keys(w.skills).length,8);assert.equal(w.skills[incoming],1);assert.equal(w.skills[removed],undefined);
});
