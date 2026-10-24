import test from 'node:test';
import assert from 'node:assert/strict';
import {AssetLoader,assetGroups,actorEntries} from '../survivors/asset-loader.mjs';

test('shared images decode once, concurrency is bounded and progress means usable resources',async()=>{
 let active=0,peak=0,calls=0;const progress=[];
 const loader=new AssetLoader({concurrency:2,decode:async src=>{calls++;peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,5));active--;return {src,width:4,height:4};}});
 const output=await loader.group([['a',{src:'a'}],['alias',{src:'a'}],['b',{src:'b'}],['c',{src:'c'}]],{onProgress:p=>progress.push(p.completed)});
 assert.equal(calls,3);assert.equal(peak,2);assert.equal(output.a,output.alias);assert.deepEqual(progress,[0,1,2,3]);assert.equal(loader.stats.pending,0);
});
test('failed required loads settle, retry only missing resources and never claim a complete batch',async()=>{
 let fail=true;const calls=[];const loader=new AssetLoader({decode:async src=>{calls.push(src);if(src==='bad'&&fail)throw Error('network');return {width:2,height:2};}});
 const entries=[['good',{src:'good'}],['bad',{src:'bad'}]];
 await assert.rejects(loader.group(entries),/required image/);assert.equal(loader.stats.pending,0);
 fail=false;await loader.group(entries);assert.deepEqual(calls,['good','bad','bad']);
});
test('optional item retention is bounded and never evicts required combat images',async()=>{
 const loader=new AssetLoader({optionalCount:1,decode:async src=>({src,width:4,height:4})});
 await loader.group([['hero',{src:'hero'}]]);loader.optionalImage('a');await new Promise(r=>setTimeout(r,0));loader.optionalImage('b');await new Promise(r=>setTimeout(r,0));
 assert.equal(loader.cache.has('a'),false);assert.equal(loader.cache.has('hero'),true);assert.equal(loader.cache.has('b'),true);assert.equal(loader.stats.optional,1);
});
test('menu and combat groups preserve complete sprite/VFX coverage without eagerly loading every item icon',()=>{
 const manifest={sprites:{hero:{src:'hero'},mage:{src:'mage'},boss:{src:'boss'}},terrain:{hill:{src:'hill'}},vfx:{impact:{src:'impact'}},items:{bag:{src:'bag'},gold:{src:'gold'},ring:{src:'ring'}}};
 const groups=assetGroups(manifest,{mage:{sprite:'mage'}},{});
 assert.deepEqual(groups.menu.map(([id])=>id),['hero','mage']);assert.ok(!groups.play.some(([id])=>id==='boss'));assert.equal(actorEntries(manifest,['boss'],{}).length,1);assert.ok(groups.play.some(([id])=>id==='vfx:impact'));assert.ok(!groups.play.some(([,v])=>v.src==='ring'));
});

test('scene retention preserves selected actors and corpse donors but releases unrelated atlases',async()=>{
 const loader=new AssetLoader({decode:async src=>({src,width:4,height:4})}),manifest={sprites:{live:{src:'live'},dead:{src:'dead'},other:{src:'other'}}};
 const entries=actorEntries(manifest,['live'],{live:{registry:{ID:1,Dying:2}},dead:{registry:{ID:2}}});
 await loader.group([...entries,['other',manifest.sprites.other]]);loader.retainRequired(entries);assert.equal(loader.cache.has('other'),false);assert.equal(loader.cache.has('dead'),true);
});

test('summoned legacy actor names resolve to the same canonical atlas used by the renderer and trimmed package',()=>{
 const manifest={sprites:{skeleton_f1:{src:'skeleton'},zombie_f1:{src:'zombie'}}};
 assert.deepEqual(actorEntries(manifest,['skeleton','zombie'],{}).map(([id])=>id),['skeleton_f1','zombie_f1']);
});
