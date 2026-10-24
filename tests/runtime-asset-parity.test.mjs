import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {MONSTERS,projectileVfxById} from '../survivors/monsters.mjs';
const {collectRuntime}=createRequire(import.meta.url)('../tools/stage-electron.cjs');
test('trimmed actor data preserves renderer grounding, corpse donors and animation mappings',async()=>{
 const {code}=await collectRuntime(),source=code.get('monster-data.mjs');
 const {default:runtime}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.deepEqual(runtime.projectileVfxById,projectileVfxById);
 for(const [id,m] of Object.entries(MONSTERS)){
  assert.deepEqual(runtime.monsters[id].animation,m.animation,id+' actions');
  for(const field of ['ID','Dying','Z'])assert.deepEqual(runtime.monsters[id].registry[field],m.registry[field],id+' '+field);
 }
});
