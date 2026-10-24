const fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require(process.env.ALLODS_PLAYWRIGHT_MODULE||'playwright');
const {createGameServer}=require('../survivors/http-server.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.build/asset-parity');
(async()=>{
 await fs.mkdir(OUT,{recursive:true});const server=createGameServer({root:path.join(ROOT,'survivors'),production:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.ALLODS_BROWSER_CHANNEL?{channel:process.env.ALLODS_BROWSER_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1400,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.survivors?.ready);
  const decode=await page.evaluate(async()=>{
   const paths=new Set();const visit=value=>{if(value&&typeof value==='object'){if(typeof value.src==='string'&&value.src.endsWith('.png'))paths.add(value.src);for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);}};visit(survivors.manifest);
   const failures=[];let decoded=0;
   for(const src of paths){const image=new Image();image.src=src;try{await image.decode();decoded++;}catch{failures.push(src);}finally{image.src='';}}
   return {decoded,failures,scope:'Browser PNG decode, not original-engine behavioral parity'};
  });
  await fs.writeFile(path.join(OUT,'browser-decode.json'),JSON.stringify(decode,null,2));if(decode.failures.length)throw Error(`PNG decode failures: ${decode.failures.join(', ')}`);console.log(`Decoded ${decode.decoded} manifest PNGs, including nested equipment/UI variants.`);
  for(const family of ['actors','vfx']){
   const count=await page.evaluate(async family=>{
    const {MONSTERS,sampleMonsterFrame}=await import('./monsters.mjs'),{sampleVfx}=await import('./vfx.mjs'),manifest=survivors.manifest;
    const entries=family==='actors'?Object.entries(MONSTERS):Object.entries(manifest.vfx),canvas=document.createElement('canvas');canvas.id='asset-contact-sheet';canvas.width=1400;canvas.height=Math.ceil(entries.length/7)*140;const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#102018';g.fillRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<entries.length;i++){
     const [id,value]=entries[i],entry=family==='actors'?manifest.sprites[id]:value,image=new Image();image.src=entry.src;await image.decode();
     const sample=family==='actors'?entry.frames[sampleMonsterFrame(id,'walk',1,0,.3).frame]:sampleVfx(entry,{progress:.55}).frame;
     const x=i%7*200,y=Math.floor(i/7)*140;
     for(let side=0;side<2;side++){
      g.fillStyle=side?'#ddd7bf':'#102018';g.fillRect(x+side*100,y,100,115);const scale=Math.min(1,96/sample.w,105/sample.h);g.drawImage(image,sample.x,sample.y,sample.w,sample.h,x+side*100+(100-sample.w*scale)/2,y+(110-sample.h*scale)/2,sample.w*scale,sample.h*scale);
     }
     g.fillStyle='#08100c';g.fillRect(x,y+115,200,25);g.fillStyle='#f0dcaa';g.font='12px sans-serif';g.fillText(id,x+4,y+132,192);image.src='';
    }
    document.querySelector('#asset-contact-sheet')?.remove();canvas.style.cssText='position:absolute;left:0;top:0;z-index:10000';document.body.append(canvas);return entries.length;
   },family);
   await page.locator('#asset-contact-sheet').screenshot({path:path.join(OUT,`${family}-light-dark.png`)});console.log(`Captured ${count} ${family} on light/dark surfaces.`);
  }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
