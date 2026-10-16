import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildPlatform,builderArguments,archivePath}=require('../tools/build-electron.cjs');
const {releaseVersion,prepareRelease}=require('../tools/prepare-release.cjs');

test('desktop builds choose the host platform or an explicit target without publishing',()=>{
  assert.equal(buildPlatform([],'win32'),'win32');
  assert.equal(buildPlatform([],'linux'),'linux');
  assert.equal(buildPlatform(['--linux'],'win32'),'linux');
  assert.equal(buildPlatform(['--win'],'linux'),'win32');
  for(const host of ['win32','linux']){
    const args=builderArguments(['--dir'],host);
    assert.ok(args.includes(host==='linux'?'--linux':'--win'));
    assert.ok(args.includes('--x64'));assert.ok(args.includes('--dir'));
    assert.equal(args[args.indexOf('--publish')+1],'never');
  }
  assert.throws(()=>builderArguments(['--win','--linux']),/one platform/);
  assert.throws(()=>builderArguments(['--publish','always']),/Unsupported/);
  assert.throws(()=>builderArguments([],'darwin'),/Choose/);
  assert.equal(archivePath('linux'),'linux-unpacked/resources/app.asar');
  assert.equal(archivePath('win32'),'win-unpacked/resources/app.asar');
  assert.throws(()=>archivePath('../escape'),/Unsupported/);
});

test('release input normalizes tags and distinguishes prereleases',()=>{
  assert.deepEqual(releaseVersion('v1.2.3'),{version:'1.2.3',tag:'v1.2.3',prerelease:false});
  assert.deepEqual(releaseVersion('2.0.0-beta.1'),{version:'2.0.0-beta.1',tag:'v2.0.0-beta.1',prerelease:true});
  for(const value of ['',undefined,'1.2.3'+String.fromCharCode(10),'1.2','01.2.3','1.2.3-01','1.2.3\nextra','1.2.3\n','1.2.3; echo bad','../1.2.3','70000.0.0','1.2.3+metadata'])assert.throws(()=>releaseVersion(value),String(value));
});

test('release preparation updates only root package versions and never creates a commit',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'allods-release-'));
  try{
    const dependency={version:'9.8.7',integrity:'unchanged'};
    await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name:'test-game',version:'0.1.0',scripts:{test:'unchanged'}}));
    await fs.writeFile(path.join(dir,'package-lock.json'),JSON.stringify({version:'0.1.0',lockfileVersion:3,packages:{'':{version:'0.1.0'},'node_modules/example':dependency}}));
    await prepareRelease('v1.4.2-beta.3',dir);
    const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'))),lock=JSON.parse(await fs.readFile(path.join(dir,'package-lock.json')));
    assert.equal(pkg.version,'1.4.2-beta.3');assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
    assert.deepEqual(lock.packages['node_modules/example'],dependency);assert.equal(pkg.scripts.test,'unchanged');
    const before=await fs.readFile(path.join(dir,'package.json'));
    await assert.rejects(prepareRelease('bad-input',dir));
    assert.deepEqual(await fs.readFile(path.join(dir,'package.json')),before);
    assert.deepEqual((await fs.readdir(dir)).sort(),['package-lock.json','package.json']);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
