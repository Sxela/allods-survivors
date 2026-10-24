// Portable real-runtime checks. CI installs browsers; local overrides are explicit.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createGameServer}=require('../survivors/http-server.cjs');
const playwright=require(process.env.ALLODS_PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'..'),GAME=process.env.ALLODS_GAME_ROOT||path.join(ROOT,'survivors'),OUT=path.join(ROOT,'.build/runtime-browser');
async function run(){
 await fs.mkdir(OUT,{recursive:true});const server=createGameServer({root:GAME,production:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`,results=[];
 try{for(const engine of (process.env.ALLODS_BROWSERS||'chromium,webkit').split(',')){
  assert.ok(playwright[engine],`Unknown browser ${engine}`);
  const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{args:['--enable-unsafe-swiftshader'],...(process.env.ALLODS_BROWSER_CHANNEL?{channel:process.env.ALLODS_BROWSER_CHANNEL}:{})}:{})});
  try{for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
   const context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   // A failed required image must hold gameplay and expose retry, not a blank playable scene.
   let failed=false;await page.route('**/assets/vfx-firebolt.png',async route=>{if(!failed){failed=true;return route.abort();}return route.continue();});
   await page.goto(origin);await page.waitForFunction(()=>!document.querySelector('#asset-retry').hidden,null,{timeout:60000});
   assert.equal(failed,true);assert.equal(await page.evaluate(()=>survivors.world),null);assert.equal(await page.evaluate(()=>survivors.ready),false);
   assert.match(await page.locator('#asset-stage').textContent(),/required image/);
   await page.locator('#asset-retry').click();await page.waitForFunction(()=>survivors.ready,null,{timeout:60000});
   assert.equal(await page.locator('#asset-loading').isVisible(),false);
   const menu=await page.evaluate(()=>({stats:survivors.assets,paths:performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname)}));
   assert.ok(menu.stats.playReady);assert.ok(menu.stats.optional===0);assert.ok(menu.stats.loaded<600,'item catalog is not eagerly decoded');
   await page.locator('#start').click();await page.waitForFunction(()=>survivors.world?.time>.05);
   // Exercise pause, input release and a saved-run menu; use actual UI to continue.
   await page.locator('#pause-button').click();const paused=await page.evaluate(()=>survivors.world.time);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>survivors.world.time),paused);
   await page.reload();await page.waitForFunction(()=>survivors.ready,null,{timeout:60000});await page.waitForSelector('#continue-run',{state:'visible'});
   const bounds=await page.evaluate(()=>{const game=document.querySelector('#game').getBoundingClientRect();return [...document.querySelectorAll('#menu h1,#menu button,#menu select,#menu .project-links a')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.textContent,left:r.left,top:r.top,right:r.right,bottom:r.bottom,game:{left:game.left,top:game.top,right:game.right,bottom:game.bottom}};});});
   for(const r of bounds){assert.ok(r.left>=r.game.left-1&&r.right<=r.game.right+1&&r.top>=r.game.top-1&&r.bottom<=r.game.bottom+1,`Saved-menu bounds: ${r.id}`);}
   await page.screenshot({path:path.join(OUT,`${engine}-${viewport.width}-saved.png`)});await page.locator('#continue-run').click();await page.waitForFunction(()=>survivors.world?.status==='playing');
   await page.waitForTimeout(150);await page.screenshot({path:path.join(OUT,`${engine}-${viewport.width}-play.png`)});
   await page.evaluate(()=>{window.__actorArtwork=new Set();const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='world'&&image.src)__actorArtwork.add(image.src);return draw.call(this,image,...args);};const w=survivors.world;for(const [i,type] of ['skeleton','zombie'].entries())w.allies.push({id:w.nextId++,type,x:w.player.x+20+i*10,y:w.player.y,hp:10,maxHp:10,radius:13,speed:100,damage:1,ttl:20,attackCooldown:0,dx:0,dy:1,moving:false});});
   await page.waitForFunction(()=>['skeleton_f1','zombie_f1'].every(id=>[...__actorArtwork].some(src=>src.endsWith('/'+survivors.manifest.sprites[id].src))),null,{timeout:60000});
   const transition=await page.evaluate(()=>{const w=survivors.world;const old=w.campaign.mapId,time=w.time;w.status='camp';w.campaign.phase='camp';if(!w.nextArea())throw Error('Fixture failed to enter next area');return {old,next:w.campaign.mapId,time};});
   await page.waitForFunction(oldTime=>!survivors.assets.loading&&survivors.world.time>oldTime&&document.querySelector('#game').dataset.nativeMap===survivors.world.campaign.mapId,transition.time,{timeout:60000});
   assert.notEqual(transition.next,transition.old);assert.equal(await page.evaluate(()=>survivors.assets.pending),0);
   assert.deepEqual(errors,[]);results.push({engine,viewport,menu,transition,checks:['required-failure','retry','readiness','lazy-items','pause','save','menu-fit','continue','region-transition','summoned-alias-art']});await context.close();
  }}finally{await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({scope:'Actual current resources; browser emulation, not physical devices',results},null,2));console.log(`Runtime browser checks passed: ${results.length} layouts.`);
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
