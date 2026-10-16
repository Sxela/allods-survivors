import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const asar=require('@electron/asar');
const {audit}=require('../tools/audit-electron.cjs');

async function fixture(fn){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'allods-audit-'));
  try{
    const stage=path.join(root,'.build/electron-app');
    const files={'package.json':JSON.stringify({version:'1.2.3',main:'main.cjs'}),'main.cjs':'// desktop','protocol.cjs':'// protocol','game/index.html':'<canvas></canvas>','game/assets/manifest.json':'{}'};
    for(const [name,bytes] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(stage,name)),{recursive:true});await fs.writeFile(path.join(stage,name),bytes);}
    await fs.writeFile(path.join(root,'.build/electron-asset-report.json'),JSON.stringify({code:['game/index.html'],assets:[],assetCount:0}));
    await fs.mkdir(path.join(root,'survivors/assets'),{recursive:true});await fs.writeFile(path.join(root,'survivors/assets/unused.png'),'unused');
    const pack=async(platform='linux')=>{
      const archive=path.join(root,'dist',platform==='linux'?'linux-unpacked':'win-unpacked','resources/app.asar');
      await fs.mkdir(path.dirname(archive),{recursive:true});await asar.createPackage(stage,archive);asar.uncache(archive);
    };
    await fn({root,stage,pack});
  }finally{await fs.rm(root,{recursive:true,force:true});}
}

test('package audit verifies the actual Windows and Linux archive and lists excluded assets',async()=>{
  await fixture(async({root,pack})=>{
    for(const platform of ['win32','linux']){
      await pack(platform);const result=await audit(root,platform);
      assert.equal(result.verified,true);assert.equal(result.fileCount,5);
      assert.deepEqual(result.excludedAssets,['unused.png']);assert.match(result.archiveSha256,/^[a-f0-9]{64}$/);
    }
  });
});

test('package audit rejects unallowlisted files in the actual archive',async()=>{
  await fixture(async({root,stage,pack})=>{
    await fs.writeFile(path.join(stage,'private.txt'),'unexpected');await pack();
    await assert.rejects(audit(root,'linux'),/file list differs/);
  });
});

test('package audit rejects modified runtime bytes and wrong embedded versions',async()=>{
  await fixture(async({root,stage,pack})=>{
    await pack();await fs.writeFile(path.join(stage,'game/index.html'),'changed');
    await assert.rejects(audit(root,'linux'),/differs from audited stage/);
    await pack();await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({version:'9.9.9',main:'main.cjs'}));
    await assert.rejects(audit(root,'linux'),/metadata differs/);
  });
});
