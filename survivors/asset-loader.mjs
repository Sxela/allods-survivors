// Presentation resources only. This module never reads or advances simulation state.
export class AssetLoader {
  constructor({decode=decodeImage,concurrency=8,optionalBytes=24*1024*1024,optionalCount=64}={}){
    this.decode=decode;this.concurrency=concurrency;this.optionalBytes=optionalBytes;this.optionalCount=optionalCount;
    this.cache=new Map();this.pending=new Map();this.pinned=new Set();this.optional=new Map();this.failed=new Map();this.active=0;this.waiters=[];
  }
  async image(src,{pin=false}={}){
    if(pin){this.pinned.add(src);this.optional.delete(src);}
    if(this.cache.has(src))return this.cache.get(src);
    if(this.pending.has(src))return this.pending.get(src);
    const work=(async()=>{
      if(this.active>=this.concurrency)await new Promise(resolve=>this.waiters.push(resolve));
      this.active++;
      try{const image=await this.decode(src);this.cache.set(src,image);this.failed.delete(src);return image;}
      finally{this.active--;this.waiters.shift()?.();}
    })();
    this.pending.set(src,work);
    try{return await work;}finally{this.pending.delete(src);}
  }
  async group(entries,{stage='Loading artwork',onProgress=()=>{}}={}){
    const unique=[...new Set(entries.map(([,v])=>v.src))];let completed=0;
    onProgress({stage,completed,total:unique.length});
    const settled=await Promise.allSettled(unique.map(async src=>{
      await this.image(src,{pin:true});onProgress({stage,completed:++completed,total:unique.length});
    }));
    const failures=settled.flatMap((r,i)=>r.status==='rejected'?[unique[i]]:[]);
    if(failures.length)throw Error(`Could not load ${failures.length} required image(s): ${failures.slice(0,2).join(', ')}. Check the connection or asset setup, then retry.`);
    return Object.fromEntries(entries.map(([id,v])=>[id,this.cache.get(v.src)]));
  }
  optionalImage(src){
    if(!src)return null;
    const image=this.cache.get(src);
    if(image){if(!this.pinned.has(src)){this.optional.delete(src);this.optional.set(src,image);this.trim();}return image;}
    if(!this.pending.has(src)&&(this.failed.get(src)||0)<Date.now())this.image(src).then(value=>{
      if(!this.pinned.has(src)){this.optional.set(src,value);this.trim();}
    }).catch(()=>this.failed.set(src,Date.now()+30000));
    return null;
  }
  trim(){
    let bytes=[...this.optional.values()].reduce((n,img)=>n+img.width*img.height*4,0);
    while(this.optional.size>this.optionalCount||bytes>this.optionalBytes){
      const [src,img]=this.optional.entries().next().value;bytes-=img.width*img.height*4;this.optional.delete(src);this.cache.delete(src);
    }
  }
  retainRequired(entries){
    this.pinned=new Set(entries.map(([,v])=>v.src));
    for(const src of this.cache.keys())if(!this.pinned.has(src)&&!this.optional.has(src))this.cache.delete(src);
  }
  get stats(){return {loaded:this.cache.size,pending:this.pending.size,active:this.active,optional:this.optional.size,decodedBytes:[...this.cache.values()].reduce((n,img)=>n+img.width*img.height*4,0)};}
}
export async function decodeImage(src){
  const image=new Image();
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{image.onload=image.onerror=null;image.src='';reject(Error(`Timed out loading ${src}`));},120000);
    image.onload=()=>{clearTimeout(timeout);resolve();};image.onerror=()=>{clearTimeout(timeout);reject(Error(`Cannot load ${src}`));};image.src=src;
  });
  if(image.decode)await image.decode();
  return image;
}
export function assetGroups(manifest,classes,powerups,scenery=[]){
  const heroIds=new Set(['hero',...Object.values(classes).map(v=>v.sprite)]);
  return {
    menu:Object.entries(manifest.sprites).filter(([id])=>heroIds.has(id)),
    // Common effects/terrain are small; large actor atlases belong to their scene.
    play:[...Object.entries(manifest.sprites).filter(([id])=>heroIds.has(id)||scenery.includes(id)),...Object.entries(manifest.terrain),...Object.entries(manifest.vfx).map(([id,v])=>['vfx:'+id,v]),...Object.entries(powerups).map(([id,v])=>['powerup:'+id,{src:`assets/ui-${v.icon}.png`}]),['item:bag',manifest.items.bag],['item:gold',manifest.items.gold]].filter(([,v])=>v?.src)
  };
}
export function actorEntries(manifest,ids,monsters){
  const aliases={skeleton:"skeleton_f1",zombie:"zombie_f1"};ids=[...ids].map(id=>aliases[id]||id);
  const selected=new Set(ids);
  for(const id of ids){const dying=monsters[id]?.registry?.Dying;if(dying!==undefined)for(const [donor,m] of Object.entries(monsters))if(m.registry.ID===dying)selected.add(donor);}
  return [...selected].map(id=>{const entry=manifest.sprites[id];if(!entry)throw Error(`Missing actor artwork: ${id}`);return [id,entry];});
}
