import {shopPriceScale} from './knowledge.mjs';
import {offerHtml,spellHtml,buildHtml,bestiaryListHtml,drawBestiary,spellLiveText} from './inspection-view.mjs';
import {bestiaryEntries} from './bestiary.mjs';
import {MAP_ARENAS,NATIVE_SCENERY_IDS,setActiveArena,nativeTileAt,arenaFor,arenaBounds} from './map-arenas.mjs';
import {snapshotRun,restoreRun} from './run-state.mjs';
import {areaName,CAMPAIGN_RULES,ROUTE} from './campaign.mjs';
import {mobileLayout,mountThumbstick,CONTROLS_KEY,normalizeControls,zoomViewport,screenSteering} from './mobile-controls.mjs';
import {classPortraitLayers} from './wardrobe.mjs';
import {TerrainRenderer} from './terrain-renderer.mjs';
import {freshProgress,resetAfterDeath} from './progression.mjs';
import {drawLandscape,decorations,SCENERY_IDS,elevatedPoint,elevatedWorld,reliefChunk,ELEVATION_PADDING} from './landscape.mjs';
import {battlefieldSize,mountVanillaHud,renderSpellRow,updateVanillaHud} from './vanilla-hud.mjs';
import {POWERUPS} from './powerups.mjs';
import {opaqueBounds,drawPlayerVitals} from './player-vitals.mjs';
import {MONSTERS,sampleMonsterFrame} from './monsters.mjs';
import {drawSpellFields,drawSpellEffects,unitFrameContact,drawUnitShadow} from './original-renderer.mjs';
import {BIOMES,CHUNK_SIZE,BiomeTerrain,biomeStage,terrainHash} from './biomes.mjs';
import {World,SKILLS,CLASSES,DIFFICULTIES} from './core.mjs';
import {VfxRenderer} from './vfx.mjs';
import {GameAudio} from './audio.mjs';
import {Inventory,rebalanceSavedItems} from './loot.mjs';
import {inventoryView,closeInventoryView} from './inventory-view.mjs';
import {pickupGuides} from './pickup-guides.mjs';
import {shopStock,purchase,refreshCost} from './shop.mjs';
import {shopView} from './shop-view.mjs';
const $=s=>document.querySelector(s),canvas=$('#world'),ctx=canvas.getContext('2d',{alpha:false});
let width=800,height=600,displayScale=1,mobileMode=false,manifest,images={},vfx,audioEngine,world=null,selected='mage',last=0,shownStatus='',sound=true,announcementTimer=0,menuTime=0,save,inventoryModel=null,inventoryReturn='menu',inventorySelection=null;
let controls;try{controls=normalizeControls(JSON.parse(localStorage.getItem(CONTROLS_KEY)));}catch{controls=normalizeControls(null);}
let audioSettings={enabled:true,volume:.35};try{const stored=JSON.parse(localStorage.getItem('allods-survivors-audio-v1'));if(stored){audioSettings.enabled=stored.enabled!==false;audioSettings.volume=typeof stored.volume==='number'&&Number.isFinite(stored.volume)?Math.max(0,Math.min(1,stored.volume)):.35;}}catch{}sound=audioSettings.enabled;
function persistAudio(){try{localStorage.setItem('allods-survivors-audio-v1',JSON.stringify(audioSettings));}catch{}}
let controlsOpen=false;
const keys=new Set(),particles=[],camera={x:0,y:0},pointer={active:false,x:0,y:0,id:null};
const safeArea={top:0,right:0,bottom:0,left:0},safeProbe=document.createElement('div');
safeProbe.setAttribute('aria-hidden','true');safeProbe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';document.body.append(safeProbe);
let confirmingSession=false,pendingReplacementIndex=null,choiceReadyAt=0,autoSaveAt=0;
const heroMetrics={};
function measureHeroes(){for(const [hero,c] of Object.entries(CLASSES)){const f=manifest.sprites[c.sprite].frames[0],sheet=images[c.sprite],sample=document.createElement('canvas');sample.width=f.w;sample.height=f.h;const g=sample.getContext('2d');g.drawImage(sheet,f.x,f.y,f.w,f.h,0,0,f.w,f.h);const bounds=opaqueBounds(g.getImageData(0,0,f.w,f.h).data,f.w,f.h);heroMetrics[hero]={height:bounds.height*1.15,width:bounds.width*1.15};}}
const skillIcons={bolt:'firebolt',frost:'ice',lightning:'chain-lightning',orbit:'ghost',meteor:'fireball',poison:'poison',power:'sword',haste:'haste',vitality:'healing',speed:'haste',magnet:'magic',regen:'healing'};
const pickupBuffs=document.createElement('div');pickupBuffs.id='pickup-buffs';$('#hud').append(pickupBuffs);
const bossUI=document.createElement('div');bossUI.className='boss-status';bossUI.hidden=true;$('#hud').append(bossUI);
const inventoryButton=document.createElement('button');inventoryButton.id='inventory-button';inventoryButton.className='icon-button';inventoryButton.title='Inventory (I)';inventoryButton.setAttribute('aria-label','Inventory');inventoryButton.innerHTML='<img src="assets/ui-backpackop.png" alt="">';$('#hud footer').append(inventoryButton);
const vanillaHud=mountVanillaHud($('#hud'));
const thumbstick=mountThumbstick($('#hud'),{enabled:()=>mobileMode&&controls.mode==='joystick'&&world?.status==='playing'});
const controlsButton=document.createElement('button');controlsButton.id='controls-button';controlsButton.className='icon-button';controlsButton.innerHTML='&#9881;';controlsButton.setAttribute('aria-label','Controls and zoom');controlsButton.title='Controls and zoom';controlsButton.onclick=openControls;$('#hud').append(controlsButton);
const inventoryMenuButton=document.createElement('button');inventoryMenuButton.id='inventory-menu-button';inventoryMenuButton.className='text-button';inventoryMenuButton.textContent='Inventory · I';$('#menu .menu-bottom').insertBefore(inventoryMenuButton,$('#sound-button'));
$('#hud .hint').innerHTML+=' · I <span>INVENTORY</span>';
const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const balance=()=>world?.gold??save.gold;
function setBalance(gold){if(world)world.gold=gold;save.gold=gold;}
function icon(id,className=''){const key=SKILLS[id]?.icon||`spell-${skillIcons[id]||'magic'}`;return `<img class="${className}" src="assets/ui-${key}.png" alt="" draggable="false">`;}
try{save=JSON.parse(localStorage.getItem('allods-survivors-v1'));}catch{}save={gold:0,best:0,runs:0,upgrades:{},...save};save.upgrades={...save.upgrades};
rebalanceSavedItems(save);save.inventory=new Inventory(save.inventory).snapshot();
save.shopGeneration=Number.isSafeInteger(save.shopGeneration)?save.shopGeneration:Date.now();
save.shopStock=new Inventory({bag:Array.isArray(save.shopStock)?save.shopStock:shopStock(save.shopGeneration,world?.player.level||1,world?.hero||selected)}).bag;
save.difficulty=Object.hasOwn(DIFFICULTIES,save.difficulty)?save.difficulty:'normal';persist();
const difficultyRow=document.createElement('div');difficultyRow.className='difficulty-setting';difficultyRow.setAttribute('role','group');difficultyRow.setAttribute('aria-label','Difficulty');
difficultyRow.innerHTML=`<span>DIFFICULTY</span>${Object.entries(DIFFICULTIES).map(([id,d])=>`<button class="text-button" data-difficulty="${id}" title="${d.description}">${d.name}</button>`).join('')}`;
$('#menu .run-info').replaceWith(difficultyRow);
// Keep the primary action below its difficulty setting and live description.
difficultyRow.after($('#menu .asset-note'));
$('#menu .asset-note').after($('#start'));
$('#start').after($('#menu .menu-bottom'));
const routeSetting=document.createElement('label');routeSetting.className='route-setting';routeSetting.innerHTML=`Journey <select id="route-length"><option value="12">12 native regions</option><option value="all">All ${MAP_ARENAS.length} native regions</option></select>`;$('#menu .asset-note').before(routeSetting);try{$('#route-length').value=localStorage.getItem('allods-survivors-route-v1')==='all'?'all':'12';}catch{}$('#route-length').onchange=e=>{try{localStorage.setItem('allods-survivors-route-v1',e.target.value);}catch{}};
const sessionActions=document.createElement('div');sessionActions.className='session-actions';$('#menu .menu-bottom').after(sessionActions);
$('#menu .menu-panel').append($('#sound-button'));
function updateDifficulty(){$('#menu .asset-note').textContent=DIFFICULTIES[save.difficulty].description;document.querySelectorAll('[data-difficulty]').forEach(button=>{const active=button.dataset.difficulty===save.difficulty;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});}
difficultyRow.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>{save.difficulty=button.dataset.difficulty;persist();updateDifficulty();audio('click');});updateDifficulty();

function persist(){try{if(world?.campaign){save.run=snapshotRun(world);save.gold=world.gold;}localStorage.setItem('allods-survivors-v1',JSON.stringify(save));}catch{toast('Progress could not be saved in this browser.');}}
function toast(message){$('#toast').textContent=message;setTimeout(()=>$('#toast').textContent='',2500);}
function resize(){
  const portrait=innerHeight>innerWidth,layout=mobileLayout(innerWidth,innerHeight);
  mobileMode=layout.mobile;width=layout.width;height=layout.height;thumbstick.cancel();pointer.active=false;
  displayScale=Math.min(innerWidth/width,innerHeight/height);
  const safeStyle=getComputedStyle(safeProbe);for(const side of Object.keys(safeArea)){safeArea[side]=(parseFloat(safeStyle.getPropertyValue('padding-'+side))||0)/displayScale;$('#game').style.setProperty('--safe-'+side,safeArea[side]+'px');}
  const game=$('#game');game.style.setProperty('--stick-size',Math.min(176,120/displayScale)+'px');game.classList.toggle('portrait',portrait);game.classList.toggle('mobile',mobileMode);
  (mobileMode?$('#hud'):$('#action-bar')).append(inventoryButton);
  Object.assign(game.style,{width:`${width}px`,height:`${height}px`,left:`${(innerWidth-width*displayScale)/2}px`,top:`${(innerHeight-height*displayScale)/2}px`,transform:`scale(${displayScale})`});
  canvas.width=width;canvas.height=height;ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;
  game.dataset.touchMode=controls.mode;const view=worldView();world?.setViewport(view.width,view.height);
}
function worldView(){return zoomViewport(battlefieldSize(width,height,mobileMode,safeArea.bottom),controls.zoom);}
addEventListener('resize',resize);resize();
function audio(id,volume=.25){if(sound)audioEngine?.play(id,{volume});}
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^n>>>13,1274126177);return ((n^n>>>16)>>>0)/4294967296;}
const terrainChunks=new Map(),fallbackTerrain=new Map(),biomeTerrain=new BiomeTerrain();
let terrainRenderer;try{terrainRenderer=new TerrainRenderer(document.createElement('canvas'));canvas.dataset.terrainRenderer='heightmap-webgl';}catch{canvas.dataset.terrainRenderer='canvas-fallback';}
let announcedBiome=0;
function terrainChunk(chunk){
  const key=`${chunk.cx},${chunk.cy}`,cached=terrainChunks.get(key);
  if(cached?.revision===chunk.revision)return cached.canvas;
  const c=document.createElement('canvas');c.width=c.height=CHUNK_SIZE;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  for(let i=0;i<16;i++){
    const x=i%4,y=Math.floor(i/4),wx=chunk.cx*4+x,wy=chunk.cy*4+y;
    const native=nativeTileAt(wx*32+16,wy*32+16);if(native!==null){if(native<0){g.fillStyle='#08110d';g.fillRect(x*32,y*32,32,32);}else g.drawImage(images['native-terrain'],native%32*32,Math.floor(native/32)*32,32,32,x*32,y*32,32,32);continue;}
    const img=images[BIOMES[chunk.tiles[i]].ground]||images.ground_grass;
    const column=Math.floor(terrainHash(wx,wy)*4)*32;
    const weights=chunk.weights[i];let coverage=0;
    for(let biome=0;biome<weights.length;biome++)if(weights[biome]>0){
      coverage+=weights[biome];g.globalAlpha=weights[biome]/coverage;
      g.drawImage(images[BIOMES[biome].ground]||img,column,0,32,32,x*32,y*32,32,32);
    }
    g.globalAlpha=1;
  }
  g.fillStyle='#10211a28';g.fillRect(0,0,CHUNK_SIZE,CHUNK_SIZE);
  g.save();g.translate(-chunk.cx*CHUNK_SIZE,-chunk.cy*CHUNK_SIZE);drawLandscape(g,{left:chunk.cx*CHUNK_SIZE,right:(chunk.cx+1)*CHUNK_SIZE,top:chunk.cy*CHUNK_SIZE,bottom:(chunk.cy+1)*CHUNK_SIZE},images);g.restore();
  terrainChunks.set(key,{revision:chunk.revision,canvas:c});return c;
}
function resetTerrain(){biomeTerrain.reset();terrainChunks.clear();fallbackTerrain.clear();terrainRenderer?.reset();announcedBiome=0;}
const contactCache=new Map(),contactCanvas=document.createElement('canvas'),contactContext=contactCanvas.getContext('2d',{willReadFrequently:true});
function spriteFrame(id,{moving=false,dx=0,dy=1,time=0,frame=null}={}){
  const s=manifest.sprites[id],anim=s.animation?.[moving?'walk':'idle'],dirs=anim?.directions||s.directions||8;
  const direction=Math.round((Math.atan2(dy,dx)-Math.PI/2)/(Math.PI*2)*dirs+dirs)%dirs;
  let index=frame;if(index===null){if(anim){const phase=Math.floor(time*9)%(anim.phases||1);index=anim.offset+(anim.layout==='direction-major'?direction*anim.phases+phase:phase*dirs+direction);}else index=direction;}
  return ((index||0)%s.count+s.count)%s.count;
}
function unitContact(id,index){
  const key=id+':'+index;if(!contactCache.has(key)){
    const f=manifest.sprites[id].frames[index];contactCanvas.width=f.w;contactCanvas.height=f.h;
    contactContext.drawImage(images[id],f.x,f.y,f.w,f.h,0,0,f.w,f.h);
    contactCache.set(key,unitFrameContact(contactContext.getImageData(0,0,f.w,f.h).data,f.w,f.h,f.anchorY));
  }
  return contactCache.get(key);
}
function sprite(id,x,y,options={}){
  const s=manifest?.sprites[id],img=images[id];if(!s||!img)return;
  const {scale=1,alpha=1,hit=false,target=ctx,flipX=false,grounded=false}=options,index=spriteFrame(id,options),f=s.frames[index];
  if(grounded)y+=unitContact(id,index).offsetY*scale;
  target.save();target.globalAlpha=alpha;if(hit)target.filter='brightness(1.8)';
  if(flipX){target.translate(Math.round(x),Math.round(y));target.scale(-1,1);target.drawImage(img,f.x,f.y,f.w,f.h,-f.anchorX*scale,-f.anchorY*scale,f.w*scale,f.h*scale);}
  else target.drawImage(img,f.x,f.y,f.w,f.h,Math.round(x-f.anchorX*scale),Math.round(y-f.anchorY*scale),f.w*scale,f.h*scale);
  target.restore();
}
function ground(cameraX,cameraY,size={width,height}){
  const view={left:cameraX-size.width/2,right:cameraX+size.width/2,top:cameraY-size.height/2,bottom:cameraY+size.height/2};
  // Protect all tiles that elevation can project into the visible battlefield.
  const chunks=biomeTerrain.update({...view,top:view.top-ELEVATION_PADDING,bottom:view.bottom+ELEVATION_PADDING},world?.terrainTime||0);
  if(terrainRenderer){const rw=Math.ceil(size.width),rh=Math.ceil(size.height);terrainRenderer.draw(chunks,terrainChunk,{x:cameraX,y:cameraY},rw,rh);ctx.drawImage(terrainRenderer.canvas,(size.width-rw)/2,(size.height-rh)/2);}
  else for(const chunk of chunks){
    const key=`${chunk.cx},${chunk.cy}`;let cached=fallbackTerrain.get(key);
    if(cached?.revision!==chunk.revision){const relief=reliefChunk(terrainChunk(chunk),chunk.cx,chunk.cy,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});cached={revision:chunk.revision,canvas:relief};fallbackTerrain.set(key,cached);}
    ctx.drawImage(cached.canvas,Math.floor(chunk.cx*CHUNK_SIZE-view.left),Math.floor(chunk.cy*CHUNK_SIZE-view.top)-ELEVATION_PADDING);
  }
  for(const key of terrainChunks.keys())if(!biomeTerrain.chunks.has(key)){terrainChunks.delete(key);fallbackTerrain.delete(key);}

}
function scenery(){const size=world?worldView():{width,height};return decorations({left:camera.x-size.width/2,right:camera.x+size.width/2,top:camera.y-size.height/2,bottom:camera.y+size.height/2}).map(elevatedPoint);}
function glow(x,y,r,color){const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(1,'transparent');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);}
function draw(){if(!manifest||!vfx){ctx.fillStyle='#15221b';ctx.fillRect(0,0,width,height);return;}const w=world?elevatedWorld(world):null,p=w?.player;camera.x=p?world.player.x:Math.sin(menuTime*.025)*120;camera.y=p?p.y:Math.cos(menuTime*.025)*120;const pixels=w?battlefieldSize(width,height,mobileMode,safeArea.bottom):{width,height},view=w?worldView():pixels;
  ctx.fillStyle='#0d1711';ctx.fillRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(0,0,pixels.width,pixels.height);ctx.clip();if(w)ctx.scale(controls.zoom,controls.zoom);
  ground(camera.x,camera.y,view);const ox=view.width/2-camera.x,oy=view.height/2-camera.y;

  ctx.save();ctx.translate(ox,oy);
  // Ancient marker at the starting clearing.
  ctx.save();ctx.strokeStyle='#bdaf772d';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,106,60,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.fillStyle='#b7a16a44';ctx.fillRect(Math.cos(a)*100-2,Math.sin(a)*56-2,4,4);}ctx.restore();
  if(w){drawSpellFields(vfx,w);
    for(const corpse of w.corpses){const monster=MONSTERS[corpse.type];if(!monster)continue;const donor=Object.entries(MONSTERS).find(([,m])=>m.registry.ID===(monster.registry.Dying??monster.registry.ID));const id=donor?.[0]||corpse.type,age=25-corpse.ttl;const action=age<1?'dying':'bones';const sampled=sampleMonsterFrame(id,action,corpse.dx||0,corpse.dy||1,Math.min(age,.9));if(MONSTERS[id].animation[action])sprite(id,corpse.x,corpse.y,{...sampled,alpha:Math.min(1,corpse.ttl)});else sprite('bones',corpse.x,corpse.y,{frame:0,alpha:Math.min(1,corpse.ttl)});}
    for(const drop of w.lootDrops){if(Math.abs(drop.x-camera.x)>width/2+100||Math.abs(drop.y-camera.y)>height/2+100)continue;const color={common:'#ded6bd',magic:'#9bc4fb',rare:'#f2d06e',unique:'#d99a56'}[drop.item.rarity];ctx.save();const beam=ctx.createLinearGradient(0,drop.y-68,0,drop.y);beam.addColorStop(0,'transparent');beam.addColorStop(1,color+'88');ctx.fillStyle=beam;ctx.fillRect(drop.x-6,drop.y-68,12,65);ctx.strokeStyle=color;ctx.globalAlpha=.6+Math.sin(menuTime*4)*.2;ctx.beginPath();ctx.ellipse(drop.x,drop.y-2,15,6,0,0,Math.PI*2);ctx.stroke();ctx.restore();const art=images['item:'+drop.item.icon]||images['item:bag'];if(art){const scale=Math.min(1,30/art.width,30/art.height),iw=art.width*scale,ih=art.height*scale;ctx.drawImage(art,Math.round(drop.x-iw/2),Math.round(drop.y-ih),iw,ih);}ctx.save();ctx.font='9px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#08110c';ctx.fillStyle=color;ctx.strokeText(drop.item.name,drop.x,drop.y-25);ctx.fillText(drop.item.name,drop.x,drop.y-25);ctx.restore();}
    for(const drop of w.powerups){const def=POWERUPS[drop.kind];if(!def)continue;const bob=Math.sin(w.time*3+drop.id)*2;
      glow(drop.x,drop.y-8,26,def.color+'55');ctx.save();ctx.globalAlpha=drop.ttl<8?.6+Math.sin(w.time*8)*.3:1;
      ctx.strokeStyle=def.color;ctx.beginPath();ctx.ellipse(drop.x,drop.y,17,7,0,0,Math.PI*2);ctx.stroke();
      const image=images[`powerup:${drop.kind}`];if(image)ctx.drawImage(image,Math.round(drop.x-13),Math.round(drop.y-29+bob),26,26);
      ctx.font='9px Georgia';ctx.textAlign='center';ctx.strokeStyle='#08110c';ctx.lineWidth=3;ctx.fillStyle=def.color;ctx.strokeText(def.name,drop.x,drop.y-35+bob);ctx.fillText(def.name,drop.x,drop.y-35+bob);ctx.restore();
    }
    if(world.campaign){
      const region=arenaFor(world);if(region){const b=arenaBounds(region);ctx.save();ctx.strokeStyle='#bda56b';ctx.lineWidth=4;ctx.setLineDash([10,8]);ctx.strokeRect(b.left+3,b.top+3,b.right-b.left-6,b.bottom-b.top-6);ctx.restore();}
      const a=world.campaign;
      if(a.exit){const q=elevatedPoint(a.exit);glow(q.x,q.y-10,48,'#8de5de66');vfx.draw('teleport',q.x,q.y-15,{time:menuTime,scale:1.2});ctx.strokeStyle='#9ce7df';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(q.x,q.y,30,15,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d9fff7';ctx.font='11px Georgia';ctx.textAlign='center';ctx.fillText(a.exit.armed?'EXIT - stand still for 1s':'EXIT - activating',q.x,q.y-44);if(a.exit.hold){ctx.fillStyle='#101d16';ctx.fillRect(q.x-24,q.y+20,48,4);ctx.fillStyle='#9ce7df';ctx.fillRect(q.x-24,q.y+20,48*Math.min(1,a.exit.hold/CAMPAIGN_RULES.exitHoldSeconds),4);}}
      for(const ore of a.deposits){if(!ore.remaining)continue;const q=elevatedPoint(ore),art=images['item:gold'];if(art)ctx.drawImage(art,q.x-24,q.y-42,48,48);ctx.fillStyle='#dfc88f';ctx.font='9px Georgia';ctx.textAlign='center';ctx.fillText(`Gold vein x${ore.remaining} - stand still`,q.x,q.y-49);if(ore.progress){ctx.fillStyle='#101d16';ctx.fillRect(q.x-24,q.y+8,48,4);ctx.fillStyle='#dfc88f';ctx.fillRect(q.x-24,q.y+8,48*ore.progress/3,4);}}
    }
    for(const g of w.gems){const x=g.x,y=g.y+Math.sin(menuTime*2+g.x)*2;if(g.type==='heal'){glow(x,y,18,'#a5363166');ctx.fillStyle='#df7f5f';ctx.fillRect(x-3,y-6,6,12);ctx.fillRect(x-6,y-3,12,6);}else if(g.type==='gold'){const coin=images['item:gold'];if(coin)ctx.drawImage(coin,x-10,y-10,20,20);}else{ctx.fillStyle=g.value>1?'#c49ce8':'#8ba9d4';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+3,y);ctx.lineTo(x,y+5);ctx.lineTo(x-3,y);ctx.closePath();ctx.fill();}}
  }
  const objects=scenery();if(w){objects.push(...[...w.enemies,...w.allies,...(w.neutrals||[])].map(e=>({...e,id:{skeleton:'skeleton_f1',zombie:'zombie_f1'}[e.type]||e.type,enemy:e,ally:w.allies.includes(e),neutral:w.neutrals?.includes(e)})),{id:CLASSES[w.hero].sprite,x:p.x,y:p.y,ground:p.ground,player:true});}else objects.push({id:'hero',x:0,y:0,prop:true,frame:0});objects.sort((a,b)=>a.y-b.y);
  for(const o of objects){if(o.x<camera.x-view.width/2-180||o.x>camera.x+view.width/2+180||o.y<camera.y-view.height/2-100||o.y>camera.y+view.height/2+250)continue;
    if(o.prop){sprite(o.id,o.x,o.y,{frame:o.frame,scale:o.scale||1,alpha:(o.alpha||.96)*(p&&Math.hypot(o.x-p.x,o.y-p.y)<100?.35:1)});continue;}
    const e=o.enemy,action=e?(e.attackTime>0?'attack':e.moving?'walk':MONSTERS[o.id]?.animation.idleAnimated?'idleAnimated':'idle'):null;
    const drawOptions=o.player?{dx:p.dx,dy:p.dy,moving:p.moving,time:w.time,scale:1.15,alpha:p.statuses.invisibility?.ttl>0?.3:p.invulnerable>0&&Math.floor(w.time*18)%2?.45:1,grounded:true}:{...sampleMonsterFrame(o.id,action,e.dx,e.dy,action==='attack'?.6-e.attackTime:w.time+(e.phase||0)),hit:e.hit>0,grounded:!MONSTERS[o.id]?.registry.Z};
    const contact=unitContact(o.id,spriteFrame(o.id,drawOptions));drawUnitShadow(ctx,o.ground,contact.radius*(drawOptions.scale||1));
    if(o.player){glow(o.x,o.y-20,55,'#a3ba6b18');sprite(o.id,o.x,o.y,drawOptions);ctx.strokeStyle='#d8c48b88';ctx.beginPath();ctx.ellipse(p.x,p.y+1,16,6,0,0,Math.PI*2);ctx.stroke();}else{sprite(o.id,o.x,o.y,drawOptions);if(o.ally||o.neutral){ctx.strokeStyle=o.ally?'#91cfa999':'#d4c78c77';ctx.beginPath();ctx.ellipse(o.x,o.y+2,15,6,0,0,Math.PI*2);ctx.stroke();}if(e.elite){ctx.strokeStyle='#edc668';ctx.beginPath();ctx.ellipse(e.x,e.y+2,19,8,0,0,Math.PI*2);ctx.stroke();}if(e.minorBoss){const labelY=e.y-(manifest.sprites[o.id].cellHeight-2)-7;ctx.save();ctx.font='9px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#07110c';ctx.fillStyle='#f4d37d';ctx.strokeText(e.name,e.x,labelY);ctx.fillText(e.name,e.x,labelY);ctx.restore();}if(e.boss||e.elite||e.hp<e.maxHp){const r=e.boss?30:16;ctx.fillStyle='#161d17';ctx.fillRect(e.x-r,e.y+7,r*2,3);ctx.fillStyle=e.boss||e.elite?'#d6a25d':'#a95c4b';ctx.fillRect(e.x-r,e.y+7,r*2*e.hp/e.maxHp,3);}if(e.slow>0){ctx.strokeStyle='#c1e3fa66';ctx.beginPath();ctx.ellipse(e.x,e.y,18,7,0,0,Math.PI*2);ctx.stroke();}}}
  if(w)drawSpellEffects(vfx,w,heroMetrics[w.hero]);
  for(const a of particles){ctx.globalAlpha=a.life/a.maxLife;ctx.fillStyle=a.color;const pos=elevatedPoint(a);ctx.fillRect(pos.x-1,pos.y-1,3,3);}ctx.globalAlpha=1;ctx.restore();
  const vignette=ctx.createRadialGradient(view.width/2,view.height/2,Math.min(view.width,view.height)*.2,view.width/2,view.height/2,Math.max(view.width,view.height)*.7);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#07110c99');ctx.fillStyle=vignette;ctx.fillRect(0,0,view.width,view.height);
  if(w)drawPlayerVitals(ctx,{...p,x:p.x+ox,y:p.y+oy},heroMetrics[w.hero]);
  if(w)for(const guide of pickupGuides(w,view)){ctx.save();ctx.translate(guide.x,guide.y);ctx.rotate(guide.angle);ctx.fillStyle=guide.color||(guide.kind==='loot'||guide.kind==='gold')?'#efd185':guide.kind==='xp'?'#a8cefa':'#e79d83';ctx.strokeStyle='#0b1710';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-5);ctx.lineTo(-2,0);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.fill();ctx.rotate(-guide.angle);ctx.font='8px Georgia';ctx.textAlign=guide.x>width-80?'right':guide.x<80?'left':'center';ctx.lineWidth=3;const label=`${guide.label}${guide.count?' ×'+guide.count:''} ${guide.distance}`;ctx.strokeText(label,0,16);ctx.fillText(label,0,16);ctx.restore();}
  ctx.restore();
}
function populateClasses(){
  continueButton.hidden=!save.run;$('#start').textContent=save.run?'Start a new run':'Enter the grove';const root=$('#classes');root.replaceChildren();
  const descriptions={mage:'Fire Arrow',warrior:'Shield & melee',ranger:'Poison Cloud & bow'};
  for(const [id,c] of Object.entries(CLASSES)){
    const b=document.createElement('button'),layers=classPortraitLayers(manifest,id);
    b.className='class-card'+(selected===id?' selected':'');b.setAttribute('aria-pressed',String(selected===id));
    // Clothing is presentation-only; selecting a class does not grant equipment.
    b.innerHTML=`<div class="class-portrait" aria-hidden="true">${layers.map(src=>`<img src="${src}" alt="" draggable="false">`).join('')}</div><strong>${escapeText(c.name)}</strong><small>${descriptions[id]}</small>`;
    b.onclick=()=>{selected=id;audio('click');populateClasses();};root.append(b);
  }
  $('#bank').textContent=` \u00b7 ${save.gold} gold`;
}
function activateRun(){setActiveArena(world);pendingReplacementIndex=null;resetTerrain();audio('click');audioEngine?.setScene('playing');inventoryModel=null;particles.length=0;keys.clear();pointer.active=false;thumbstick.cancel();shownStatus='';$('#menu').hidden=true;$('#modal').hidden=true;$('#hud').hidden=false;autoSaveAt=world.time;updateHud();announce(areaName(world));persist();}
function startRun(){const record={best:save.best,runs:save.runs};save={...freshProgress(save,selected),...record};world=new World({hero:selected,difficulty:save.difficulty,campaign:true,areaCount:$('#route-length').value==='all'?Infinity:12,viewport:worldView()});activateRun();}
function continueRun(){const restored=restoreRun(save.run,worldView());if(!restored){toast('This run could not be restored. Start a new run.');return;}world=restored;selected=world.hero;activateRun();}
const continueButton=document.createElement('button');continueButton.id='continue-run';continueButton.className='text-button';continueButton.textContent='Continue saved run';continueButton.onclick=continueRun;$('#start').after(continueButton);
const spellDetail=document.createElement('div');spellDetail.id='spell-detail';spellDetail.hidden=true;spellDetail.setAttribute('role','region');spellDetail.setAttribute('aria-label','Spell details');spellDetail.tabIndex=0;$('#hud').append(spellDetail);let detailId=null,detailMode=null;
function hideSpellDetail(){document.querySelectorAll('[aria-describedby="spell-detail"]').forEach(slot=>slot.removeAttribute('aria-describedby'));spellDetail.hidden=true;detailId=null;detailMode=null;}
const inspectSlot=event=>{const id=event.target.closest('[data-skill]')?.dataset.skill;if(!id||!world)return;if(event.type==='click'&&detailMode==='tap'&&detailId===id){hideSpellDetail();return;}if(event.type==='pointerover'&&detailMode==='tap')return;detailMode=event.type==='click'?'tap':event.type==='focusin'?'focus':'hover';detailId=id;event.target.closest('[data-skill]').setAttribute('aria-describedby','spell-detail');spellDetail.innerHTML=spellHtml(world,id);spellDetail.hidden=false;};
for(const type of ['click','focusin','pointerover'])$('#skills').addEventListener(type,inspectSlot);
$('#skills').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();inspectSlot({type:'click',target:e.target});}});
$('#skills').addEventListener('pointerleave',e=>{if(detailMode==='hover'&&!spellDetail.contains(e.relatedTarget))hideSpellDetail();});
spellDetail.addEventListener('pointerleave',e=>{if(detailMode==='hover'&&!$('#skills').contains(e.relatedTarget))hideSpellDetail();});
$('#skills').addEventListener('focusout',e=>{if(detailMode==='focus'&&!$('#skills').contains(e.relatedTarget)&&!spellDetail.contains(e.relatedTarget))hideSpellDetail();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#skills,#spell-detail'))hideSpellDetail();});

const routeStatus=document.createElement('div');routeStatus.id='route-status';$('#hud').append(routeStatus);

function announce(text){$('#announcement').textContent=text;$('#announcement').style.opacity=1;clearTimeout(announcementTimer);announcementTimer=setTimeout(()=>$('#announcement').style.opacity=0,3300);}
const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function updateHud(){if(!world)return;const a=world.campaign;routeStatus.textContent=a?`${a.index+1}/${a.route.length} ${areaName(world)} | ${world.gold} gold | ${a.phase==='extract'?`EXIT: ${Math.ceil(a.remaining)}s - stop in portal for 1s`:a.phase==='camp'?'Safe camp':a.bossSpawned?'Defeat the guardian':`Guardian in ${Math.max(0,Math.ceil(CAMPAIGN_RULES.bossAt-a.time))}s`}`:'';const p=world.player;$('#clock').textContent=formatTime(world.time);$('#kills').textContent=world.kills;$('#gold').textContent=world.gold;$('#level').textContent=`LEVEL ${p.level}`;$('#xp-fill').style.width=`${100*p.xp/p.nextXp}%`;$('#hp-fill').style.width=`${100*p.hp/p.maxHp}%`;$('#hp-text').textContent=`${p.hp.toFixed(1)} / ${p.maxHp.toFixed(1)}`;$('#dash-label').textContent=p.dashCooldown>0?`ASTRAL STEP · ${p.dashCooldown.toFixed(1)}s`:'SPACE · ASTRAL STEP';
  if(!spellDetail.hidden&&detailId){const live=spellDetail.querySelector('[data-spell-live]');if(live)live.textContent=spellLiveText(world,detailId);}
  const boss=world.enemies.find(e=>e.finalBoss)||world.enemies.find(e=>e.boss)||world.enemies.find(e=>e.minorBoss);bossUI.hidden=!boss;if(boss){const angle=Math.atan2(boss.y-p.y,boss.x-p.x),arrow=['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(angle/(Math.PI*2)*8)+8)%8];bossUI.innerHTML=`<span>${boss.name.toUpperCase()}</span><small>${arrow} ${Math.round(Math.hypot(boss.x-p.x,boss.y-p.y))} paces</small><div><i style="width:${Math.max(0,boss.hp/boss.maxHp*100)}%"></i></div>`;}
  pickupBuffs.innerHTML=[['hasteSpell','Haste'],['shield','Shield']].filter(([id])=>p.statuses[id]?.ttl>0&&(id!=='shield'||p.statuses[id].pool>0)).map(([id,name])=>`<span>${name} ${id==='shield'?p.statuses[id].pool.toFixed(1)+' HP':p.statuses[id].ttl.toFixed(1)+'s'}</span>`).join('');
  renderSpellRow($('#skills'),world,icon);updateVanillaHud(vanillaHud,world,manifest);
}
function modal(html){const columns=Math.min(3,(html.match(/class="upgrade-card"/g)||[]).length)||3;hideSpellDetail();$('#modal').innerHTML=`<section style="--offer-columns:${columns};--offer-gaps:${(columns-1)*10}px" class="dialog ${html.includes('class="upgrade-grid')?'upgrade-dialog':''}">${html}</section>`;$('#modal').hidden=false;}
function cancelNewSession(){
  confirmingSession=false;keys.clear();
  if(world){world.status='playing';pause();}
  else{$('#modal').hidden=true;$('#new-session-button').focus();}
}
function confirmNewSession(){
  if(world&&world.status!=='paused')return;
  confirmingSession=true;keys.clear();pointer.active=false;thumbstick.cancel();audio('click');
  modal(`<div class="eyebrow">START FROM NOTHING</div><h2>New session?</h2><p>This erases your backpack, equipped items, gold, legacy upgrades,<br>survival record and run count, and refreshes the camp shop.<br>Any active run ends without rewards. This cannot be undone.</p><div class="dialog-actions"><button class="text-button" id="cancel-session">Keep my progress</button><button class="primary" id="confirm-session">Erase and start fresh</button></div>`);
  $('#cancel-session').onclick=cancelNewSession;
  $('#confirm-session').onclick=()=>{
    const generation=Math.max(Date.now(),save.shopGeneration+1);
    confirmingSession=false;closeInventoryView();
    inventoryModel=null;inventorySelection=null;inventoryReturn='menu';world=null;
    keys.clear();pointer.active=false;thumbstick.cancel();particles.length=0;clearTimeout(announcementTimer);
    $('#announcement').textContent='';$('#announcement').style.opacity=0;$('#toast').textContent='';
    document.body.classList.remove('hurt');bossUI.hidden=true;
    save=freshProgress(save,selected,generation);
    persist();returnMenu();$('#start').focus();
  };
  $('#cancel-session').focus();
}
function saveInventory(){if(inventoryModel)save.inventory=inventoryModel.snapshot();else if(world)save.inventory=world.inventory.snapshot();persist();}
function renderInventory(){const scroll=$('#modal .inventory-dialog')?.scrollTop||0;inventoryView({shopStock:save.shopStock,onShopMount:renderInventoryShop,inventory:inventoryModel,manifest,gold:balance(),hero:world?.hero||selected,selectedId:inventorySelection,onSelect:id=>{inventorySelection=id;audio('click',.15);renderInventory();},onEquip:id=>{const ok=world?world.equipItem(id):inventoryModel.equip(id);if(ok){saveInventory();audio('equip');if(world)updateHud();renderInventory();}},onUnequip:slot=>{const ok=world?world.unequipItem(slot):inventoryModel.unequip(slot);if(ok){saveInventory();audio('equip');if(world)updateHud();renderInventory();}else toast('Backpack is full. Sell an item to make room.');},onSell:id=>{const earned=inventoryModel.sell(id);if(earned){setBalance(balance()+earned);inventorySelection=null;saveInventory();audio('loot',.3);renderInventory();}},onMove:(id,target)=>{const ok=world?world.moveItem(id,target):inventoryModel.move(id,target);if(ok){inventorySelection=id;saveInventory();audio('equip');if(world)updateHud();renderInventory();}},onReject:message=>toast(message),onClose:closeInventory});$('#modal .inventory-dialog').scrollTop=scroll;}
function openInventory(){if(inventoryModel){closeInventory();return;}if(world&&!['playing','paused','camp'].includes(world.status))return;inventoryReturn=world?.status||'menu';inventoryModel=world?.inventory||new Inventory(save.inventory,selected);inventorySelection=null;if(world)world.status='inventory';keys.clear();pointer.active=false;thumbstick.cancel();$('#toast').textContent='';const equipped=inventoryModel.autoEquip();if(world&&equipped.length)world.refreshEquipment();const sale=inventoryModel.autoSell();if(equipped.length)saveInventory();if(sale.sold.length){setBalance(balance()+sale.gold);saveInventory();audio('loot');toast(`Autosold ${sale.sold.length} inferior item${sale.sold.length===1?'':'s'} for ${sale.gold} gold`);}audio('inventory');audioEngine?.setScene('paused');renderInventory();}
function closeInventory(){if(!inventoryModel)return;closeInventoryView();saveInventory();inventoryModel=null;$('#modal').hidden=true;shownStatus='';if(world){world.status='playing';if(inventoryReturn==='camp'){world.status='camp';showCamp();}else if(inventoryReturn==='paused')pause();else audioEngine?.setScene('playing');}else{audioEngine?.setScene('menu');populateClasses();}}
function renderInventoryShop(root){
  shopView({root,embedded:true,tooltips:false,stock:save.shopStock,inventory:inventoryModel,manifest,gold:balance(),priceScale:shopPriceScale(world),
    onBuy:id=>{
      const result=purchase(inventoryModel,save.shopStock,balance(),id,shopPriceScale(world));
      if(result.ok){setBalance(result.gold);inventoryModel.autoEquip();const sale=inventoryModel.autoSell();setBalance(balance()+sale.gold);if(world){world.refreshEquipment();updateHud();}saveInventory();audio('equip');renderInventory();}
      else toast(result.message);
    },
    onRefresh:()=>{
      if(balance()<refreshCost(shopPriceScale(world)))return;
      setBalance(balance()-refreshCost(shopPriceScale(world)));save.shopGeneration++;
      save.shopStock=shopStock(save.shopGeneration,world?.player.level||1,world?.hero||selected);
      persist();audio('click');renderInventory();
    }
  });
}
function guardChoices(){choiceReadyAt=performance.now()+300;keys.clear();pointer.active=false;pointer.id=null;thumbstick.cancel();}
function showChoices(){pendingReplacementIndex=null;guardChoices();audio('levelup',.3);const kind=world.rewardKind,title=kind==='learning'?'Learn a new spell':kind==='behavior'?'Shape your spell':'Ancient knowledge';modal(`<div class="eyebrow">LEVEL ${world.player.level} - ${kind.toUpperCase()}</div><h2>${title}</h2><p>${kind==='learning'?'Choose a spell or keep your build.':kind==='behavior'?'A free reward for five spell improvements.':'Choose one improvement.'}</p><div class="upgrade-grid ${world.choices.length===4?'four-choices':''}">${world.choices.map((c,i)=>`<article class="upgrade-card" style="--gift-color:${escapeText(c.color||'#d9c392')}">${icon(c.id,'upgrade-icon')}<small>${c.rarity?.toUpperCase()||c.type.toUpperCase()}</small><strong>${escapeText(c.name)}</strong>${offerHtml(world,c)}<button class="text-button" data-choice="${i}">Choose ${i+1}</button></article>`).join('')}</div>`);document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(+b.dataset.choice));$('#modal button')?.focus({preventScroll:true});persist();}
function showCamp(){
  world.prepareCamp();guardChoices();const a=world.campaign;modal(`<div class="eyebrow">AREA ${a.index+1} CLEARED - SAFE CAMP</div><h2>${escapeText(areaName(world))}</h2><p>Choose improvements or equipment, then continue.</p><div class="camp-wallet">${world.gold} gold</div><div class="upgrade-grid camp-grid">${a.shopOffers.map(c=>`<article class="upgrade-card" style="--gift-color:${escapeText(c.color)}">${icon(c.id,'upgrade-icon')}<small>${c.rarity.toUpperCase()}</small><strong>${escapeText(c.name)}</strong>${offerHtml(world,c)}<button class="text-button" data-camp-buy="${escapeText(c.offerId)}" ${world.gold<c.price?'disabled':''}>Buy - ${c.price} gold</button></article>`).join('')||'<p>All useful improvements purchased.</p>'}</div><div class="dialog-actions"><button class="text-button" id="camp-reroll" ${!a.shopOffers.length||world.gold<world.campRerollCost()?'disabled':''}>Reroll - ${world.campRerollCost()} gold</button><button class="text-button" id="camp-inventory">Inventory &amp; item shop</button><button class="primary" id="next-area">${a.index===a.route.length-1?'Complete the journey':'Next area'}</button></div>`);
  document.querySelectorAll('[data-camp-buy]').forEach(b=>b.onclick=()=>{if(performance.now()<choiceReadyAt)return;if(world.buyCamp(b.dataset.campBuy)){persist();if(world.resolveCampMilestones()){shownStatus='';showChoices();}else showCamp();}else{toast('That improvement is no longer useful or affordable.');showCamp();}});
  $('#camp-reroll').onclick=()=>{if(performance.now()>=choiceReadyAt&&world.rerollCamp()){persist();showCamp();}};$('#camp-inventory').onclick=()=>{if(performance.now()>=choiceReadyAt)openInventory();};$('#next-area').onclick=()=>{if(performance.now()<choiceReadyAt)return;if(world.nextArea()){persist();shownStatus='';$('#modal').hidden=true;}};persist();
}

function showReplacement(index){
  guardChoices();
  pendingReplacementIndex=index;const choice=world.choices[index];
  modal(`<div class="eyebrow">SPELL CATEGORY FULL</div><h2>Learn ${choice.name}</h2><p>Choose which spell to replace. ${choice.name} starts at rank 1.</p><div class="upgrade-grid replacement-grid">${world.replacementSkills(choice.id).map((id,i)=>{const rank=world.skills[id];return `<button class="upgrade-card" data-replace="${id}">${icon(id,'upgrade-icon')}<strong>${SKILLS[id].name}</strong>${offerHtml(world,choice,id)}<small>RANK ${rank} - REPLACE (${i+1})</small></button>`;}).join('')}</div><div class="dialog-actions"><button class="text-button" id="cancel-replacement">Back to upgrades - Esc</button></div>`);
  document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>finishReplacement(b.dataset.replace));$('#cancel-replacement').onclick=showChoices;$('#modal button')?.focus({preventScroll:true});
}
function finishReplacement(id){if(performance.now()<choiceReadyAt)return;if(world.choose(pendingReplacementIndex,id)){pendingReplacementIndex=null;audio('click');shownStatus='';if(world.status==='playing')$('#modal').hidden=true;else if(world.status==='camp')showCamp();else showChoices();persist();}}
function choose(i){if(performance.now()<choiceReadyAt)return;if(world.choices[i]?.type==='replace'){showReplacement(i);return;}if(world.choose(i)){audio('click');shownStatus='';if(world.status==='playing')$('#modal').hidden=true;else if(world.status==='camp')showCamp();persist();}}
function applyControls(){
  controls=normalizeControls(controls);keys.clear();pointer.active=false;thumbstick.cancel();$('#game').dataset.touchMode=controls.mode;
  const view=worldView();world?.setViewport(view.width,view.height);
  try{localStorage.setItem(CONTROLS_KEY,JSON.stringify(controls));}catch{toast('Control preferences could not be saved.');}
}
function closeControls(){
  if(!controlsOpen)return;controlsOpen=false;keys.clear();pointer.active=false;thumbstick.cancel();$('#modal').hidden=true;
  if(world?.status==='paused'){world.status='playing';shownStatus='';audioEngine?.setScene('playing');}controlsButton.focus();
}
function openControls(){
  if(controlsOpen){closeControls();return;}if(world?.status!=='playing')return;
  controlsOpen=true;world.status='paused';keys.clear();pointer.active=false;thumbstick.cancel();audioEngine?.setScene('paused');
  modal(`<div class="eyebrow">MAKE THE ALLOD YOUR OWN</div><h2>Controls &amp; camera</h2><fieldset class="control-modes"><legend>Touch movement</legend>${[['joystick','Thumb joystick'],['touch','Full-screen touch']].map(([mode,label])=>`<button class="text-button${controls.mode===mode?' selected':''}" data-control-mode="${mode}" aria-pressed="${controls.mode===mode}">${label}</button>`).join('')}</fieldset><p id="control-description"></p><label class="zoom-control" for="screen-zoom">Screen zoom <output id="zoom-value" for="screen-zoom">${Math.round(controls.zoom*100)}%</output><input id="screen-zoom" type="range" min="100" max="200" step="25" value="${controls.zoom*100}"></label><p class="settings-note">Zoom enlarges the world while keeping the interface readable.</p><div class="dialog-actions"><button id="close-controls" class="primary">Return to game</button></div>`);
  $('#modal .dialog').classList.add('controls-dialog');
  const describe=()=>$('#control-description').textContent=controls.mode==='joystick'?'Drag the thumbstick at the bottom right. Release it to stop.':'Hold anywhere on the battlefield to steer in that direction. Drag to steer, release to stop.';describe();
  document.querySelectorAll('[data-control-mode]').forEach(button=>button.onclick=()=>{
    controls.mode=button.dataset.controlMode;applyControls();describe();
    document.querySelectorAll('[data-control-mode]').forEach(item=>{const selected=item.dataset.controlMode===controls.mode;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected));});
  });
  $('#screen-zoom').oninput=event=>{controls.zoom=Number(event.target.value)/100;applyControls();$('#zoom-value').textContent=Math.round(controls.zoom*100)+'%';};
  const volume=document.createElement('label');volume.className='zoom-control';volume.innerHTML=`Volume <output id="volume-value">${Math.round(audioSettings.volume*100)}%</output><input id="audio-volume" type="range" min="0" max="100" step="5" value="${Math.round(audioSettings.volume*100)}">`;$('#close-controls').before(volume);$('#audio-volume').oninput=e=>{audioSettings.volume=Number(e.target.value)/100;audioEngine?.setVolume(audioSettings.volume);$('#volume-value').textContent=e.target.value+'%';persistAudio();};const inspect=document.createElement('button');inspect.className='text-button';inspect.id='inspect-build';inspect.textContent='Current stats & spells';inspect.onclick=showBuild;$('#close-controls').before(inspect);const beasts=document.createElement('button');beasts.id='open-bestiary';beasts.className='text-button';beasts.textContent='Bestiary';beasts.onclick=showBestiary;$('#close-controls').before(beasts);$('#close-controls').onclick=closeControls;$('#close-controls').focus();
}
function backToControls(){controlsOpen=false;world.status='playing';openControls();}
function showBuild(){modal(`<div class="eyebrow">CURRENT BUILD</div><h2>${CLASSES[world.hero].name}</h2>${buildHtml(world)}<button class="text-button" id="back-controls">Back to controls</button>`);$('#modal .dialog').classList.add('knowledge-dialog');$('#back-controls').onclick=backToControls;document.querySelectorAll('[data-stats-section]').forEach(b=>b.onclick=()=>$('#stats-'+b.dataset.statsSection).scrollIntoView({block:'start'}));}
function showBestiary(){
 const state={query:'',local:true,page:0,role:'ordinary'};
 modal(`<div class="eyebrow">KNOW YOUR ENEMIES</div><h2>Bestiary</h2><p>${escapeText(areaName(world))} &middot; ${DIFFICULTIES[world.difficulty].name}. Numbers scale to the current route and area time. Native appearances and identities are preserved; native server HP, damage and resistances were not recovered. These are survival combat values.</p><div class="bestiary-filters"><input type="search" id="bestiary-search" placeholder="Search creatures" aria-label="Search creatures"><label><input type="checkbox" id="bestiary-local" checked> Current region roster</label><label>Encounter <select id="bestiary-role"><option value="ordinary">Ordinary</option><option value="captain">Captain</option><option value="guardian">Guardian scale</option></select></label></div><div id="bestiary-list"></div><div class="bestiary-paging"><button class="text-button" id="bestiary-prev">Previous</button><span id="bestiary-page"></span><button class="text-button" id="bestiary-next">Next</button></div><button class="text-button" id="back-controls">Back to controls</button>`);
 $('#modal .dialog').classList.add('knowledge-dialog');
 const paint=()=>{const data=bestiaryEntries(world,state);state.page=data.page;$('#bestiary-list').innerHTML=bestiaryListHtml(data);$('#bestiary-page').textContent=`${data.page+1} / ${data.pages} - ${data.total} appearances`;$('#bestiary-prev').disabled=!data.page;$('#bestiary-next').disabled=data.page===data.pages-1;drawBestiary($('#bestiary-list'),manifest,images,world.time);};
 $('#bestiary-search').oninput=e=>{state.query=e.target.value;state.page=0;paint();};$('#bestiary-local').onchange=e=>{state.local=e.target.checked;state.page=0;paint();};$('#bestiary-role').onchange=e=>{state.role=e.target.value;paint();};$('#bestiary-prev').onclick=()=>{state.page--;paint();};$('#bestiary-next').onclick=()=>{state.page++;paint();};$('#back-controls').onclick=backToControls;paint();$('#bestiary-search').focus();
}

function pause(){if(!world||!['playing','paused'].includes(world.status))return;keys.clear();pointer.active=false;thumbstick.cancel();if(world.status==='paused'){world.status='playing';$('#modal').hidden=true;shownStatus='';}else{world.status='paused';modal(`<div class="eyebrow">THE RIFT CAN WAIT</div><h2>Paused - ${DIFFICULTIES[world.difficulty].name}</h2><p>${mobileMode?`${controls.mode==='joystick'?'Drag the thumbstick at the bottom right to move.':'Hold anywhere on the battlefield to steer.'}<br>Release to stop. The gear button changes controls and zoom.`:'Move with WASD or arrow keys. Space dashes through danger.<br>Collect blue shards to grow stronger.'} Your spells cast automatically.</p><div class="dialog-actions"><button class="primary" id="resume">Return to the grove</button><button class="text-button" id="abandon">End run</button><button class="text-button" id="pause-new-session">New session</button></div>${$('#menu .fan-notice').outerHTML}`);$('#pause-new-session').onclick=confirmNewSession;$('#resume').onclick=pause;$('#abandon').onclick=()=>{world.status='dead';shownStatus='';};$('#resume').focus();}persist();}
function endRun(){const won=world.status==='won',reward=won?world.runReward():0;if(won){setBalance(reward);save.best=Math.max(save.best,world.time);save.runs++;saveInventory();}else{inventoryModel=null;inventorySelection=null;save=resetAfterDeath(world,save);persist();updateHud();}audio(won?'win':'death',.4);modal(`<div class="eyebrow">${won?'THE ALLOD ENDURES':'ANOTHER SOUL RETURNS TO THE ASTRAL'}</div><h2>${won?'Dawn breaks':'The grove falls silent'}</h2><div class="eyebrow">${DIFFICULTIES[world.difficulty].name.toUpperCase()} DIFFICULTY</div><p>${won?'Urd has fallen. Your legacy will be remembered.':'Death erased your items, learned spells, gold and legacy. Your next character starts fresh.'}</p><div class="stats"><div><strong>${formatTime(world.time)}</strong><small>SURVIVED</small></div><div><strong>${world.kills}</strong><small>SLAIN</small></div><div><strong>${reward}</strong><small>GOLD EARNED</small></div></div><div class="dialog-actions"><button class="primary" id="again">Walk the allod again</button><button class="text-button" id="return">Return to camp</button></div>`);$('#again').onclick=startRun;$('#return').onclick=returnMenu;$('#again').focus();}
function returnMenu(){setActiveArena(null);pendingReplacementIndex=null;resetTerrain();world=null;inventoryModel=null;audioEngine?.setScene('menu');shownStatus='';$('#modal').hidden=true;$('#hud').hidden=true;$('#menu').hidden=false;populateClasses();}
function legacy(){modal(`<div class="eyebrow">RUN RECORD</div><h2>Your journey</h2><p>Completed journeys: ${save.runs}<br>Best survival: ${formatTime(save.best)}<br>Recorded wallet: ${save.gold} gold</p><p>New runs start fresh. Continue restores your active build.<br>All improvements belong to the current run.</p><button class="text-button" id="close-legacy">Return to camp</button>`);$('#close-legacy').onclick=()=>$('#modal').hidden=true;}

$('#start').onclick=startRun;$('#pause-button').onclick=pause;$('#legacy-button').onclick=legacy;$('#legacy-button').firstChild.textContent='Run record ';$('#sound-button').onclick=()=>{sound=!sound;audioSettings.enabled=sound;persistAudio();audioEngine?.setEnabled(sound);$('#sound-button').textContent=`Sound: ${sound?'on':'off'}`;};
$('#inventory-button').onclick=openInventory;$('#inventory-menu-button').onclick=openInventory;
const newSessionButton=document.createElement('button');newSessionButton.id='new-session-button';newSessionButton.className='text-button session-button';newSessionButton.textContent='New session';newSessionButton.onclick=confirmNewSession;sessionActions.append(newSessionButton);
const exportSaveButton=document.createElement('button');exportSaveButton.id='export-save-button';exportSaveButton.className='text-button session-button';exportSaveButton.textContent='Export save';exportSaveButton.onclick=()=>{persist();const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='Allods-Survivors-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};sessionActions.append(exportSaveButton);
addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(key==='escape'&&!spellDetail.hidden){e.preventDefault();hideSpellDetail();return;}if(controlsOpen){if(key==='escape'){e.preventDefault();closeControls();}return;}if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();if(confirmingSession){if(key==='escape')cancelNewSession();if(key!=='tab'&&key!=='enter')e.preventDefault();return;}keys.add(key);if(e.repeat)return;if(pendingReplacementIndex!==null&&world?.status==='levelup'){if(key==='escape'){e.preventDefault();showChoices();}else if(['1','2','3','4','5','6','7','8'].includes(key))finishReplacement(world.replacementSkills(world.choices[pendingReplacementIndex].id)[+key-1]);return;}if(key==='i'){e.preventDefault();openInventory();return;}if(key==='escape'){if(inventoryModel)closeInventory();else if(world)pause();else $('#modal').hidden=true;}if(key===' '&&world)world.dash();if(world?.status==='levelup'&&['1','2','3','4'].includes(key))choose(+key-1);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();pointer.active=false;thumbstick.cancel();if(world?.status==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(world)persist();if(document.hidden&&world?.status==='playing')pause();audioEngine?.setScene(document.hidden?'hidden':world?.status==='playing'?'playing':'paused');});
canvas.addEventListener('pointerdown',e=>{
  if(world?.status!=='playing'||e.isPrimary===false||e.button!==0||pointer.active)return;
  const bounds=canvas.getBoundingClientRect(),x=(e.clientX-bounds.left)/displayScale,y=(e.clientY-bounds.top)/displayScale,view=battlefieldSize(width,height,mobileMode,safeArea.bottom);
  if(x<0||y<0||x>=view.width||y>=view.height)return;
  e.preventDefault();
  if(mobileMode&&controls.mode==='joystick')return;
  pointer.active=true;pointer.id=e.pointerId;pointer.x=e.clientX;pointer.y=e.clientY;canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(pointer.active&&e.pointerId===pointer.id){pointer.x=e.clientX;pointer.y=e.clientY;}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(e.pointerId===pointer.id){pointer.active=false;pointer.id=null;}});

let hudTimer=0;
function frame(now){const dt=Math.min((now-last)/1000||0,.05);last=now;menuTime+=dt;
  thumbstick.element.hidden=!mobileMode||controls.mode!=='joystick'||world?.status!=='playing';
  if(world?.status!=='playing')thumbstick.cancel();
  if(world){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(x||y)thumbstick.cancel();else if(mobileMode&&controls.mode==='joystick'){const input=thumbstick.input;x=input.x;y=input.y;}else if(pointer.active){const bounds=canvas.getBoundingClientRect(),input=screenSteering((pointer.x-bounds.left)/displayScale,(pointer.y-bounds.top)/displayScale,battlefieldSize(width,height,mobileMode,safeArea.bottom));x=input.x;y=input.y;}
    world.step(dt,{x,y});if(world.campaign?.mapId!==$('#game').dataset.nativeMap){setActiveArena(world);resetTerrain();$('#game').dataset.nativeMap=world.campaign?.mapId||'';}const stage=biomeStage(world.terrainTime);if(stage!==announcedBiome){announcedBiome=stage;announce(BIOMES[stage].name.toUpperCase());}for(const ev of world.events){
      if(ev.type==='kill'){for(let i=0;i<4;i++)particles.push({x:ev.x,y:ev.y-15,vx:(Math.random()-.5)*80,vy:(Math.random()-.5)*80,life:.4,maxLife:.4,color:'#b5b086'});if(Math.hypot(ev.x-world.player.x,ev.y-world.player.y)<400)audio('kill',.08);}
      if(ev.type==='enemyCast')audio(({fire:'fire',water:ev.skill==='poison'?'poison':'ice',air:'lightning',earth:'meteor',astral:'orbit'})[ev.element],.08);
      if(ev.type==='cast')audio(({fire:'fire',water:ev.skill==='poison'?'poison':'ice',air:'lightning',earth:'meteor',astral:ev.skill==='heal'?'healing':'orbit'})[SKILLS[ev.skill]?.element],.18);
      if(ev.type==='hurt'){audio('hurt',.35);document.body.classList.add('hurt');setTimeout(()=>document.body.classList.remove('hurt'),120);}
      if(ev.type==='champion'){announce(ev.name.toUpperCase());audio('levelup',.12);}if(ev.type==='championKilled')toast('Champion defeated - equipment, gold and power-up dropped');if(ev.type==='powerup'){toast(`${ev.name} collected`);audio(ev.kind==='heal'?'healing':'loot',.3);}
      if(ev.type==='exitOpened')announce('EXIT OPEN - 30 SECONDS TO LEAVE');if(ev.type==='extractionMissed')toast('The exit closed. Your run is lost.');if(ev.type==='areaEntered')announce(ev.name.toUpperCase());if(ev.type==='rewardFallback')toast(`All improvements mastered: +${ev.gold} gold`);if(ev.type==='mined'){toast(`Mined ${ev.gold} gold`);audio('loot',.15);}if(ev.type==='boss')announce(ev.name.toUpperCase());if(ev.type==='bossKilled'){announce(ev.finalBoss?'URD HAS FALLEN':'GUARDIAN FALLEN');audio('win',.2);}
      if(ev.type==='dash')audio('dash',.2);if(ev.type==='pickup')audio(ev.kind==='heal'?'healing':'pickup',ev.kind==='heal'?.2:.06);
      if(ev.type==='lootPicked'){if(!world.campaign)setBalance(balance()+(ev.saleGold||0));saveInventory();audio('loot',.4);toast(ev.autoEquipped?.length?`Auto-equipped ${ev.autoEquipped.join(', ')}${ev.autoSold?' ? autosold '+ev.autoSold+' for '+ev.saleGold+' gold':''}`:ev.autoSold?`${ev.kept?ev.item.name+' collected; ':''}autosold ${ev.autoSold} inferior item${ev.autoSold===1?'':'s'} for ${ev.saleGold} gold`:`${ev.item.name} collected · I to inspect`);}
      if(ev.type==='inventoryFull')toast('Backpack full · I to equip or sell items');
    }world.events=[];if(world.time-autoSaveAt>=2){autoSaveAt=world.time;persist();}
    if(world.status!==shownStatus){shownStatus=world.status;audioEngine?.setScene(document.hidden?'hidden':shownStatus==='playing'?'playing':'paused');if(shownStatus==='levelup')showChoices();if(shownStatus==='camp')showCamp();if(['won','dead'].includes(shownStatus))endRun();}hudTimer+=dt;if(hudTimer>.1){updateHud();hudTimer=0;}
  }
  if(!world||world.status==='playing'){for(const a of particles){a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;}for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);}
  draw();requestAnimationFrame(frame);
}
async function boot(){try{const response=await fetch('assets/manifest.json');if(!response.ok)throw Error('Asset manifest is missing.');manifest=await response.json();audioEngine=new GameAudio(manifest);audioEngine.setVolume(audioSettings.volume);audioEngine.enabled=sound;$('#sound-button').textContent=`Sound: ${sound?'on':'off'}`;const groups={...manifest.sprites,...manifest.terrain,...Object.fromEntries(Object.entries(POWERUPS).map(([id,def])=>[`powerup:${id}`,{src:`assets/ui-${def.icon}.png`} ])),...Object.fromEntries(Object.entries(manifest.vfx).map(([id,entry])=>[`vfx:${id}`,entry])),...Object.fromEntries(Object.entries(manifest.items).map(([id,entry])=>[`item:${id}`,entry]))};await Promise.all(Object.entries(groups).map(async([id,s])=>{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(`Cannot load ${s.src}`));img.src=s.src;});images[id]=img;}));await document.fonts.load('14px "Allods Romul"').catch(()=>{});measureHeroes();vfx=new VfxRenderer(ctx,manifest.vfx,images);terrainChunks.clear();populateClasses();$('#start').disabled=false;$('#start').textContent=save.run?'Start a new run':'Enter the grove';}catch(e){$('#start').textContent='Assets could not load';toast(e.message);console.error(e);}}
// Read-only observability for browser smoke checks and debugging.
window.survivors={get world(){return world;},get manifest(){return manifest;},get ready(){return !$('#start').disabled;},get resolution(){return {width,height,displayScale,mobile:mobileMode};},get controls(){return {...controls};},get joystick(){return {...thumbstick.input,active:thumbstick.active};},get biome(){return {stage:biomeStage(world?.terrainTime||0),name:world?.campaign?areaName(world):BIOMES[biomeStage(world?.terrainTime||0)].name,chunks:[...biomeTerrain.chunks.values()].map(({cx,cy,tiles,revision})=>({cx,cy,tiles:[...tiles],weights:biomeTerrain.chunks.get(`${cx},${cy}`).weights.map(w=>[...w]),revision})),cacheSize:terrainChunks.size};},get terrain(){return {renderer:canvas.dataset.terrainRenderer,cacheSize:terrainRenderer?.cache.size||0,contextLost:terrainRenderer?.gl.isContextLost()||false};},get renderedVfx(){return [...(vfx?.used||[])];},get audio(){return {enabled:sound,played:[...(audioEngine?.played||[])],ambient:!!audioEngine?.ambientSource,voices:audioEngine?.voices.size||0};}};
boot();requestAnimationFrame(frame);
