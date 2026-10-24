import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {snapshotRun,restoreRun} from '../survivors/run-state.mjs';
import {Inventory} from '../survivors/loot.mjs';
import {AFFIXES,STAT_DEFINITIONS,UNIQUES} from '../survivors/item-affixes.mjs';

test('retired Wall of Earth no longer grants casts or rolls on equipment',()=>{
 const inventory=new Inventory({bag:[{id:'old-bracers',icon:'gear-0009020',slot:'bracers',name:'Keeper of Ancient Runes',rarity:'unique',balanceVersion:2,stats:{armor:3,'skill:earthwall':2}}]},'warrior');
 assert.equal(inventory.bag[0].stats['skill:earthwall'],undefined);assert.equal(inventory.bag[0].stats.armor,3);
 assert.equal(STAT_DEFINITIONS['skill:earthwall'],undefined);
 assert.ok(!AFFIXES.some(a=>a.keys.includes('skill:earthwall')));
 assert.ok(!Object.values(UNIQUES).some(u=>'skill:earthwall' in u.stats));
 const w=new World();w.skills.earthwall=8;w.player['skill:earthwall']=3;
 assert.ok(!w.castingSkills().some(s=>s.id==='earthwall'));assert.equal(w.cast('earthwall'),false);
});

test('saved runs shed retired walls, offers and cooldowns while preserving other progress',()=>{
 const w=new World({campaign:true,seed:54});w.skills.earthwall=3;w.cooldowns.earthwall=4;w.cooldownDurations.earthwall=8;w.cooldownWaiting.earthwall=true;w.localBonuses.earthwall={ward:.1};w.behaviors.earthwall=['mobile'];w.individualPurchases.earthwall=2;
 w.fields=[{kind:'earthwall',x:0,y:0,ttl:3},{kind:'firewall',x:30,y:40,ttl:2}];w.effects=[{kind:'earthwall',vfx:'earthwall',x:0,y:0,ttl:1}];
 w.campaign.shopOffers=[{id:'earthwall',type:'learn',name:'Wall of Earth',description:'Old offer',rarity:'common'}];
 const restored=restoreRun(snapshotRun(w));assert.ok(restored);assert.equal(restored.player.level,w.player.level);
 assert.equal(restored.skills.bolt,1);assert.equal(restored.skills.fireball,1);
 for(const key of ['skills','cooldowns','cooldownDurations','cooldownWaiting','localBonuses','behaviors','individualPurchases'])assert.equal(restored[key].earthwall,undefined,key);
 assert.deepEqual(restored.fields.map(f=>f.kind),['firewall']);assert.equal(restored.effects.length,0);assert.equal(restored.campaign.shopOffers.length,0);
});

test('a saved level-up with only a retired offer regenerates usable choices',()=>{
 const w=new World({campaign:true,seed:54});w.status='levelup';w.pendingLevels=1;w.choices=[{id:'earthwall',type:'skill',rank:2,name:'Wall of Earth',description:'Old upgrade'}];
 const restored=restoreRun(snapshotRun(w));assert.ok(restored);assert.equal(restored.status,'levelup');assert.ok(restored.choices.length>0);assert.ok(restored.choices.every(c=>c.id!=='earthwall'));assert.equal(restored.pendingLevels,1);
 assert.equal(restored.choose(0),true);
});
