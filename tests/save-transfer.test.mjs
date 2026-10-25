import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSaveImport,MAX_SAVE_BYTES} from '../survivors/save-transfer.mjs';
import {World} from '../survivors/core.mjs';
import {snapshotRun} from '../survivors/run-state.mjs';
const progress=()=>({gold:23,best:150,runs:2,upgrades:{},inventory:{bag:[],equipment:{}},difficulty:'hard'});

test('exported progress and active runs survive import validation without advancing them',()=>{
 const save={...progress(),run:snapshotRun(new World({campaign:true,seed:8128}))};
 assert.deepEqual(parseSaveImport(JSON.stringify(save)),save);
 assert.deepEqual(parseSaveImport('\uFEFF'+JSON.stringify(progress())),progress());
});
test('malformed, unrelated and invalid numeric saves are rejected',()=>{
 for(const data of ['{bad','null','[]','{}',JSON.stringify({...progress(),gold:-1}),JSON.stringify({...progress(),inventory:[]}),JSON.stringify({...progress(),runs:-1}),JSON.stringify({...progress(),upgrades:{power:'bad'}}),JSON.stringify({...progress(),shopStock:{}})])assert.throws(()=>parseSaveImport(data));
});
test('an invalid embedded run rejects the whole import rather than losing the current journey silently',()=>{
 assert.throws(()=>parseSaveImport(JSON.stringify({...progress(),run:{version:1,state:{}}})),/could not be restored/);
});
test('unsafe object keys are rejected and unknown top-level fields are omitted',()=>{
 assert.throws(()=>parseSaveImport('{"gold":0,"inventory":{},"__proto__":{"bad":true}}'),/valid save JSON/);
 assert.deepEqual(parseSaveImport(JSON.stringify({...progress(),unrecognized:'not progress'})),progress());
 assert.equal({}.bad,undefined);
});
test('oversized input is rejected by UTF-8 size, including multi-byte content',()=>{
 assert.throws(()=>parseSaveImport(' '.repeat(MAX_SAVE_BYTES+1)),/4 MB/);
 assert.throws(()=>parseSaveImport('\u00e9'.repeat(MAX_SAVE_BYTES/2+1)),/4 MB/);
});
