import test from 'node:test';
import assert from 'node:assert/strict';
import {World,random} from '../survivors/core.mjs';
import {CAMPAIGN_RULES,ROUTE,openExit} from '../survivors/campaign.mjs';
import {upgradeRarity,applyGift,ordinaryOffers,spellModifiers,campPrice,shopPriceScale} from '../survivors/knowledge.mjs';
import {snapshotRun,restoreRun} from '../survivors/run-state.mjs';
import {inspectSpell} from '../survivors/inspection.mjs';
import {stepEnemyCaster} from '../survivors/enemy-spells.mjs';
import {MAP_ARENAS,arenaFor,arenaWalkable,cellPosition} from '../survivors/map-arenas.mjs';
import {STAT_DEFINITIONS} from '../survivors/item-affixes.mjs';
const scene=(options={})=>{const w=new World({campaign:true,seed:42,...options});w.campaign.waveTimer=Infinity;w.skills={};w.player.invulnerable=10000;return w;};
function advance(w,seconds,input={}){for(let i=0;i<Math.ceil(seconds/.05);i++)w.step(.05,input);}
function guardian(w){w.campaign.time=CAMPAIGN_RULES.bossAt-.01;w.step(.05);const boss=w.enemies.find(e=>e.areaBoss);assert.ok(boss);return boss;}
function extract(w){const boss=guardian(w);w.hurt(boss,boss.hp*100);assert.equal(w.status,'playing');advance(w,1.1);Object.assign(w.player,w.campaign.exit);w.gems=[];advance(w,1.05);assert.equal(w.status,'camp');}

test('guardians open timed exits without interrupting combat; entering exit opens a safe shop',()=>{
 const w=scene(),boss=guardian(w);w.lootDrops.push({x:1000,y:1000,item:{id:'reward'}});w.hurt(boss,boss.hp*100);
 assert.equal(w.campaign.remaining,30);assert.equal(w.campaign.phase,'extract');assert.equal(w.status,'playing');assert.ok(w.lootDrops.some(d=>d.item.id==='reward'));
 const before=w.time;advance(w,1.1);assert.ok(w.time>before);Object.assign(w.player,w.campaign.exit);w.gems=[];advance(w,1.05);assert.equal(w.status,'camp');
 const time=w.time,hp=w.player.hp;advance(w,10);assert.equal(w.time,time);assert.equal(w.player.hp,hp);
 w.prepareCamp();assert.ok(w.campaign.shopOffers.length>0);assert.equal(w.nextArea(),true);assert.equal(w.campaign.index,1);assert.equal(w.player.hp,hp);assert.equal(w.enemies.length,0);
});
test('missing extraction is terminal and pauses do not consume its deadline',()=>{
 const w=scene(),boss=guardian(w);w.hurt(boss,boss.hp*100);w.status='paused';advance(w,40);assert.equal(w.campaign.remaining,30);w.status='playing';advance(w,30.1);assert.equal(w.status,'dead');assert.equal(w.events.filter(e=>e.type==='end').length,1);
});
test('every sampled native area requires extraction and the final camp completion before victory',()=>{
 const w=scene();for(let index=0;index<w.campaign.route.length;index++){assert.equal(w.campaign.index,index);extract(w);assert.equal(w.status,'camp');assert.equal(w.nextArea(),true);w.campaign.waveTimer=Infinity;}assert.equal(w.status,'won');
});
test('waves continue through the guardian fight and have guaranteed equipment leaders',()=>{
 const w=scene();guardian(w);w.campaign.wave=2;w.campaign.waveTimer=0;w.step(.05);assert.ok(w.enemies.some(e=>e.minorBoss));const leader=w.enemies.find(e=>e.minorBoss);w.hurt(leader,leader.hp*100);assert.ok(w.lootDrops.length);assert.ok(w.campaign.queue.length);const count=w.enemies.length;w.step(.05);assert.ok(w.enemies.length>count);
});
test('mining is finite, resets on movement, saves remaining deposits and is optional',()=>{
 const w=scene(),ore=w.campaign.deposits[0];Object.assign(w.player,{x:ore.x,y:ore.y});advance(w,1);assert.ok(ore.progress>.9);w.step(.05,{x:1});assert.equal(ore.progress,0);Object.assign(w.player,{x:ore.x,y:ore.y});advance(w,6.2);assert.equal(ore.remaining,0);assert.equal(w.gold,48);advance(w,5);assert.equal(w.gold,48);
 const restored=restoreRun(snapshotRun(w));assert.equal(restored.campaign.deposits[0].remaining,0);assert.equal(restored.gold,48);
});
test('ordinary rewards improve owned spells and hero; every fifth level queues separate learning',()=>{
 const w=scene();w.skills={bolt:1};w.player.level=4;w.addXp(w.player.nextXp);assert.equal(w.rewardKind,'learning');assert.equal(w.pendingLevels,1);assert.ok(w.choices.every(c=>['learn','replace','keep'].includes(c.type)));assert.equal(w.choose(w.choices.findIndex(c=>c.type==='keep')),true);assert.equal(w.rewardKind,'ordinary');assert.ok(w.choices.every(c=>c.type==='passive'||c.type==='skill'&&c.id==='bolt'));assert.ok(w.choices.some(c=>c.type==='passive'));w.choose(0);assert.equal(w.pendingLevels,0);assert.equal(w.status,'playing');
});
test('learning with full slots offers keep and requires a deliberate legal replacement',()=>{
 const w=scene();w.skills={bolt:1,fireball:2,ice:3,poison:4,lightning:5,shield:1,heal:1,invisibility:1};w.individualPurchases.bolt=4;w.behaviors.bolt=['quick'];w.learningQueue=[5];w.offer();const i=w.choices.findIndex(c=>c.type==='replace');assert.ok(i>=0);const c=w.choices[i],old=w.replacementSkills(c.id)[0];w.individualPurchases[old]=4;w.behaviors[old]=['quick'];assert.equal(w.choose(i),false);assert.equal(w.choose(i,'missing'),false);assert.equal(w.choose(i,old),true);assert.equal(w.skills[c.id],1);assert.equal(w.individualPurchases[old],undefined);assert.equal(w.behaviors[old],undefined);assert.equal(Object.keys(w.skills).length,8);
});
test('five individual purchases award a free behavior choice, rarity does not multiply purchases',()=>{
 const w=scene();w.skills={bolt:1};for(let i=0;i<5;i++){const rank=w.skills.bolt;assert.equal(applyGift(w,{id:'bolt',type:'skill',rank:rank+1}),true);}assert.deepEqual(w.milestones,['bolt']);w.pendingLevels=1;w.offer();assert.equal(w.rewardKind,'behavior');assert.equal(w.choices.length,2);w.choose(0);assert.equal(w.pendingLevels,1);assert.equal(w.rewardKind,'ordinary');assert.deepEqual(w.behaviors.bolt,['quick']);assert.deepEqual(spellModifiers(w,'bolt'),{rank:.85,tempo:1.25,movement:1});
});
test('camp purchases debit once, reject stale/capped/unaffordable offers, and rerolls escalate',()=>{
 const w=scene();w.skills={bolt:1};w.status='camp';w.campaign.phase='camp';w.prepareCamp();const item=w.campaign.shopOffers[0];w.gold=item.price-1;const before=JSON.stringify(w.baseStats);assert.equal(w.buyCamp(item.offerId),false);assert.equal(JSON.stringify(w.baseStats),before);w.gold=500;assert.equal(w.buyCamp(item.offerId),true);assert.equal(w.gold,500-item.price);assert.equal(w.buyCamp(item.offerId),false);assert.equal(w.gold,500-item.price);assert.equal(w.campRerollCost(),12);const gold=w.gold;w.rerollCamp();assert.equal(w.gold,gold-12);assert.equal(w.campRerollCost(),24);
 const stale=w.campaign.shopOffers.find(c=>c.type==='skill');if(stale){w.skills[stale.id]=8;const g=w.gold;assert.equal(w.buyCamp(stale.offerId),false);assert.equal(w.gold,g);}
});
test('Magic Find statistically raises upgrade rarity without changing choice count',()=>{
 const measure=luck=>{const rng=random(123);let total=0;for(let i=0;i<20000;i++)total+=['common','uncommon','rare','epic','legendary'].indexOf(upgradeRarity(rng,luck).id);return total;};assert.ok(measure(3)>measure(0)*1.5);const w=scene();w.skills={bolt:1};assert.equal(ordinaryOffers(w).length,3);w.player.magicFind=3;assert.equal(ordinaryOffers(w).length,3);
});
test('rank inspection uses the same spell and cooldown calculations as actual casting',()=>{
 const w=scene();w.skills={shield:2};w.player.invulnerable=0;const info=inspectSpell(w,'shield');w.cast('shield',2);assert.equal(w.player.statuses.shield.pool,info.values.absorption);assert.equal(w.spellInterval('shield',2),info.interval);const p=scene();p.skills={bolt:2};const e=p.spawn('wolf');e.x=100;e.y=0;p.cast('bolt',2);assert.equal(p.projectiles[0].damage*p.player.damage*(1+p.player.spellDamage),inspectSpell(p,'bolt').values.damage);
});
test('save restores RNG, active choices, cooldowns, Sets and extraction without repeated scaling',()=>{
 const w=scene();w.skills={bolt:2};w.projectiles=[{x:1,y:2,hits:new Set([4]),ttl:2}];w.cooldowns.bolt=1.2;w.campaign.phase='extract';w.campaign.exit={x:100,y:200,armed:true};w.campaign.remaining=17;w.pendingLevels=2;w.offer();const snapshot=snapshotRun(w),a=restoreRun(snapshot),b=restoreRun(snapshot);assert.ok(a);assert.equal(a.cooldowns.bolt,1.2);assert.equal(a.campaign.remaining,17);assert.deepEqual(a.choices,w.choices);assert.deepEqual(a.projectiles[0].hits,new Set([4]));assert.equal(a.player.maxHp,b.player.maxHp);for(let i=0;i<10;i++)assert.equal(a.rng(),w.rng());assert.deepEqual(snapshotRun(b),snapshot);
});
test('malformed and terminal run snapshots cannot be continued',()=>{
 assert.equal(restoreRun(null),null);const w=scene(),s=snapshotRun(w);s.state.player.hp=-1;assert.equal(restoreRun(s),null);w.status='dead';assert.equal(snapshotRun(w),null);w.status='won';assert.equal(snapshotRun(w),null);
});
test('repeated movement passives add against class base instead of compounding',()=>{
 const w=scene(),speed=w.classBases.speed;for(let i=0;i<3;i++)assert.ok(applyGift(w,{id:'speed',type:'passive',stat:'speed',amount:speed*.05}));assert.ok(Math.abs(w.player.speed-speed*1.15)<1e-8);w.refreshEquipment();assert.ok(Math.abs(w.player.speed-speed*1.15)<1e-8);
});
test('weak overlapping melee cannot steal the shared contact window from a boss',()=>{
 for(const reversed of [false,true]){const w=scene();w.player.invulnerable=0;const weak=w.spawn('wolf'),boss=w.spawn('troll',true);Object.assign(weak,{x:0,y:0,damage:2,attackCooldown:0});Object.assign(boss,{x:0,y:0,damage:30,attackCooldown:0});if(reversed)w.enemies.reverse();const hp=w.player.hp;w.step(.05);assert.equal(hp-w.player.hp,30);}
});
test('physical starting classes have useful crowd attacks without learning a spell',()=>{
 const warrior=scene({hero:'warrior'});for(let i=0;i<3;i++){const e=warrior.spawn('wolf');e.x=40+i*5;e.y=0;}warrior.step(.05);assert.equal(warrior.enemies.filter(e=>e.hp<e.maxHp).length,3);const archer=scene({hero:'ranger'}),e=archer.spawn('wolf');e.x=150;e.y=0;archer.step(.05);assert.equal(archer.projectiles[0].pierce,3);
});
test('campaign casters mark a fixed position and movement dodges direct spell impacts',()=>{
 const w=scene(),e=w.spawn('skeleton_m3');e.x=200;e.y=0;e.attackCooldown=0;w.player.invulnerable=0;
 stepEnemyCaster(w,e,w.player,.05,true);assert.deepEqual(e.casting.aim,{x:0,y:0});assert.equal(e.casting.remaining,.7);assert.ok(w.effects.some(f=>f.kind==='enemy-target'));w.player.y=120;const hp=w.player.hp;stepEnemyCaster(w,e,w.player,.75,true);assert.equal(w.player.hp,hp);assert.ok(w.events.some(e=>e.type==='enemyDodged'));
 const archer=w.spawn('orc_sh');archer.x=200;archer.y=0;archer.attackCooldown=0;stepEnemyCaster(w,archer,w.player,.05,true);stepEnemyCaster(w,archer,w.player,.75,true);assert.equal(w.enemyProjectiles.at(-1).homing,false);
});
test('saving inside camp inventory restores camp, not active waves',()=>{
 const w=scene();w.campaign.phase='camp';w.status='inventory';const restored=restoreRun(snapshotRun(w));assert.ok(restored);assert.equal(restored.status,'camp');const time=restored.time;restored.step(.05);assert.equal(restored.time,time);
});
test('all playable affixes have an explicit consumer and eligible original item families',()=>{
 for(const [id,definition] of Object.entries(STAT_DEFINITIONS)){assert.ok(definition.consumer,id);assert.ok(definition.families.length,id);assert.equal(definition.baseline,0);assert.ok(definition.unit);}
});
test('rank-capped spells keep useful individual upgrades and can earn their fifth-purchase milestone',()=>{
 const w=scene();w.skills={bolt:8,shield:8};w.individualPurchases.bolt=4;
 assert.ok(ordinaryOffers(w,20).some(c=>c.id==='bolt'&&c.skillStat==='tempo'));
 assert.equal(applyGift(w,{id:'bolt',type:'skill',skillStat:'tempo',amount:.05}),true);assert.deepEqual(w.milestones,['bolt']);assert.equal(w.spellModifiers('bolt').tempo,1.05);
 assert.equal(applyGift(w,{id:'shield',type:'skill',skillStat:'ward',amount:.05}),true);assert.equal(w.spellModifiers('shield').rank,1.05);
 assert.equal(applyGift(w,{id:'bolt',type:'skill',skillStat:'tempo',amount:.05*3}),true);w.localBonuses.bolt.tempo=.5;assert.equal(applyGift(w,{id:'bolt',type:'skill',skillStat:'tempo',amount:.05}),false);assert.ok(!ordinaryOffers(w,20).some(c=>c.id==='bolt'));
});

test('Warrior sweep starts throughout its advertised reach and respects its edge',()=>{
 for(const bonus of [0,30])for(const offset of [-5,1]){const w=scene({hero:'warrior'});w.player.range=bonus;const e=w.spawn('wolf');Object.assign(e,{x:85+bonus+offset,y:0,speed:0,arrival:0,hp:1000,maxHp:1000});w.step(.05);assert.equal(e.hp<1000,offset<0);}
 const legacy=new World({hero:'warrior'});legacy.spawnTimer=Infinity;legacy.skills={};const e=legacy.spawn('wolf');Object.assign(e,{x:80,y:0,speed:0,arrival:0,hp:1000,maxHp:1000});legacy.step(.05);assert.equal(e.hp,1000);
});
test('flying guardian exits land on reachable ground rather than water',()=>{
 const a=MAP_ARENAS.find(a=>a.floor.some(v=>!v)),w=scene();w.campaign.mapId=a.id;w.campaign.route=[a.id];const boss=w.spawn('dragon',true),point=cellPosition(a,a.floor.findIndex(v=>!v));Object.assign(boss,point,{arrival:0,areaBoss:true});assert.equal(arenaWalkable(arenaFor(w),boss.x,boss.y,12),false);w.hurt(boss,boss.hp*100);assert.ok(arenaWalkable(a,w.campaign.exit.x,w.campaign.exit.y,12));assert.equal(w.campaign.phase,'extract');
});


test('camp prices scale with difficulty and progress; stale quotes are repriced once on resume',()=>{
 for(const [difficulty,first] of [['easy',16],['normal',24],['hard',48]]){
  const w=scene({difficulty});w.skills={bolt:1};w.status='camp';w.campaign.phase='camp';w.prepareCamp();assert.equal(campPrice(w,'common'),first);
  const c=w.campaign.shopOffers[0],old=c.price;c.price=1;w.gold=10000;assert.equal(w.buyCamp(c.offerId),false);const saved=snapshotRun(w),restored=restoreRun(saved);assert.equal(restored.campaign.shopOffers[0].price,old);assert.ok(restored.buyCamp(c.offerId));assert.equal(restored.gold,10000-old);
  const scale=shopPriceScale(w);w.campaign.index=w.campaign.route.length-1;assert.equal(shopPriceScale(w),scale*1.5);assert.equal(campPrice(w,'common'),Math.ceil(first*1.5));
 }
});

test('ore pays three times the former base yield and scales once with difficulty, route progress and Gold Find',()=>{
 for(const [difficulty,opening,ending] of [['easy',24,60],['normal',24,60],['hard',36,90]]){
  for(const late of [false,true]){const w=scene({difficulty});if(late)w.campaign.index=w.campaign.route.length-1;w.player.goldFind=1;const ore=w.campaign.deposits[0];ore.remaining=1;Object.assign(w.player,{x:ore.x,y:ore.y});advance(w,3.1);assert.equal(w.gold,2*(late?ending:opening));assert.equal(w.metrics.oreGold,w.gold);assert.equal(ore.remaining,0);}
 }
});


test('portals use reachable native floor away from both the hero and guardian across every map',()=>{
 const w=scene();for(const a of MAP_ARENAS){w.campaign.mapId=a.id;w.campaign.phase='combat';Object.assign(w.player,{x:0,y:0});const boss={x:0,y:0,areaBoss:true};openExit(w,boss);const e=w.campaign.exit;assert.ok(arenaWalkable(a,e.x,e.y,12),a.id);assert.ok(Math.hypot(e.x-w.player.x,e.y-w.player.y)>=128,a.id);assert.ok(Math.hypot(e.x-boss.x,e.y-boss.y)>=128,a.id);assert.equal(e.hold,0);}
});

test('portal activates after one second, requires one stationary second, and preserves paused/saved progress',()=>{
 const w=scene(),boss=guardian(w);w.hurt(boss,boss.hp*100);w.gems=[];w.lootDrops=[];const e=w.campaign.exit;Object.assign(w.player,{x:e.x,y:e.y});advance(w,.9);assert.equal(e.armed,false);assert.equal(e.hold,0);assert.equal(w.status,'playing');advance(w,.4);assert.ok(e.armed);assert.ok(e.hold>0&&e.hold<1);const held=e.hold;w.status='paused';advance(w,5);assert.equal(e.hold,held);
 const restored=restoreRun(snapshotRun(w));assert.equal(restored.campaign.exit.hold,held);assert.equal(restored.status,'playing');restored.step(.05,{x:1});assert.equal(restored.campaign.exit.hold,0);advance(restored,.5);assert.equal(restored.status,'playing');const exit=restored.campaign.exit;restored.player.x=exit.x+100;restored.step(.05);assert.equal(exit.hold,0);Object.assign(restored.player,{x:exit.x,y:exit.y});advance(restored,.95);assert.equal(restored.status,'playing');restored.step(.05);assert.equal(restored.status,'camp');
});
