import test from 'node:test';
import assert from 'node:assert/strict';
import {World,random} from '../survivors/core.mjs';
import {Inventory,makeItem,rebalanceSavedItems} from '../survivors/loot.mjs';
import {STAT_DEFINITIONS,AFFIXES,BASE_STATS,UNIQUES} from '../survivors/item-affixes.mjs';
import {snapshotRun,restoreRun} from '../survivors/run-state.mjs';
import {milestoneOffers,applyGift,spellModifiers} from '../survivors/knowledge.mjs';
import {movementMultiplier} from '../survivors/original-spells.mjs';

test('removed resource stats never generate, count for value or survive supported inventory saves',()=>{
 for(const key of ['mana','maxMana','manaRegen','spirit'])assert.ok(!Object.hasOwn(STAT_DEFINITIONS,key));
 for(const a of AFFIXES)assert.ok(!a.keys.some(k=>['maxMana','manaRegen','spirit'].includes(k)));
 for(const value of [...Object.values(BASE_STATS),...Object.values(UNIQUES).map(v=>v.stats)])for(const key of ['maxMana','manaRegen','spirit'])assert.ok(!Object.hasOwn(value,key));
 const legacy={id:'legacy',name:'Old staff',slot:'weapon',rarity:'unique',icon:'weapon',balanceVersion:2,stats:{maxMana:80,manaRegen:4,spirit:5,spellDamage:.2}};
 const save={inventory:{bag:[structuredClone(legacy)]},shopStock:[structuredClone(legacy)]};rebalanceSavedItems(save);assert.deepEqual(save.inventory.bag[0].stats,{spellDamage:.2});assert.deepEqual(save.shopStock[0].stats,{spellDamage:.2});assert.deepEqual(new Inventory(save.inventory).bag[0].stats,{spellDamage:.2});
 const rng=random(42);for(let i=0;i<1000;i++){const item=makeItem(rng,{boss:true,level:50,id:'roll-'+i});for(const key of ['maxMana','manaRegen','spirit'])assert.equal(item.stats[key],undefined);}
});
test('old active runs migrate removed resources and paid efficiency into useful ward strength once',()=>{
 const w=new World({campaign:true,seed:42});w.skills={shield:8};w.localBonuses.shield={cost:.2};w.behaviors.shield=['economy'];w.player.mana=3;w.player.maxMana=100;w.player.manaRegen=8;w.baseStats.maxMana=100;w.classBases.maxMana=100;w.enemies=[{id:1,type:'wolf',x:0,y:0,hp:10,mana:20}];
 const restored=restoreRun(snapshotRun(w));assert.ok(restored);for(const object of [restored.player,restored.baseStats,restored.classBases,...restored.enemies])for(const key of ['mana','maxMana','manaRegen','spirit'])assert.equal(object[key],undefined);
 assert.deepEqual(restored.localBonuses.shield,{ward:.2});assert.deepEqual(restored.behaviors.shield,['mobile']);const again=restoreRun(snapshotRun(restored));assert.deepEqual(again.localBonuses,restored.localBonuses);assert.deepEqual(again.behaviors,restored.behaviors);
});
test('ward improvements and milestones now change real protection and active movement',()=>{
 const w=new World();w.skills={shield:8};assert.equal(applyGift(w,{id:'shield',type:'skill',skillStat:'ward',amount:.1}),true);assert.equal(spellModifiers(w,'shield').rank,1.1);
 assert.ok(milestoneOffers(w,'shield').every(c=>!c.description.includes('mana')));w.behaviors.shield=['mobile'];assert.equal(w.cast('shield',8),true);assert.equal(movementMultiplier(w.player),1.12);const mobilePool=w.player.statuses.shield.pool;w.behaviors.shield=['focus'];w.cast('shield',8);assert.ok(w.player.statuses.shield.pool>mobilePool);assert.equal(movementMultiplier(w.player),.9);
 assert.equal(w.player.mana,undefined);
});
test('fully mastered long journeys convert levels to gold and never charge for empty rerolls',()=>{
 const w=new World({campaign:true,seed:42});w.skills={bolt:8};w.localBonuses.bolt={tempo:.5};Object.assign(w.baseStats,{damage:4,haste:4,maxHp:500,speed:500,magnet:400,regen:3,magicFind:6});w.refreshEquipment();w.pendingLevels=3;w.offer();assert.equal(w.status,'playing');assert.equal(w.pendingLevels,0);assert.equal(w.gold,30);w.status='camp';w.campaign.phase='camp';w.prepareCamp();assert.deepEqual(w.campaign.shopOffers,[]);assert.equal(w.rerollCamp(),false);assert.equal(w.gold,30);
});
test('cooldown-only builds retain an explicit maximum cast rate and exclude capped tempo offers',async()=>{
 const {ordinaryOffers}=await import('../survivors/knowledge.mjs');const w=new World();w.skills={bolt:8};w.player.haste=100;w.localBonuses.bolt={tempo:.2};assert.equal(w.spellInterval('bolt'),.85*.2);assert.ok(!ordinaryOffers(w,20).some(c=>c.id==='bolt'));
});
