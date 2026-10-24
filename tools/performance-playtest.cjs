const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createGameServer}=require('../survivors/http-server.cjs');
const {chromium}=require(process.env.ALLODS_PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'..'),GAME=process.env.ALLODS_GAME_ROOT||path.join(ROOT,'survivors'),OUT=path.join(ROOT,'.build/performance');
const PROFILES={local:{downloadThroughput:-1,uploadThroughput:-1,latency:0},constrained:{downloadThroughput:187500,uploadThroughput:32000,latency:150},poor:{downloadThroughput:62500,uploadThroughput:16000,latency:300}};
const quantile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]||0;};
async function run(){
 const selected=(process.argv.find(a=>a.startsWith('--profiles='))?.split('=')[1]||'local,constrained,poor').split(','),samples=Number(process.argv.find(a=>a.startsWith('--samples='))?.split('=')[1]||3);
 if(!Number.isInteger(samples)||samples<1||samples>10||selected.some(p=>!PROFILES[p]))throw Error('Invalid profiles/samples');
 await fs.mkdir(OUT,{recursive:true});const server=createGameServer({root:GAME,production:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const report={scope:'Real resources; desktop Chrome with phone viewport and software rendering where applicable. Not a physical-phone, human balance or deployed-host test.',budgets:{menuAndPlayReadyMs:{local:15000,constrained:180000,poor:420000},renderedP95Ms:50,notes:'Provisional review budgets; misses remain visible and are not a claim of phone performance.'},profiles:PROFILES,samples,identity:{},results:[]};
 const hashes=async(dir,prefix='')=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.name==='assets')continue;const rel=path.join(prefix,entry.name),file=path.join(dir,entry.name);if(entry.isDirectory())await hashes(file,rel);else if(/\.(mjs|css|html|cjs)$/.test(entry.name))report.identity[rel.replaceAll('\\','/')]=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');}};
 report.harnessSha256=crypto.createHash('sha256').update(await fs.readFile(__filename)).digest('hex');await hashes(GAME);report.identity['assets/manifest.json']=crypto.createHash('sha256').update(await fs.readFile(path.join(GAME,'assets/manifest.json'))).digest('hex');
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader'],...(process.env.ALLODS_BROWSER_CHANNEL?{channel:process.env.ALLODS_BROWSER_CHANNEL}:{})});
 try{for(const profile of selected)for(let sample=0;sample<samples;sample++){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),cdp=await context.newCDPSession(page),net=PROFILES[profile];
  page.setDefaultNavigationTimeout(420000);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,...net});
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await page.addInitScript(()=>{window.performanceFrames=[];let last;const frame=now=>{if(last)performanceFrames.push(now-last);last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  // Verify shared throughput with two concurrent uncached payloads, not a delay per request.
  console.log(`${profile} #${sample+1}: preparing calibration`);await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.survivors?.ready||document.querySelector('#asset-retry')?.hidden===false,null,{timeout:420000});if(!await page.evaluate(()=>survivors.ready))throw Error(await page.locator('#asset-stage').textContent());
  const calibration=await page.evaluate(async()=>{const m=survivors.manifest;const src=m.terrain['native-terrain']?.src||Object.values(m.terrain)[0].src;const begin=performance.now();const responses=await Promise.all([1,2].map(async i=>{const r=await fetch(src+'?calibration='+i+'-'+performance.timeOrigin,{cache:'no-store'});return (await r.arrayBuffer()).byteLength;}));return {bytes:responses.reduce((a,b)=>a+b,0),milliseconds:performance.now()-begin};});
  calibration.effectiveBytesPerSecond=calibration.bytes/(calibration.milliseconds/1000);calibration.rateVerified=net.downloadThroughput<0||calibration.effectiveBytesPerSecond<=net.downloadThroughput*1.4;
  // Clear all relevant storage for a real cold visit after calibration.
  const fixture=await page.evaluate(async()=>{const {World}=await import('./core.mjs'),{snapshotRun}=await import('./run-state.mjs');return JSON.stringify({gold:0,best:0,runs:0,upgrades:{},difficulty:'normal',run:snapshotRun(new World({hero:'mage',seed:42,difficulty:'normal',campaign:true}))});});
  await cdp.send('Network.clearBrowserCache');await cdp.send('Storage.clearDataForOrigin',{origin,storageTypes:'all'});
  for(const cache of ['cold','warm']){
   console.log(`${profile} ${cache} #${sample+1}: loading fixed seed 42`);await page.evaluate(value=>localStorage.setItem('allods-survivors-v1',value),fixture);
   let transferred=0,requests=0,cached=0;const loading=e=>{transferred+=e.encodedDataLength||0;},response=e=>{requests++;if(e.response.fromDiskCache||e.response.status===304)cached++;};cdp.on('Network.loadingFinished',loading);cdp.on('Network.responseReceived',response);
   const start=Date.now();await page.goto(origin);await page.waitForFunction(()=>survivors.ready,null,{timeout:420000});const menuReadyMs=Date.now()-start;
   await page.locator('#continue-run').click();await page.waitForFunction(()=>survivors.world?.time>.05,null,{timeout:420000});const readinessMs=Date.now()-start,initialDelivery={requests,transferredBytes:transferred,cacheResponses:cached};await page.evaluate(()=>{window.performanceFrames.length=0;});
   // Synthetic rendered stress only: real renderer/rules, deliberately granted survival.
   await page.evaluate(()=>{const w=survivors.world;w.player.invulnerable=10000;for(let i=0;i<70;i++)w.spawn(['wolf','orc','spider','troll'][i%4]);});await page.waitForFunction(()=>!survivors.assets.loading,null,{timeout:420000});await page.evaluate(()=>{window.performanceFrames.length=0;});await page.waitForTimeout(2500);
   const runtime=await page.evaluate(()=>({assets:survivors.assets,frames:performanceFrames.slice(),world:{enemies:survivors.world.enemies.length,effects:survivors.world.effects.length,corpses:survivors.world.corpses.length},heap:performance.memory?.usedJSHeapSize||null,renderer:survivors.terrain}));
   cdp.off('Network.loadingFinished',loading);cdp.off('Network.responseReceived',response);
   const frameMs={p50:quantile(runtime.frames,.5),p95:quantile(runtime.frames,.95),p99:quantile(runtime.frames,.99),max:Math.max(0,...runtime.frames)};delete runtime.frames;
   const entry={profile,sample,cache,seed:42,viewport:{width:390,height:844},calibration,menuReadyMs,readinessMs,initialDelivery,requests,transferredBytes:transferred,cacheResponses:cached,frameMs,runtime,failures:[...failures],withinProvisionalBudgets:readinessMs<=report.budgets.menuAndPlayReadyMs[profile]&&frameMs.p95<=50&&calibration.rateVerified&&!failures.length};report.results.push(entry);
   await page.screenshot({path:path.join(OUT,`${profile}-${sample}-${cache}.png`)});await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(`${profile} ${cache} #${sample+1}: ready ${readinessMs}ms; ${requests} requests; ${transferred} bytes; p95 ${frameMs.p95.toFixed(1)}ms`);
  }
  await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
 report.complete=true;report.coverageGaps=['Physical devices and deployed hosting','Long sustained sessions/memory plateau','Rapid region transitions and updated-index recovery need expanded workload coverage'];await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
