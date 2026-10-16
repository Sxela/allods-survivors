const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const asar=require('@electron/asar');
const {STAGE}=require('./stage-electron.cjs');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
  const archive=path.join(ROOT,'dist/win-unpacked/resources/app.asar');
  const report=JSON.parse(await fs.readFile(path.join(ROOT,'.build/electron-asset-report.json'),'utf8'));
  const files=asar.listPackage(archive).map(p=>p.replace(/\\/g,'/').replace(/^\//,''))
    .filter(p=>!asar.statFile(archive,p.replace(/\//g,path.sep)).files).sort();
  const expected=[...report.code,...report.assets.map(a=>a.path),'game/assets/manifest.json','main.cjs','protocol.cjs','package.json'].sort();
  if(JSON.stringify(files)!==JSON.stringify(expected))throw new Error(`Packaged file list differs from allowlist. Extra: ${files.filter(p=>!expected.includes(p))}. Missing: ${expected.filter(p=>!files.includes(p))}`);
  let gameBytes=0;
  for(const file of files){
    const actual=asar.extractFile(archive,file.replace(/\//g,path.sep));
    if(file!=='package.json'){
      const staged=await fs.readFile(path.join(STAGE,file));
      if(!actual.equals(staged))throw new Error(`Packaged file differs from audited stage: ${file}`);
    }
    if(file.startsWith('game/'))gameBytes+=actual.length;
  }
  const sourceAssets=await fs.readdir(path.join(ROOT,'survivors/assets'));
  const excluded=sourceAssets.filter(file=>file!=='manifest.json'&&!report.assets.some(a=>a.path===`game/assets/${file}`)).sort();
  const result={verified:true,archive:'win-unpacked/resources/app.asar',archiveSha256:crypto.createHash('sha256').update(await fs.readFile(archive)).digest('hex'),fileCount:files.length,assetCount:report.assetCount,gamePayloadBytes:gameBytes,excludedAssets:excluded,files,assets:report.assets};
  await fs.writeFile(path.join(ROOT,'dist/asset-report.json'),JSON.stringify(result,null,2));
  console.log(`ASAR audit passed: exactly ${files.length} allowed files, ${report.assetCount} referenced assets, ${excluded.length} unused extracted files excluded. Game payload ${(gameBytes/1024/1024).toFixed(2)} MiB.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
