const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.ALLODS_PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.build/shadow-fix'),game=path.join(ROOT,'survivors');
(async()=>{fs.mkdirSync(OUT,{recursive:true});let browser;const errors=[];
 const server=http.createServer((req,res)=>{const file=path.resolve(game,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(game+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.mjs':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.wav':'audio/wav','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');res.end(bytes);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 browser=await chromium.launch({...(process.env.ALLODS_BROWSER_CHANNEL?{channel:process.env.ALLODS_BROWSER_CHANNEL}:{}),headless:true,args:['--enable-unsafe-swiftshader']});
 let assertions=0;
 for(const [classIndex,hero] of ['mage','warrior','ranger'].entries()){
  const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__unitDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){const result=draw.call(this,image,...args);if(this.canvas.id==='world'&&args.length===8&&image.src){window.__unitDraws.push({src:image.src,args});if(__unitDraws.length>80)__unitDraws.shift();}return result;};});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>survivors.ready);await page.locator('#classes .class-card').nth(classIndex).click();await page.click('#start');await page.waitForFunction(()=>!survivors.assets.loading&&survivors.world?.time>0);
  await page.evaluate(async()=>{
   const w=survivors.world,m=await import('./map-arenas.mjs'),{terrainElevation}=await import('./landscape.mjs'),a=m.arenaById('sb_anp_greenlnd_1_1');w.campaign.mapId=a.id;w.campaign.route[0]=a.id;m.setActiveArena(w);
   const bounds=m.arenaBounds(a);let point={x:0,y:0},score=-1;
   for(let i=0;i<a.floor.length;i++){if(!a.floor[i])continue;const p=m.cellPosition(a,i);if(p.x<bounds.left+240||p.x>bounds.right-240||p.y<bounds.top+300||p.y>bounds.bottom-300)continue;const slope=Math.abs(terrainElevation(p.x+20,p.y)-terrainElevation(p.x,p.y));if(slope>score&&m.arenaWalkable(a,p.x,p.y,14)){point=p;score=slope;}}
   Object.assign(w.player,point,{invulnerable:0,statuses:{}});w.skills={};w.enemies=[];w.neutrals=[];w.effects=[];w.fields=[];w.step=()=>{};
   for(const [i,type] of ['wolf','troll'].entries()){const e=w.spawn(type,false,m.safeArenaPoint(w,{x:point.x-110+i*220,y:point.y+70}));Object.assign(e,{dx:0,dy:1,moving:false,attackTime:0,phase:0});}
  });
  await page.waitForFunction(()=>!survivors.assets.loading&&document.querySelector('#game').dataset.nativeMap===survivors.world.campaign.mapId&&__unitDraws.length>0);
  for(const moving of [false,true])for(let facing=0;facing<8;facing++){
   await page.evaluate(({moving,facing})=>{const w=survivors.world;Object.assign(w.player,{moving,dx:Math.sin(facing*Math.PI/4),dy:Math.cos(facing*Math.PI/4)});w.time=moving?.28:0;__unitDraws=[];},{moving,facing});await page.waitForTimeout(40);
   const result=await page.evaluate(async()=>{
    const {opaqueBounds}=await import('./player-vitals.mjs'),{elevatedPoint}=await import('./landscape.mjs'),w=survivors.world,id={mage:'mage',warrior:'warrior',ranger:'ranger'}[w.hero],sprite=survivors.manifest.sprites[id],d=__unitDraws.filter(d=>d.src.endsWith('/'+sprite.src)).at(-1);
    if(!d)throw Error('No actual hero draw observed '+JSON.stringify({assets:survivors.assets,hero:w.hero,draws:__unitDraws.length,status:w.status}));const [sx,sy,sw,sh,dx,dy,dw,dh]=d.args,image=new Image();image.src=d.src;await image.decode();const sample=document.createElement('canvas');sample.width=sw;sample.height=sh;const g=sample.getContext('2d');g.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);const b=opaqueBounds(g.getImageData(0,0,sw,sh).data,sw,sh),feet=dy+(b.top+b.height)*dh/sh,ground=elevatedPoint(w.player).y;return {feet,ground,error:feet-ground};
   });
   assert.ok(Math.abs(result.error)<=.6,hero+' '+moving+' '+facing+' floating gap '+JSON.stringify(result));assertions++;
  }
  await page.evaluate(()=>{const w=survivors.world;Object.assign(w.player,{moving:false,dx:0,dy:1});w.time=0;});await page.waitForTimeout(50);await page.screenshot({path:path.join(OUT,'grounded-'+hero+'.png')});await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Grounding browser passed: '+assertions+' actual draw/alpha foot contacts across three heroes, eight facings, idle/walk, and native hill terrain.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
