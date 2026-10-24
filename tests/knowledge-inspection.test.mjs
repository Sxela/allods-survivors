import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {SPELLS,stepOriginal} from '../survivors/original-spells.mjs';
import {applyGift,UPGRADE_RARITIES,ordinaryOffers} from '../survivors/knowledge.mjs';
import {offerPreview,previewBuild} from '../survivors/offer-preview.mjs';
import {inspectSpell} from '../survivors/inspection.mjs';
import {currentStats} from '../survivors/build-stats.mjs';
import {offerHtml} from '../survivors/inspection-view.mjs';
import {makeItem} from '../survivors/loot.mjs';
import {snapshotRun,restoreRun} from '../survivors/run-state.mjs';
import {wavePlan} from '../survivors/campaign.mjs';
import {bestiaryEntries} from '../survivors/bestiary.mjs';
import {MONSTERS} from '../survivors/monsters.mjs';
const scene=()=>new World({campaign:true,seed:42});
function equip(w,stats){const item=makeItem(w.rng,{hero:w.hero,slot:'amulet',id:'inspection-item'});item.stats=stats;w.inventory.equipment.amulet=item;w.refreshEquipment();}
function choose(w,c){w.pendingLevels=1;w.rewardKind='ordinary';w.status='levelup';w.choices=[c];assert.ok(w.choose(0));}

test('every rarity previews exact HP and applies the displayed maximum without free healing or preview side effects',()=>{
 for(const rarity of UPGRADE_RARITIES){const w=scene();w.player.hp=62;const c={id:'vitality',type:'passive',stat:'maxHp',amount:10*rarity.bonus,name:'Heart of the allod'},before=snapshotRun(w),rng=w.rng.state(),preview=offerPreview(w,c),row=preview.lines.find(r=>r.label==='Maximum health');assert.equal(row.before,100);assert.equal(row.after,100+c.amount);assert.match(preview.summary,/HP/);assert.match(preview.summary,/does not heal/);assert.deepEqual(snapshotRun(w),before);assert.equal(w.rng.state(),rng);choose(w,c);assert.equal(w.player.maxHp,row.after);assert.equal(w.player.hp,62);assert.equal(w.statSources.level.maxHp,c.amount);}
});
test('all spell upgrade previews match real effective ranks, cooldowns and potency with item/school levels',()=>{
 for(const id of Object.keys(SPELLS)){const w=scene();w.skills={[id]:2};equip(w,{['skill:'+id]:3,[SPELLS[id].element+'Skill']:10});const c={id,type:'skill',rank:3.5},snapshot=snapshotRun(w),preview=offerPreview(w,c),copy=previewBuild(w);applyGift(copy,c);const expected=inspectSpell(copy,id);assert.deepEqual(snapshotRun(w),snapshot);choose(w,c);assert.deepEqual(inspectSpell(w,id),expected);assert.ok(preview.lines.some(r=>r.label.endsWith('Effective rank')&&r.after===expected.effectiveRank));assert.ok(preview.lines.some(r=>r.label.endsWith('Cooldown')&&r.after===expected.interval));}
});
test('behavior and capped individual previews expose the real tradeoff instead of labeling everything damage',()=>{
 const w=scene();w.skills={shield:8};const c={id:'shield',type:'behavior',mode:'focus',description:'Greater ward'};const p=offerPreview(w,c);assert.ok(p.lines.some(r=>r.label.endsWith('Shield pool')&&r.after>r.before));assert.ok(p.lines.some(r=>r.label.endsWith('Movement while ward is active')&&r.after<r.before));assert.equal(w.behaviors.shield,undefined);
 const capped=offerPreview(w,{id:'shield',type:'skill',skillStat:'ward',amount:.1});assert.match(capped.summary,/ward.*10.0/);assert.ok(capped.lines.some(r=>r.label.endsWith('Shield pool')&&r.after>r.before));
});
test('stats reconcile class, items, derived attributes, earned upgrades, paid camp and active effects',()=>{
 const w=scene();equip(w,{body:2,mind:3,maxHp:20,speed:5,fireResist:.2});applyGift(w,{id:'vitality',type:'passive',stat:'maxHp',amount:15});w.status='camp';w.campaign.phase='camp';w.campaign.shopOffers=[{id:'vitality',type:'passive',stat:'maxHp',amount:20,rarity:'epic',price:66,offerId:'paid'}];w.gold=100;assert.ok(w.buyCamp('paid'));assert.equal(w.gold,34);w.player.statuses.hasteSpell={ttl:12,multiplier:1.4};w.player.statuses.protectFire={ttl:5,reduction:.4};const rows=currentStats(w),hp=rows.find(r=>r.id==='maxHp');assert.equal(hp.value,165);assert.equal(hp.sources.Class,100);assert.equal(hp.sources.Items,20);assert.equal(hp.sources.Attributes,10);assert.equal(hp.sources['Level upgrades'],15);assert.equal(hp.sources['Camp upgrades'],20);assert.equal(rows.find(r=>r.id==='speed').value,w.player.speed*1.4);assert.ok(Math.abs(rows.find(r=>r.id==='fireResist').value-.52)<1e-9);assert.equal(rows.find(r=>r.id==='spellDamage').sources.Attributes,.045);const restored=restoreRun(snapshotRun(w));assert.deepEqual(restored.statSources,w.statSources);
});
test('older builds retain untracked improvements and malformed contribution ledgers cannot break the stats screen',()=>{
 const w=scene();applyGift(w,{id:'vitality',type:'passive',stat:'maxHp',amount:10});const raw=snapshotRun(w);delete raw.state.statSources;const restored=restoreRun(raw);assert.equal(currentStats(restored).find(r=>r.id==='maxHp').sources['Earlier improvements'],10);for(const invalid of ['bad',[],{level:{maxHp:'bad'}}]){raw.state.statSources=invalid;assert.equal(restoreRun(raw),null);}
});
test('equipment-only spells remain autocasts, not learned or individually upgradeable after inspection',()=>{
 const w=scene();equip(w,{'skill:firewall':3});assert.equal(inspectSpell(w,'firewall').source,'gear');const before=snapshotRun(w);currentStats(w);offerPreview(w,{id:'power',type:'passive',stat:'damage',amount:.1});assert.deepEqual(snapshotRun(w),before);assert.equal(w.skills.firewall,undefined);assert.ok(ordinaryOffers(w,30).every(c=>c.id!=='firewall'));
});
test('bestiary search/local filtering, pagination and scaled values agree with actual spawning',()=>{
 const w=scene(),local=bestiaryEntries(w);assert.ok(local.entries.every(e=>e.local));const all=bestiaryEntries(w,{local:false});assert.ok(all.pages>1);assert.notDeepEqual(all.entries.map(e=>e.id),bestiaryEntries(w,{local:false,page:1}).entries.map(e=>e.id));assert.equal(bestiaryEntries(w,{query:'no-such-creature'}).total,0);
 for(const role of ['ordinary','captain','guardian']){const data=bestiaryEntries(w,{query:'orc_sh',local:false,role}),e=data.entries[0],live=w.spawn('orc_sh',role==='guardian');if(role==='captain'){live.hp*=3;live.damage*=1.15;}assert.equal(e.hp,live.hp);assert.equal(e.damage,live.damage);assert.equal(e.range,550);assert.ok(e.spells.includes('bolt'));assert.ok(e.variants.includes('orc_sh'));assert.ok(e.zones.length);}
 assert.ok(Object.keys(MONSTERS).length>all.entries.length);
});
test('waves arrive as larger budgeted groups, intensify within an area, and remain bounded on long routes',()=>{
 const w=scene(),first=wavePlan(w,1),third=wavePlan(w,3);assert.ok(first.min>=25&&first.max<=50);assert.ok(first.arrivalsPerSecond>=.8&&first.arrivalsPerSecond<=1.7);assert.equal(third.min-first.min,5);w.skills={};w.player.invulnerable=1000;w.campaign.trickleTimer=Infinity;w.step(.05);const requested=w.enemies.length+w.campaign.queue.length;w.campaign.trickleTimer=Infinity;assert.equal(w.enemies.length,4);assert.ok(requested>=first.min&&requested<=first.max);for(let i=0;i<20;i++)w.step(.05);assert.equal(w.campaign.queue.length,0);assert.equal(w.enemies.length,requested);for(const count of [12,Infinity]){const a=new World({campaign:true,areaCount:count});a.campaign.index=a.campaign.route.length-1;const max=wavePlan(a,10000);assert.ok(max.max<=85);}
});
test('a stale fixed description never overrides the exact rolled card preview',()=>{
 const w=scene(),html=offerHtml(w,{id:'vitality',name:'Heart of the allod',description:'Gain 25 maximum health',type:'passive',stat:'maxHp',amount:30});assert.match(html,/30.0 HP/);assert.match(html,/130.0 HP/);assert.doesNotMatch(html,/Gain 25/);
});

test('weapon timing keeps seconds separate from the fractional attack-speed source',()=>{
 const w=new World({hero:'warrior',campaign:true});equip(w,{attackSpeed:.12,range:15});const row=currentStats(w).find(r=>r.id==='weaponInterval');assert.equal(row.value,.75/1.12);assert.equal(row.sourceUnits['Attack-speed rate bonus'],'fraction');assert.equal(currentStats(w).find(r=>r.id==='weaponReach').value,100);
});

test('fresh campaign Mage has focused and original area attacks without a cast-rate or damage buff',()=>{
 const mage=new World({hero:'mage',campaign:true}),warrior=new World({hero:'warrior',campaign:true}),archer=new World({hero:'ranger',campaign:true});assert.deepEqual(mage.skills,{bolt:1,fireball:1});assert.equal(mage.player.haste,1);assert.equal(mage.player.damage,1);assert.deepEqual(warrior.skills,{shield:1});assert.deepEqual(archer.skills,{poison:1});const saved=snapshotRun(mage);saved.state.skills={bolt:1};assert.deepEqual(restoreRun(saved).skills,{bolt:1});
});

test('difficulty find and gold layers remain visible without double-counting rolled item stats',()=>{
 const w=new World({campaign:true,difficulty:'hard'});equip(w,{magicFind:.2,goldFind:.4});const rows=currentStats(w);assert.equal(rows.find(r=>r.id==='magicFind').value,.2);assert.equal(rows.find(r=>r.id==='equipmentFind').value,1.2);assert.equal(rows.find(r=>r.id==='equipmentFind').sources.Difficulty,1);assert.ok(Math.abs(rows.find(r=>r.id==='goldPayout').value-2.1)<1e-9);
});


test('damage/cast-rate tradeoffs show sustained DPS consistent with real direct hits',()=>{
 for(const mode of ['quick','focus']){
  const w=scene();w.skills={lightning:1};const e=w.spawn('wolf',false,{x:100,y:0});Object.assign(e,{hp:100000,maxHp:100000,arrival:0,statuses:{}});
  const before=inspectSpell(w,'lightning'),preview=offerPreview(w,{id:'lightning',type:'behavior',mode,description:'Tradeoff'}),row=preview.lines.find(r=>r.label.endsWith('Est. DPS / target'));
  assert.ok(row);assert.equal(row.before,before.values.damage/before.interval);w.behaviors.lightning=[mode];
  const after=inspectSpell(w,'lightning'),damageBefore=w.metrics.damageDealt;assert.ok(w.cast('lightning',1));const dealt=w.metrics.damageDealt-damageBefore;
  assert.equal(row.after,dealt/w.spellInterval('lightning',1));
  if(mode==='focus'){assert.ok(after.values.damage>before.values.damage);assert.ok(after.interval>before.interval);assert.ok(row.after<row.before,'stronger but slower low-rank spell loses sustained DPS');}
  else{assert.ok(after.values.damage<before.values.damage);assert.ok(after.interval<before.interval);assert.ok(row.after>row.before);}
 }
});
test('persistent-field DPS includes all full-contact ticks per cast and the cast interval',()=>{
 for(const id of ['frost','firewall']){
  const w=scene();w.skills={[id]:2};equip(w,{spellDamage:.2,['skill:'+id]:3});const e=w.spawn('wolf',false,{x:100,y:0});Object.assign(e,{hp:100000,maxHp:100000,arrival:0,statuses:{}});
  const info=inspectSpell(w,id);assert.ok(w.cast(id,2));for(let i=0;i<Math.ceil((info.values.duration+.1)/.01);i++)stepOriginal(w,.01);
  assert.ok(Math.abs(info.dps.value-w.metrics.damageDealt/info.interval)<1e-8,id+' field DPS must match actual full-duration damage per cast');
  assert.match(info.dps.note,/full-duration contact/);assert.match(info.dps.label,/field DPS/);
  const row=offerPreview(w,{id,type:'skill',rank:3}).lines.find(r=>r.unit==='DPS');assert.ok(row.after>row.before);
 }
 const poison=scene();poison.skills={poison:2};assert.match(inspectSpell(poison,'poison').dps.note,/Excludes lingering poison/);
});
test('shared damage and haste previews include item-granted DPS without mutating the live build',()=>{
 for(const stat of ['damage','haste']){const w=scene();equip(w,{'skill:firewall':3,spellDamage:.25});const snapshot=snapshotRun(w),choice={id:stat==='damage'?'power':stat,type:'passive',stat,amount:.2},rows=offerPreview(w,choice).lines.filter(r=>r.unit==='DPS');assert.ok(rows.some(r=>r.label.startsWith('Fire Arrow')));assert.ok(rows.some(r=>r.label.startsWith('Wall of Fire')));assert.ok(rows.every(r=>r.after>r.before));assert.deepEqual(snapshotRun(w),snapshot);assert.equal(w.skills.firewall,undefined);}
});
test('DPS remains unchanged at the cooldown floor and utility spells do not invent damage',()=>{
 const w=scene();w.player.haste=100;w.skills={lightning:8};const row=offerPreview(w,{id:'lightning',type:'skill',skillStat:'tempo',amount:.1}).lines.find(r=>r.unit==='DPS');assert.equal(row,undefined,'No duplicate unchanged DPS row at the cast floor');
 for(const id of ['shield','heal','invisibility','summon']){w.skills={[id]:1};assert.equal(inspectSpell(w,id).dps,null);assert.ok(!offerPreview(w,{id,type:'skill',rank:2}).lines.some(r=>r.unit==='DPS'));}
});
test('DPS is per target, appears on learn/remove previews and renders assumptions with one decimal',()=>{
 const w=scene();w.skills={prismatic:1};const info=inspectSpell(w,'prismatic');assert.equal(info.dps.value,info.values.damage/info.interval);
 const learning=offerPreview(w,{id:'fireball',type:'learn'}).lines.find(r=>r.unit==='DPS');assert.equal(learning.before,0);assert.ok(learning.after>0);
 const removed=offerPreview(w,{id:'fireball',type:'replace'},'prismatic').lines.find(r=>r.label.startsWith('Prismatic')&&r.unit==='DPS');assert.ok(removed.before>0);assert.equal(removed.after,0);
 const html=offerHtml(w,{id:'prismatic',type:'skill',rank:2});assert.match(html,/Est. DPS \/ target/);assert.match(html,/\d+\.\d DPS/);assert.match(html,/Before resistance/);
});

test('field estimates allow the final tick boundary without changing combat timing',()=>{
 const w=scene();w.skills={frost:4};const e=w.spawn('wolf',false,{x:100,y:0});Object.assign(e,{hp:100000,maxHp:100000,arrival:0,statuses:{}});const info=inspectSpell(w,'frost');w.cast('frost',4);for(let i=0;i<460;i++)stepOriginal(w,.01);assert.ok(Math.abs(info.dps.value-w.metrics.damageDealt/info.interval)<=info.values.damage/info.interval+1e-8);assert.match(info.dps.label,/Est\./);
});


test('hero-upgrade labels keep spell separators while individual cards omit only their own spell prefix',()=>{
 const w=scene();w.skills={fireball:2};const hero=offerHtml(w,{id:'haste',type:'passive',stat:'haste',amount:.08});assert.match(hero,/Fireball - Cooldown/);assert.match(hero,/Fireball - Est\. DPS/);assert.doesNotMatch(hero,/FireballCooldown/);
 const spell=offerHtml(w,{id:'fireball',type:'skill',rank:3});assert.match(spell,/>Cooldown<\/dt>/);assert.doesNotMatch(spell,/Fireball - Cooldown/);
});
