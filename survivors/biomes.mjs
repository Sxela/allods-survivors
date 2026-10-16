export const BIOMES=Object.freeze([
  {id:'grove',name:'The Shattered Grove',ground:'ground_grass'},
  {id:'drylands',name:'The Withered Expanse',ground:'ground_dry'},
  {id:'wastes',name:'The Broken Wastes',ground:'ground_rock'},
  {id:'highlands',name:'The Grey Highlands',ground:'ground_stone'},
  {id:'grave',name:'Urd\'s Domain',ground:'ground_grave'},
]);
export const CHUNK_SIZE=128;
export function biomeStage(time){return Math.min(BIOMES.length-1,Math.max(0,Math.floor(time/120)));}
export function terrainHash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^n>>>13,1274126177);return ((n^n>>>16)>>>0)/4294967296;}
export const BIOME_BLEND_DISTANCE=192;
const solid=stage=>BIOMES.map((_,i)=>i===stage?1:0);
const progress=weights=>weights.reduce((sum,w,i)=>sum+w*i,0);

// Offscreen tiles change fully in the distance and blend toward the retained
// terrain near the screen edge. Partly visible tiles are never repainted.
export class BiomeTerrain{
  constructor(){this.chunks=new Map();this.revision=0;}
  reset(){this.chunks.clear();this.revision=0;}
  update(view,time){
    const left=Math.floor(view.left/CHUNK_SIZE)-3,right=Math.floor(view.right/CHUNK_SIZE)+3;
    const top=Math.floor(view.top/CHUNK_SIZE)-3,bottom=Math.floor(view.bottom/CHUNK_SIZE)+3;
    const stage=biomeStage(time),target=solid(stage),previous=new Map(this.chunks);
    const existing=(tx,ty)=>{
      const c=previous.get(`${Math.floor(tx/4)},${Math.floor(ty/4)}`),i=((ty%4+4)%4)*4+(tx%4+4)%4;
      return c?.weights?.[i]|| (c?solid(c.tiles[i]):null);
    };
    const active=[];
    for(let cy=top;cy<=bottom;cy++)for(let cx=left;cx<=right;cx++){
      const key=`${cx},${cy}`;let chunk=this.chunks.get(key);
      const weights=Array.from({length:16},(_,i)=>{
        const tx=cx*4+i%4,ty=cy*4+Math.floor(i/4),x=tx*32,y=ty*32,old=existing(tx,ty);
        if(x<view.right&&x+32>view.left&&y<view.bottom&&y+32>view.top)return old||target;
        const distance=Math.hypot(Math.max(view.left-x-32,x-view.right,0),Math.max(view.top-y-32,y-view.bottom,0));
        const nearX=Math.floor(Math.max(view.left+.01,Math.min(view.right-.01,x+16))/32);
        const nearY=Math.floor(Math.max(view.top+.01,Math.min(view.bottom-.01,y+16))/32);
        const base=existing(nearX,nearY)||target,t=Math.min(1,distance/BIOME_BLEND_DISTANCE),blend=t*t*(3-2*t);
        const desired=base.map((w,j)=>w*(1-blend)+target[j]*blend);
        // Newly transformed ground must not turn back into the old biome as
        // the camera approaches it. Visible texture weights stay unchanged.
        return old&&progress(old)>progress(desired)?old:desired;
      });
      if(!chunk||weights.some((w,i)=>w.some((value,j)=>Math.abs(value-chunk.weights[i][j])>1e-6))){
        const tiles=weights.map(w=>w.indexOf(Math.max(...w)));
        chunk={cx,cy,tiles,weights,revision:++this.revision};this.chunks.set(key,chunk);
      }
      // LRU order also bounds the renderer's matching canvas cache.
      this.chunks.delete(key);this.chunks.set(key,chunk);active.push(chunk);
    }
    while(this.chunks.size>180)this.chunks.delete(this.chunks.keys().next().value);
    return active;
  }
}
