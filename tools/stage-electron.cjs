// Build a dependency-closed runtime, never copy the source game directory.
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),SOURCE=path.join(ROOT,'survivors'),STAGE=path.join(ROOT,'.build/electron-app');
const SCRUB=new Set(['source','evidence','registry','encoding','fpsEvidence','sourceItemId','sourceCells']);
function runtimeMetadata(value){
  if(Array.isArray(value))return value.map(runtimeMetadata);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!SCRUB.has(key)).map(([key,value])=>[key,runtimeMetadata(value)]));
  return value;
}
async function collectRuntime(){
  const [{CLASSES,SKILLS},{MONSTERS,projectileVfxById},{BIOMES},{POWERUPS},original,{SCENERY_IDS,LANDSCAPE_TERRAIN},{NATIVE_SCENERY_IDS}]=await Promise.all([
    import(pathToFileURL(path.join(SOURCE,'core.mjs'))),import(pathToFileURL(path.join(SOURCE,'monsters.mjs'))),import(pathToFileURL(path.join(SOURCE,'biomes.mjs'))),import(pathToFileURL(path.join(SOURCE,'powerups.mjs'))),fs.readFile(path.join(SOURCE,'assets/manifest.json'),'utf8').then(JSON.parse),import(pathToFileURL(path.join(SOURCE,'landscape.mjs'))),import(pathToFileURL(path.join(SOURCE,'map-arenas.mjs')))
  ]);
  const code=new Map(),assets=new Set();
  const addAsset=relative=>{
    const normalized=relative.replace(/\\/g,'/');
    if(normalized==='assets/manifest.json')return; // Generated below, never copy source metadata.
    if(!normalized.startsWith('assets/')||normalized.includes('..')||normalized.includes('$'))throw new Error(`Invalid runtime asset: ${relative}`);
    assets.add(normalized);
  };
  const scan=async relative=>{
    if(code.has(relative))return;const absolute=path.resolve(SOURCE,relative);
    if(!absolute.startsWith(SOURCE+path.sep))throw new Error('Runtime dependency escaped source');
    const text=await fs.readFile(absolute,'utf8');code.set(relative,text);
    for(const match of text.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))await scan(path.posix.normalize(path.posix.join(path.posix.dirname(relative),match[1])));
    for(const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)){
      const ref=match[1];if(ref.includes('${')||ref.includes('://')||ref.startsWith('data:'))continue;
      if(ref.startsWith('assets/'))addAsset(ref);else if(/\.(css|mjs)$/.test(ref))await scan(ref);
    }
    for(const match of text.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g))if(match[1].startsWith('assets/'))addAsset(match[1]);
    for(const match of text.matchAll(/['"](assets\/[^'"`]+)['"]/g))if(!match[1].includes('${')&&!match[1].includes('<'))addAsset(match[1]);
  };
  await scan('index.html');
  const select=(category,ids)=>Object.fromEntries([...new Set(ids)].map(id=>{
    const value=original[category][id];if(!value)throw new Error(`Missing ${category} runtime entry: ${id}`);
    addAsset(value.src);return [id,runtimeMetadata(value)];
  }));
  const manifest={version:original.version,
    sprites:select('sprites',['hero',...Object.values(CLASSES).map(c=>c.sprite),...Object.keys(MONSTERS),...SCENERY_IDS,...NATIVE_SCENERY_IDS]),
    terrain:select('terrain',[...BIOMES.map(b=>b.ground),...LANDSCAPE_TERRAIN]),
    vfx:select('vfx',[...Object.values(SKILLS).map(s=>s.vfx),...Object.values(POWERUPS).map(p=>p.vfx),...Object.values(MONSTERS).map(m=>projectileVfxById[m.projectileId]).filter(Boolean),'poison_hit','ice_dust','explosion']),
    items:select('items',Object.keys(original.items)),sounds:select('sounds',Object.keys(original.sounds)),paperdolls:runtimeMetadata(original.paperdolls)
  };
  const collectSrc=value=>{
    if(!value||typeof value!=='object')return;
    if(typeof value.src==='string')addAsset(value.src);
    for(const child of Object.values(value))if(typeof child==='object')collectSrc(child);
  };
  // Ground loot now renders the item's icon; only the legacy bag fallback is used.
  delete manifest.items.bag.variants;
  collectSrc(manifest.paperdolls);
  collectSrc(manifest.items);
  for(const skill of Object.values(SKILLS))addAsset(`assets/ui-${skill.icon}.png`);
  for(const p of Object.values(POWERUPS))addAsset(`assets/ui-${p.icon}.png`);
  for(const icon of ['sword','haste','healing','magic'])addAsset(`assets/ui-spell-${icon}.png`);
  // The manifest retains only UI entries actually referenced by CSS/code.
  manifest.ui=Object.fromEntries(Object.entries(original.ui).filter(([,v])=>assets.has(v.src)).map(([id,v])=>[id,runtimeMetadata(v)]));
  manifest.icons=Object.fromEntries(Object.entries(original.icons).filter(([,v])=>assets.has(v.src)).map(([id,v])=>[id,runtimeMetadata(v)]));
  const runtimeMonsters=Object.fromEntries(Object.entries(MONSTERS).map(([id,m])=>[id,{...runtimeMetadata(m),registry:{ID:m.registry.ID,...(m.registry.Dying!==undefined?{Dying:m.registry.Dying}:{})}}]));
  code.set('monster-data.mjs',`// Runtime-only fields used by spawning and animation.\nexport default ${JSON.stringify({monsters:runtimeMonsters,projectileVfxById})};\n`);
  return {code,manifest,assets};
}
async function stage(){
  const {code,manifest,assets}=await collectRuntime();
  // The generated stage is the only directory that may be replaced.
  if(STAGE!==path.join(ROOT,'.build','electron-app'))throw new Error('Invalid staging target');
  await fs.rm(STAGE,{recursive:true,force:true});await fs.mkdir(path.join(STAGE,'game/assets'),{recursive:true});
  for(const [file,text] of code){await fs.mkdir(path.dirname(path.join(STAGE,'game',file)),{recursive:true});await fs.writeFile(path.join(STAGE,'game',file),text);}
  await fs.writeFile(path.join(STAGE,'game/assets/manifest.json'),JSON.stringify(manifest));
  const inventory=[];
  for(const file of [...assets].sort()){
    const bytes=await fs.readFile(path.join(SOURCE,file));await fs.copyFile(path.join(SOURCE,file),path.join(STAGE,'game',file));
    inventory.push({path:`game/${file}`,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  for(const file of ['main.cjs','protocol.cjs'])await fs.copyFile(path.join(ROOT,'desktop',file),path.join(STAGE,file));
  const pkg=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8'));
  await fs.writeFile(path.join(STAGE,'package.json'),JSON.stringify({name:'allods-survivors',version:pkg.version,productName:'Allods Survivors',description:'A standalone Allods survival game',author:'Local project',private:true,main:'main.cjs'}));
  const report={code:[...code.keys()].sort().map(p=>'game/'+p),assets:inventory,assetBytes:inventory.reduce((sum,a)=>sum+a.bytes,0),sourceAssetFiles:(await fs.readdir(path.join(SOURCE,'assets'))).length,assetCount:inventory.length};
  await fs.writeFile(path.join(ROOT,'.build/electron-asset-report.json'),JSON.stringify(report,null,2));
  console.log(`Staged ${code.size} game code files and ${report.assetCount} referenced assets (${(report.assetBytes/1024/1024).toFixed(2)} MiB).`);
  return {stage:STAGE,report};
}
module.exports={stage,STAGE,collectRuntime};
if(require.main===module)stage().catch(error=>{console.error(error);process.exitCode=1;});
