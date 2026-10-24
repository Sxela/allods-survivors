import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {MONSTERS} from '../survivors/monsters.mjs';
import {SPELLS} from '../survivors/original-spells.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),game=path.join(root,'survivors');
export async function audit(){
 const bytes=await fs.readFile(path.join(game,'assets/manifest.json')),manifest=JSON.parse(bytes),failures=[],payloads=new Map(),frames=[];
 for(const category of ['sprites','terrain','vfx','items','sounds','paperdolls'])for(const [id,entry] of Object.entries(manifest[category]||{})){
  const resources=[];const visit=v=>{if(v&&typeof v==='object'){if(v.src)resources.push(v);for(const child of Object.values(v))if(typeof child==='object')visit(child);}};visit(entry);
  for(const v of resources){
   const relative=v.src;if(!relative.startsWith('assets/')||relative.includes('..')){failures.push(`${category}/${id}: unsafe path`);continue;}
   try{
    let body=payloads.get(relative);if(!body){body=await fs.readFile(path.join(game,relative));payloads.set(relative,body);}
    if(relative.endsWith('.png')){
     if(body.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('invalid PNG');
     const width=body.readUInt32BE(16),height=body.readUInt32BE(20);
     for(const f of v.frames||[])if(![f.x,f.y,f.w,f.h].every(Number.isFinite)||f.x<0||f.y<0||f.w<=0||f.h<=0||f.x+f.w>width||f.y+f.h>height)throw Error('frame outside atlas');
     frames.push({category,id,path:relative,width,height,frames:v.frames?.length||1,decodedBytes:width*height*4});
    }
   }catch(error){failures.push(`${category}/${id}: ${error.code==='ENOENT'?'missing payload':error.message}`);}
  }
 }
 const actors=Object.entries(MONSTERS).map(([id,m])=>{
  if(!manifest.sprites[id])failures.push(`actor/${id}: missing atlas`);
  return {id,actions:Object.keys(m.animation||{}),corpseDonor:m.registry.Dying??m.registry.ID,roles:{atlas:'mapped',movement:'runtime-mapped; visual review required',death:'runtime donor/fallback; per-identity review required',sound:'shared event sounds; source-specific parity unverified'}};
 });
 const spells=Object.entries(SPELLS).map(([id,s])=>{
  if(!manifest.vfx[s.vfx])failures.push(`spell/${id}: missing VFX ${s.vfx}`);
  return {id,name:s.name,vfx:s.vfx,icon:s.icon,roles:{primary:'mapped',castImpactStatus:'per-role runtime/visual review required',sound:'element/event mapping; native stage parity unverified'}};
 });
 return {manifestSha256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Static dependency/frame bounds audit; not proof of visual fidelity, original behavior or audible parity',summary:{uniquePayloads:payloads.size,bytes:[...payloads.values()].reduce((n,b)=>n+b.length,0),actors:actors.length,spells:spells.length},failures,actors,spells,frames};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=await audit(),out=path.join(root,'.build/asset-parity');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({summary:report.summary,failures:report.failures},null,2));if(report.failures.length)process.exitCode=1;
}
