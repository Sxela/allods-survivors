import {TerrainRenderer} from './terrain-renderer.mjs';
import {freshProgress,resetAfterDeath} from './progression.mjs';
import {drawLandscape,decorations,SCENERY_IDS,elevatedPoint,elevatedWorld,reliefChunk,ELEVATION_PADDING} from './landscape.mjs';
import {battlefieldSize,mountVanillaHud,renderSpellRow,updateVanillaHud} from './vanilla-hud.mjs';
import {POWERUPS} from './powerups.mjs';
import {opaqueBounds,drawPlayerVitals} from './player-vitals.mjs';
import {MONSTERS,sampleMonsterFrame} from './monsters.mjs';
import {drawSpellFields,drawSpellEffects} from './original-renderer.mjs';
import {BIOMES,CHUNK_SIZE,BiomeTerrain,biomeStage,terrainHash} from './biomes.mjs';
import {World,SKILLS,CLASSES,DIFFICULTIES} from './core.mjs';
import {VfxRenderer} from './vfx.mjs';
import {GameAudio} from './audio.mjs';
import {Inventory,rebalanceSavedItems} from './loot.mjs';
import {inventoryView,closeInventoryView} from './inventory-view.mjs';
import {pickupGuides} from './pickup-guides.mjs';
import {shopStock,purchase,REFRESH_COST} from './shop.mjs';
import {shopView} from './shop-view.mjs';
const $=s=>document.querySelector(s),canvas=$('#world'),ctx=canvas.getContext('2d',{alpha:false});
let width=800,height=600,displayScale=1,manifest,images={},vfx,audioEngine,world=null,selected='mage',last=0,shownStatus='',sound=true,announcementTimer=0,menuTime=0,save,inventoryModel=null,inventoryReturn='menu',inventorySelection=null;
const keys=new Set(),particles=[],camera={x:0,y:0},pointer={active:false,x:0,y:0};
let confirmingSession=false,pendingReplacementIndex=null;
const heroMetrics={};
function measureHeroes(){for(const [hero,c] of Object.entries(CLASSES)){const f=manifest.sprites[c.sprite].frames[0],sheet=images[c.sprite],sample=document.createElement('canvas');sample.width=f.w;sample.height=f.h;const g=sample.getContext('2d');g.drawImage(sheet,f.x,f.y,f.w,f.h,0,0,f.w,f.h);const bounds=opaqueBounds(g.getImageData(0,0,f.w,f.h).data,f.w,f.h);heroMetrics[hero]={height:(f.anchorY-bounds.top)*1.15,width:bounds.width*1.15};}}
const skillIcons={bolt:'firebolt',frost:'ice',lightning:'chain-lightning',orbit:'ghost',meteor:'fireball',poison:'poison',power:'sword',haste:'haste',vitality:'healing',speed:'haste',magnet:'magic',regen:'healing'};
const pickupBuffs=document.createElement('div');pickupBuffs.id='pickup-buffs';$('#hud').append(pickupBuffs);
const bossUI=document.createElement('div');bossUI.className='boss-status';bossUI.hidden=true;$('#hud').append(bossUI);
const inventoryButton=document.createElement('button');inventoryButton.id='inventory-button';inventoryButton.className='icon-button';inventoryButton.title='Inventory (I)';inventoryButton.setAttribute('aria-label','Inventory');inventoryButton.innerHTML='<img src="assets/ui-backpackop.png" alt="">';$('#hud footer').append(inventoryButton);
const vanillaHud=mountVanillaHud($('#hud'));
const inventoryMenuButton=document.createElement('button');inventoryMenuButton.id='inventory-menu-button';inventoryMenuButton.className='text-button';inventoryMenuButton.textContent='Inventory · I';$('#menu .menu-bottom').insertBefore(inventoryMenuButton,$('#sound-button'));
$('#hud .hint').innerHTML+=' · I <span>INVENTORY</span>';
function icon(id,className=''){const key=SKILLS[id]?.icon||`spell-${skillIcons[id]||'magic'}`;return `<img class="${className}" src="assets/ui-${key}.png" alt="" draggable="false">`;}
try{save=JSON.parse(localStorage.getItem('allods-survivors-v1'));}catch{}save={gold:0,best:0,runs:0,upgrades:{},...save};save.upgrades={...save.upgrades};
rebalanceSavedItems(save);save.inventory=new Inventory(save.inventory).snapshot();
save.shopGeneration=Number.isSafeInteger(save.shopGeneration)?save.shopGeneration:Date.now();
save.shopStock=new Inventory({bag:Array.isArray(save.shopStock)?save.shopStock:shopStock(save.shopGeneration,1+Math.floor(save.best/120),world?.hero||selected)}).bag;
save.difficulty=Object.hasOwn(DIFFICULTIES,save.difficulty)?save.difficulty:'normal';persist();
const difficultyRow=document.createElement('div');difficultyRow.className='difficulty-setting';difficultyRow.setAttribute('role','group');difficultyRow.setAttribute('aria-label','Difficulty');
difficultyRow.innerHTML=`<span>DIFFICULTY</span>${Object.entries(DIFFICULTIES).map(([id,d])=>`<button class="text-button" data-difficulty="${id}" title="${d.description}">${d.name}</button>`).join('')}`;
$('#menu .run-info').replaceWith(difficultyRow);
function updateDifficulty(){$('#menu .asset-note').textContent=DIFFICULTIES[save.difficulty].description;document.querySelectorAll('[data-difficulty]').forEach(button=>{const active=button.dataset.difficulty===save.difficulty;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});}
difficultyRow.querySelectorAll('[data-difficulty]').forEach(button=>button.onclick=()=>{save.difficulty=button.dataset.difficulty;persist();updateDifficulty();audio('click');});updateDifficulty();

function persist(){try{localStorage.setItem('allods-survivors-v1',JSON.stringify(save));}catch{toast('Progress could not be saved in this browser.');}}
function toast(message){$('#toast').textContent=message;setTimeout(()=>$('#toast').textContent='',2500);}
function resize(){
  const portrait=innerHeight>innerWidth;width=portrait?600:800;height=portrait?800:600;
  displayScale=Math.min(innerWidth/width,innerHeight/height);
  const game=$('#game');game.classList.toggle('portrait',portrait);Object.assign(game.style,{width:`${width}px`,height:`${height}px`,left:`${(innerWidth-width*displayScale)/2}px`,top:`${(innerHeight-height*displayScale)/2}px`,transform:`scale(${displayScale})`});
  canvas.width=width;canvas.height=height;ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;
  const view=battlefieldSize(width,height);world?.setViewport(view.width,view.height);
}
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
function sprite(id,x,y,{moving=false,dx=0,dy=1,time=0,scale=1,alpha=1,hit=false,frame=null,target=ctx,flipX=false}={}){
  const s=manifest?.sprites[id],img=images[id];if(!s||!img)return;
  const anim=s.animation?.[moving?'walk':'idle'],dirs=anim?.directions||s.directions||8;
  let direction=Math.round((Math.atan2(dy,dx)-Math.PI/2)/(Math.PI*2)*dirs+dirs)%dirs;
  let index=frame;if(index===null){if(anim){const phase=Math.floor(time*9)%(anim.phases||1);index=anim.offset+(anim.layout==='direction-major'?direction*anim.phases+phase:phase*dirs+direction);}else index=direction;}
  index=((index||0)%s.count+s.count)%s.count;const f=s.frames[index];target.save();target.globalAlpha=alpha;if(hit)target.filter='brightness(1.8)';if(flipX){target.translate(Math.round(x),Math.round(y));target.scale(-1,1);target.drawImage(img,f.x,f.y,f.w,f.h,-f.anchorX*scale,-f.anchorY*scale,f.w*scale,f.h*scale);}else target.drawImage(img,f.x,f.y,f.w,f.h,Math.round(x-f.anchorX*scale),Math.round(y-f.anchorY*scale),f.w*scale,f.h*scale);target.restore();
}
function ground(cameraX,cameraY,size={width,height}){
  const view={left:cameraX-size.width/2,right:cameraX+size.width/2,top:cameraY-size.height/2,bottom:cameraY+size.height/2};
  // Protect all tiles that elevation can project into the visible battlefield.
  const chunks=biomeTerrain.update({...view,top:view.top-ELEVATION_PADDING,bottom:view.bottom+ELEVATION_PADDING},world?.time||0);
  if(terrainRenderer){terrainRenderer.draw(chunks,terrainChunk,{x:cameraX,y:cameraY},size.width,size.height);ctx.drawImage(terrainRenderer.canvas,0,0);}
  else for(const chunk of chunks){
    const key=`${chunk.cx},${chunk.cy}`;let cached=fallbackTerrain.get(key);
    if(cached?.revision!==chunk.revision){const relief=reliefChunk(terrainChunk(chunk),chunk.cx,chunk.cy,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});cached={revision:chunk.revision,canvas:relief};fallbackTerrain.set(key,cached);}
    ctx.drawImage(cached.canvas,Math.floor(chunk.cx*CHUNK_SIZE-view.left),Math.floor(chunk.cy*CHUNK_SIZE-view.top)-ELEVATION_PADDING);
  }
  for(const key of terrainChunks.keys())if(!biomeTerrain.chunks.has(key)){terrainChunks.delete(key);fallbackTerrain.delete(key);}

}
function scenery(){const size=world?battlefieldSize(width,height):{width,height};return decorations({left:camera.x-size.width/2,right:camera.x+size.width/2,top:camera.y-size.height/2,bottom:camera.y+size.height/2}).map(elevatedPoint);}
function shadow(x,y,r=15){ctx.fillStyle='#07130d66';ctx.beginPath();ctx.ellipse(x,y,r,r*.4,0,0,Math.PI*2);ctx.fill();}
function glow(x,y,r,color){const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(1,'transparent');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);}
function draw(){if(!manifest||!vfx){ctx.fillStyle='#15221b';ctx.fillRect(0,0,width,height);return;}const w=world?elevatedWorld(world):null,p=w?.player;camera.x=p?world.player.x:Math.sin(menuTime*.025)*120;camera.y=p?p.y:Math.cos(menuTime*.025)*120;const view=w?battlefieldSize(width,height):{width,height};ground(camera.x,camera.y,view);const ox=view.width/2-camera.x,oy=view.height/2-camera.y;
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
    for(const g of w.gems){const x=g.x,y=g.y+Math.sin(menuTime*2+g.x)*2;if(g.type==='heal'){glow(x,y,18,'#a5363166');ctx.fillStyle='#df7f5f';ctx.fillRect(x-3,y-6,6,12);ctx.fillRect(x-6,y-3,12,6);}else if(g.type==='gold'){const coin=images['item:gold'];if(coin)ctx.drawImage(coin,x-10,y-10,20,20);}else{ctx.fillStyle=g.value>1?'#c49ce8':'#8ba9d4';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+3,y);ctx.lineTo(x,y+5);ctx.lineTo(x-3,y);ctx.closePath();ctx.fill();}}
  }
  const objects=scenery();if(w){objects.push(...[...w.enemies,...w.allies,...(w.neutrals||[])].map(e=>({...e,id:{skeleton:'skeleton_f1',zombie:'zombie_f1'}[e.type]||e.type,enemy:e,ally:w.allies.includes(e),neutral:w.neutrals?.includes(e)})),{id:CLASSES[w.hero].sprite,x:p.x,y:p.y,player:true});}else objects.push({id:'hero',x:0,y:0,prop:true,frame:0});objects.sort((a,b)=>a.y-b.y);
  for(const o of objects){if(o.x<camera.x-width/2-180||o.x>camera.x+width/2+180||o.y<camera.y-height/2-100||o.y>camera.y+height/2+250)continue;
    if(o.prop){sprite(o.id,o.x,o.y,{frame:o.frame,scale:o.scale||1,alpha:(o.alpha||.96)*(p&&Math.hypot(o.x-p.x,o.y-p.y)<100?.35:1)});continue;}const e=o.enemy;shadow(o.x,o.y,e?.boss?32:14);if(o.player){glow(o.x,o.y-20,55,'#a3ba6b18');sprite(o.id,o.x,o.y,{dx:p.dx,dy:p.dy,moving:p.moving,time:w.time,scale:1.15,alpha:p.statuses.invisibility?.ttl>0?.3:p.invulnerable>0&&Math.floor(w.time*18)%2?.45:1});ctx.strokeStyle='#d8c48b88';ctx.beginPath();ctx.ellipse(p.x,p.y+1,16,6,0,0,Math.PI*2);ctx.stroke();}else{const action=e.attackTime>0?'attack':e.moving?'walk':MONSTERS[o.id]?.animation.idleAnimated?'idleAnimated':'idle';const sampled=sampleMonsterFrame(o.id,action,e.dx,e.dy,action==='attack'?.6-e.attackTime:w.time+(e.phase||0));sprite(o.id,o.x,o.y,{...sampled,hit:e.hit>0});if(o.ally||o.neutral){ctx.strokeStyle=o.ally?'#91cfa999':'#d4c78c77';ctx.beginPath();ctx.ellipse(o.x,o.y+2,15,6,0,0,Math.PI*2);ctx.stroke();}if(e.elite){ctx.strokeStyle='#edc668';ctx.beginPath();ctx.ellipse(e.x,e.y+2,19,8,0,0,Math.PI*2);ctx.stroke();}if(e.minorBoss){const labelY=e.y-(manifest.sprites[o.id].cellHeight-2)-7;ctx.save();ctx.font='9px Georgia';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#07110c';ctx.fillStyle='#f4d37d';ctx.strokeText(e.name,e.x,labelY);ctx.fillText(e.name,e.x,labelY);ctx.restore();}if(e.boss||e.elite||e.hp<e.maxHp){const r=e.boss?30:16;ctx.fillStyle='#161d17';ctx.fillRect(e.x-r,e.y+7,r*2,3);ctx.fillStyle=e.boss||e.elite?'#d6a25d':'#a95c4b';ctx.fillRect(e.x-r,e.y+7,r*2*e.hp/e.maxHp,3);}if(e.slow>0){ctx.strokeStyle='#c1e3fa66';ctx.beginPath();ctx.ellipse(e.x,e.y,18,7,0,0,Math.PI*2);ctx.stroke();}}}
  if(w)drawSpellEffects(vfx,w,heroMetrics[w.hero]);
  for(const a of particles){ctx.globalAlpha=a.life/a.maxLife;ctx.fillStyle=a.color;const pos=elevatedPoint(a);ctx.fillRect(pos.x-1,pos.y-1,3,3);}ctx.globalAlpha=1;ctx.restore();
  const vignette=ctx.createRadialGradient(width/2,height/2,Math.min(width,height)*.2,width/2,height/2,Math.max(width,height)*.7);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#07110c99');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
  if(w)drawPlayerVitals(ctx,{...p,x:p.x+ox,y:p.y+oy},heroMetrics[w.hero]);
  if(w)for(const guide of pickupGuides(w,view)){ctx.save();ctx.translate(guide.x,guide.y);ctx.rotate(guide.angle);ctx.fillStyle=guide.color||(guide.kind==='loot'||guide.kind==='gold')?'#efd185':guide.kind==='xp'?'#a8cefa':'#e79d83';ctx.strokeStyle='#0b1710';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-5);ctx.lineTo(-2,0);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.fill();ctx.rotate(-guide.angle);ctx.font='8px Georgia';ctx.textAlign=guide.x>width-80?'right':guide.x<80?'left':'center';ctx.lineWidth=3;const label=`${guide.label}${guide.count?' ×'+guide.count:''} ${guide.distance}`;ctx.strokeText(label,0,16);ctx.fillText(label,0,16);ctx.restore();}
}
function populateClasses(){const root=$('#classes');root.replaceChildren();for(const [id,c] of Object.entries(CLASSES)){const b=document.createElement('button');b.className='class-card'+(selected===id?' selected':'');b.innerHTML=`<canvas width="120" height="90"></canvas><strong>${c.name}</strong><small>${c.text.replace(' · ','<br>')}</small>`;b.setAttribute('aria-pressed',selected===id);b.onclick=()=>{selected=id;audio('click');populateClasses();};root.append(b);const g=b.querySelector('canvas').getContext('2d');g.imageSmoothingEnabled=false;sprite(c.sprite,60,83,{target:g,scale:1.65,frame:0});}$('#bank').textContent=`· ${save.gold} gold`;}
function startRun(){pendingReplacementIndex=null;resetTerrain();audio('click');audioEngine?.setScene('playing');inventoryModel=null;const startingInventory=new Inventory(save.inventory,selected);startingInventory.autoEquip();save.inventory=startingInventory.snapshot();world=new World({hero:selected,difficulty:save.difficulty,bonuses:save.upgrades,inventory:save.inventory,viewport:battlefieldSize(width,height)});saveInventory();world.events=[];particles.length=0;keys.clear();pointer.active=false;shownStatus='';$('#menu').hidden=true;$('#modal').hidden=true;$('#hud').hidden=false;updateHud();announce('THE SHATTERED GROVE');}
function announce(text){$('#announcement').textContent=text;$('#announcement').style.opacity=1;clearTimeout(announcementTimer);announcementTimer=setTimeout(()=>$('#announcement').style.opacity=0,3300);}
const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function updateHud(){if(!world)return;const p=world.player;$('#clock').textContent=formatTime(world.time);$('#kills').textContent=world.kills;$('#gold').textContent=world.gold;$('#level').textContent=`LEVEL ${p.level}`;$('#xp-fill').style.width=`${100*p.xp/p.nextXp}%`;$('#hp-fill').style.width=`${100*p.hp/p.maxHp}%`;$('#mana-fill').style.width=`${100*p.mana/p.maxMana}%`;$('#mana-text').textContent=`${p.mana.toFixed(1)} / ${p.maxMana.toFixed(1)}`;$('#hp-text').textContent=`${p.hp.toFixed(1)} / ${p.maxHp.toFixed(1)}`;$('#dash-label').textContent=p.dashCooldown>0?`ASTRAL STEP · ${p.dashCooldown.toFixed(1)}s`:'SPACE · ASTRAL STEP';
  const boss=world.enemies.find(e=>e.finalBoss)||world.enemies.find(e=>e.boss)||world.enemies.find(e=>e.minorBoss);bossUI.hidden=!boss;if(boss){const angle=Math.atan2(boss.y-p.y,boss.x-p.x),arrow=['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(angle/(Math.PI*2)*8)+8)%8];bossUI.innerHTML=`<span>${boss.name.toUpperCase()}</span><small>${arrow} ${Math.round(Math.hypot(boss.x-p.x,boss.y-p.y))} paces</small><div><i style="width:${Math.max(0,boss.hp/boss.maxHp*100)}%"></i></div>`;}
  pickupBuffs.innerHTML=[['hasteSpell','Haste'],['shield','Shield']].filter(([id])=>p.statuses[id]?.ttl>0&&(id!=='shield'||p.statuses[id].pool>0)).map(([id,name])=>`<span>${name} ${id==='shield'?p.statuses[id].pool.toFixed(1)+' HP':p.statuses[id].ttl.toFixed(1)+'s'}</span>`).join('');
  renderSpellRow($('#skills'),world,icon);updateVanillaHud(vanillaHud,world,manifest);
}
function modal(html){$('#modal').innerHTML=`<section class="dialog">${html}</section>`;$('#modal').hidden=false;}
function cancelNewSession(){
  confirmingSession=false;keys.clear();
  if(world){world.status='playing';pause();}
  else{$('#modal').hidden=true;$('#new-session-button').focus();}
}
function confirmNewSession(){
  if(world&&world.status!=='paused')return;
  confirmingSession=true;keys.clear();pointer.active=false;audio('click');
  modal(`<div class="eyebrow">START FROM NOTHING</div><h2>New session?</h2><p>This erases your backpack, equipped items, gold, legacy upgrades,<br>survival record and run count, and refreshes the camp shop.<br>Any active run ends without rewards. This cannot be undone.</p><div class="dialog-actions"><button class="text-button" id="cancel-session">Keep my progress</button><button class="primary" id="confirm-session">Erase and start fresh</button></div>`);
  $('#cancel-session').onclick=cancelNewSession;
  $('#confirm-session').onclick=()=>{
    const generation=Math.max(Date.now(),save.shopGeneration+1);
    confirmingSession=false;closeInventoryView();
    inventoryModel=null;inventorySelection=null;inventoryReturn='menu';world=null;
    keys.clear();pointer.active=false;particles.length=0;clearTimeout(announcementTimer);
    $('#announcement').textContent='';$('#announcement').style.opacity=0;$('#toast').textContent='';
    document.body.classList.remove('hurt');bossUI.hidden=true;
    save=freshProgress(save,selected,generation);
    persist();returnMenu();$('#start').focus();
  };
  $('#cancel-session').focus();
}
function saveInventory(){if(inventoryModel)save.inventory=inventoryModel.snapshot();else if(world)save.inventory=world.inventory.snapshot();persist();}
function renderInventory(){const scroll=$('#modal .inventory-dialog')?.scrollTop||0;inventoryView({shopStock:save.shopStock,onShopMount:renderInventoryShop,inventory:inventoryModel,manifest,gold:save.gold,hero:world?.hero||selected,selectedId:inventorySelection,onSelect:id=>{inventorySelection=id;audio('click',.15);renderInventory();},onEquip:id=>{const ok=world?world.equipItem(id):inventoryModel.equip(id);if(ok){saveInventory();audio('equip');if(world)updateHud();renderInventory();}},onUnequip:slot=>{const ok=world?world.unequipItem(slot):inventoryModel.unequip(slot);if(ok){saveInventory();audio('equip');if(world)updateHud();renderInventory();}else toast('Backpack is full. Sell an item to make room.');},onSell:id=>{const earned=inventoryModel.sell(id);if(earned){save.gold+=earned;inventorySelection=null;saveInventory();audio('loot',.3);renderInventory();}},onMove:(id,target)=>{const ok=world?world.moveItem(id,target):inventoryModel.move(id,target);if(ok){inventorySelection=id;saveInventory();audio('equip');if(world)updateHud();renderInventory();}},onReject:message=>toast(message),onClose:closeInventory});$('#modal .inventory-dialog').scrollTop=scroll;}
function openInventory(){if(inventoryModel){closeInventory();return;}if(world&&!['playing','paused'].includes(world.status))return;inventoryReturn=world?.status||'menu';inventoryModel=world?.inventory||new Inventory(save.inventory,selected);inventorySelection=null;if(world)world.status='inventory';keys.clear();pointer.active=false;$('#toast').textContent='';const equipped=inventoryModel.autoEquip();if(world&&equipped.length)world.refreshEquipment();const sale=inventoryModel.autoSell();if(equipped.length)saveInventory();if(sale.sold.length){save.gold+=sale.gold;saveInventory();audio('loot');toast(`Autosold ${sale.sold.length} inferior item${sale.sold.length===1?'':'s'} for ${sale.gold} gold`);}audio('inventory');audioEngine?.setScene('paused');renderInventory();}
function closeInventory(){if(!inventoryModel)return;closeInventoryView();saveInventory();inventoryModel=null;$('#modal').hidden=true;shownStatus='';if(world){world.status='playing';if(inventoryReturn==='paused')pause();else audioEngine?.setScene('playing');}else{audioEngine?.setScene('menu');populateClasses();}}
function renderInventoryShop(root){
  shopView({root,embedded:true,tooltips:false,stock:save.shopStock,inventory:inventoryModel,manifest,gold:save.gold,
    onBuy:id=>{
      const result=purchase(inventoryModel,save.shopStock,save.gold,id);
      if(result.ok){save.gold=result.gold;inventoryModel.autoEquip();const sale=inventoryModel.autoSell();save.gold+=sale.gold;if(world){world.refreshEquipment();updateHud();}saveInventory();audio('equip');renderInventory();}
      else toast(result.message);
    },
    onRefresh:()=>{
      if(save.gold<REFRESH_COST)return;
      save.gold-=REFRESH_COST;save.shopGeneration++;
      save.shopStock=shopStock(save.shopGeneration,1+Math.floor(save.best/120),world?.hero||selected);
      persist();audio('click');renderInventory();
    }
  });
}
function showChoices(){pendingReplacementIndex=null;audio('levelup',.3);modal(`<div class="eyebrow">LEVEL ${world.player.level} - CHOOSE ONE GIFT</div><h2>Ancient knowledge</h2><p>Choose an upgrade${world.choices.length===4?' or replace a spell in a full category':''}.</p><div class="upgrade-grid ${world.choices.length===4?'four-choices':''}">${world.choices.map((c,i)=>`<button class="upgrade-card" data-choice="${i}">${icon(c.id,'upgrade-icon')}<small>${c.type==='replace'?'SWITCH SPELL':c.type==='skill'?(c.rank===1?'NEW SPELL':`RANK ${c.rank}`):'PASSIVE GIFT'}</small><strong>${c.name}</strong><p>${c.description}</p><small>${i+1} - SELECT</small></button>`).join('')}</div>`);document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(+b.dataset.choice));$('#modal button')?.focus();}
function showReplacement(index){
  pendingReplacementIndex=index;const choice=world.choices[index];
  modal(`<div class="eyebrow">SPELL CATEGORY FULL</div><h2>Learn ${choice.name}</h2><p>Choose which spell to replace. ${choice.name} starts at rank 1.</p><div class="upgrade-grid replacement-grid">${world.replacementSkills(choice.id).map((id,i)=>{const rank=world.skills[id];return `<button class="upgrade-card" data-replace="${id}">${icon(id,'upgrade-icon')}<strong>${SKILLS[id].name}</strong><small>RANK ${rank} - REPLACE (${i+1})</small></button>`;}).join('')}</div><div class="dialog-actions"><button class="text-button" id="cancel-replacement">Back to upgrades - Esc</button></div>`);
  document.querySelectorAll('[data-replace]').forEach(b=>b.onclick=()=>finishReplacement(b.dataset.replace));$('#cancel-replacement').onclick=showChoices;$('#modal button')?.focus();
}
function finishReplacement(id){if(world.choose(pendingReplacementIndex,id)){pendingReplacementIndex=null;audio('click');shownStatus='';if(world.status==='playing')$('#modal').hidden=true;else showChoices();}}
function choose(i){if(world.choices[i]?.type==='replace'){showReplacement(i);return;}if(world.choose(i)){audio('click');shownStatus='';if(world.status==='playing')$('#modal').hidden=true;}}
function pause(){if(!world||!['playing','paused'].includes(world.status))return;keys.clear();pointer.active=false;if(world.status==='paused'){world.status='playing';$('#modal').hidden=true;shownStatus='';}else{world.status='paused';modal(`<div class="eyebrow">THE RIFT CAN WAIT</div><h2>Paused - ${DIFFICULTIES[world.difficulty].name}</h2><p>Move with WASD or arrow keys. Your spells cast automatically.<br>Space dashes through danger. Collect blue shards to grow stronger.</p><div class="dialog-actions"><button class="primary" id="resume">Return to the grove</button><button class="text-button" id="abandon">End run</button><button class="text-button" id="pause-new-session">New session</button></div>${$('#menu .fan-notice').outerHTML}`);$('#pause-new-session').onclick=confirmNewSession;$('#resume').onclick=pause;$('#abandon').onclick=()=>{world.status='dead';shownStatus='';};$('#resume').focus();}}
function endRun(){const won=world.status==='won',reward=won?world.runReward():0;if(won){save.gold+=reward;save.best=Math.max(save.best,world.time);save.runs++;saveInventory();}else{inventoryModel=null;inventorySelection=null;save=resetAfterDeath(world,save);persist();updateHud();}audio(won?'win':'death',.4);modal(`<div class="eyebrow">${won?'THE ALLOD ENDURES':'ANOTHER SOUL RETURNS TO THE ASTRAL'}</div><h2>${won?'Dawn breaks':'The grove falls silent'}</h2><div class="eyebrow">${DIFFICULTIES[world.difficulty].name.toUpperCase()} DIFFICULTY</div><p>${won?'Urd has fallen. Your legacy will be remembered.':'Death erased your items, learned spells, gold and legacy. Your next character starts fresh.'}</p><div class="stats"><div><strong>${formatTime(world.time)}</strong><small>SURVIVED</small></div><div><strong>${world.kills}</strong><small>SLAIN</small></div><div><strong>${reward}</strong><small>GOLD EARNED</small></div></div><div class="dialog-actions"><button class="primary" id="again">Walk the allod again</button><button class="text-button" id="return">Return to camp</button></div>`);$('#again').onclick=startRun;$('#return').onclick=returnMenu;$('#again').focus();}
function returnMenu(){pendingReplacementIndex=null;resetTerrain();world=null;inventoryModel=null;audioEngine?.setScene('menu');shownStatus='';$('#modal').hidden=true;$('#hud').hidden=true;$('#menu').hidden=false;populateClasses();}
function legacy(){const options=[['power','Astral attunement','+4% spell damage per rank'],['vitality','Enduring soul','+10 starting health per rank'],['magnet','Soul affinity','+8 collection range per rank']];modal(`<div class="eyebrow">GOLD IS LOST ON DEATH</div><h2>Your legacy</h2><p>${save.gold} gold available · Best survival ${formatTime(save.best)}</p>${options.map(([id,name,text])=>{const rank=save.upgrades[id]||0,cost=25+rank*25;return `<div class="legacy-row"><div><strong>${name} <span style="color:#a69b76">${rank}/5</span></strong><small>${text}</small></div><button data-buy="${id}" ${rank>=5||save.gold<cost?'disabled':''}>${rank>=5?'Mastered':`${cost} gold`}</button></div>`;}).join('')}<div class="dialog-actions"><button class="text-button" id="close-legacy">Return to camp</button></div>`);document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const id=b.dataset.buy,rank=save.upgrades[id]||0,cost=25+rank*25;if(rank<5&&save.gold>=cost){save.gold-=cost;save.upgrades[id]=rank+1;persist();audio('click');legacy();populateClasses();}});$('#close-legacy').onclick=()=>$('#modal').hidden=true;}
$('#start').onclick=startRun;$('#pause-button').onclick=pause;$('#legacy-button').onclick=legacy;$('#sound-button').onclick=()=>{sound=!sound;audioEngine?.setEnabled(sound);$('#sound-button').textContent=`Sound: ${sound?'on':'off'}`;};
$('#inventory-button').onclick=openInventory;$('#inventory-menu-button').onclick=openInventory;
const newSessionButton=document.createElement('button');newSessionButton.id='new-session-button';newSessionButton.className='text-button session-button';newSessionButton.textContent='New session';newSessionButton.onclick=confirmNewSession;$('#menu .asset-note').before(newSessionButton);
const exportSaveButton=document.createElement('button');exportSaveButton.id='export-save-button';exportSaveButton.className='text-button session-button';exportSaveButton.textContent='Export save';exportSaveButton.onclick=()=>{persist();const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='Allods-Survivors-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};newSessionButton.after(exportSaveButton);
addEventListener('keydown',e=>{const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();if(confirmingSession){if(key==='escape')cancelNewSession();if(key!=='tab'&&key!=='enter')e.preventDefault();return;}keys.add(key);if(e.repeat)return;if(pendingReplacementIndex!==null&&world?.status==='levelup'){if(key==='escape'){e.preventDefault();showChoices();}else if(['1','2','3','4','5','6','7','8'].includes(key))finishReplacement(world.replacementSkills(world.choices[pendingReplacementIndex].id)[+key-1]);return;}if(key==='i'){e.preventDefault();openInventory();return;}if(key==='escape'){if(inventoryModel)closeInventory();else if(world)pause();else $('#modal').hidden=true;}if(key===' '&&world)world.dash();if(world?.status==='levelup'&&['1','2','3','4'].includes(key))choose(+key-1);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{keys.clear();pointer.active=false;if(world?.status==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&world?.status==='playing')pause();audioEngine?.setScene(document.hidden?'hidden':world?.status==='playing'?'playing':'paused');});
canvas.addEventListener('pointerdown',e=>{if(world?.status!=='playing')return;pointer.active=true;pointer.x=e.clientX;pointer.y=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(pointer.active){pointer.x=e.clientX;pointer.y=e.clientY;}});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,()=>pointer.active=false);
let hudTimer=0;
function frame(now){const dt=Math.min((now-last)/1000||0,.05);last=now;menuTime+=dt;
  if(world){let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(!x&&!y&&pointer.active){const bounds=canvas.getBoundingClientRect();x=(pointer.x-bounds.left)/displayScale-battlefieldSize(width,height).width/2;y=(pointer.y-bounds.top)/displayScale-battlefieldSize(width,height).height/2;if(Math.hypot(x,y)<15)x=y=0;}
    world.step(dt,{x,y});const stage=biomeStage(world.time);if(stage!==announcedBiome){announcedBiome=stage;announce(BIOMES[stage].name.toUpperCase());}for(const ev of world.events){
      if(ev.type==='kill'){for(let i=0;i<4;i++)particles.push({x:ev.x,y:ev.y-15,vx:(Math.random()-.5)*80,vy:(Math.random()-.5)*80,life:.4,maxLife:.4,color:'#b5b086'});if(Math.hypot(ev.x-world.player.x,ev.y-world.player.y)<400)audio('kill',.08);}
      if(ev.type==='enemyCast')audio(({fire:'fire',water:ev.skill==='poison'?'poison':'ice',air:'lightning',earth:'meteor',astral:'orbit'})[ev.element],.08);
      if(ev.type==='cast')audio(({fire:'fire',water:ev.skill==='poison'?'poison':'ice',air:'lightning',earth:'meteor',astral:ev.skill==='heal'?'healing':'orbit'})[SKILLS[ev.skill]?.element],.18);
      if(ev.type==='hurt'){audio('hurt',.35);document.body.classList.add('hurt');setTimeout(()=>document.body.classList.remove('hurt'),120);}
      if(ev.type==='champion'){announce(ev.name.toUpperCase());audio('levelup',.12);}if(ev.type==='championKilled')toast('Champion defeated - equipment, gold and power-up dropped');if(ev.type==='powerup'){toast(`${ev.name} collected`);audio(ev.kind==='heal'?'healing':'loot',.3);}
      if(ev.type==='boss')announce(ev.name.toUpperCase());if(ev.type==='bossKilled'){announce(ev.finalBoss?'URD HAS FALLEN':'GUARDIAN FALLEN');audio('win',.2);}
      if(ev.type==='dash')audio('dash',.2);if(ev.type==='pickup')audio(ev.kind==='heal'?'healing':'pickup',ev.kind==='heal'?.2:.06);
      if(ev.type==='lootPicked'){save.gold+=ev.saleGold||0;saveInventory();audio('loot',.4);toast(ev.autoEquipped?.length?`Auto-equipped ${ev.autoEquipped.join(', ')}${ev.autoSold?' ? autosold '+ev.autoSold+' for '+ev.saleGold+' gold':''}`:ev.autoSold?`${ev.kept?ev.item.name+' collected; ':''}autosold ${ev.autoSold} inferior item${ev.autoSold===1?'':'s'} for ${ev.saleGold} gold`:`${ev.item.name} collected · I to inspect`);}
      if(ev.type==='inventoryFull')toast('Backpack full · I to equip or sell items');
    }world.events=[];
    if(world.status!==shownStatus){shownStatus=world.status;audioEngine?.setScene(document.hidden?'hidden':shownStatus==='playing'?'playing':'paused');if(shownStatus==='levelup')showChoices();if(['won','dead'].includes(shownStatus))endRun();}hudTimer+=dt;if(hudTimer>.1){updateHud();hudTimer=0;}
  }
  if(!world||world.status==='playing'){for(const a of particles){a.life-=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;}for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);}
  draw();requestAnimationFrame(frame);
}
async function boot(){try{const response=await fetch('assets/manifest.json');if(!response.ok)throw Error('Asset manifest is missing.');manifest=await response.json();audioEngine=new GameAudio(manifest);const groups={...manifest.sprites,...manifest.terrain,...Object.fromEntries(Object.entries(POWERUPS).map(([id,def])=>[`powerup:${id}`,{src:`assets/ui-${def.icon}.png`} ])),...Object.fromEntries(Object.entries(manifest.vfx).map(([id,entry])=>[`vfx:${id}`,entry])),...Object.fromEntries(Object.entries(manifest.items).map(([id,entry])=>[`item:${id}`,entry]))};await Promise.all(Object.entries(groups).map(async([id,s])=>{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(`Cannot load ${s.src}`));img.src=s.src;});images[id]=img;}));await document.fonts.load('14px "Allods Romul"').catch(()=>{});measureHeroes();vfx=new VfxRenderer(ctx,manifest.vfx,images);terrainChunks.clear();populateClasses();$('#start').disabled=false;$('#start').textContent='Enter the shattered grove';}catch(e){$('#start').textContent='Assets could not load';toast(e.message);console.error(e);}}
// Read-only observability for browser smoke checks and debugging.
window.survivors={get world(){return world;},get manifest(){return manifest;},get ready(){return !$('#start').disabled;},get resolution(){return {width,height,displayScale};},get biome(){return {stage:biomeStage(world?.time||0),name:BIOMES[biomeStage(world?.time||0)].name,chunks:[...biomeTerrain.chunks.values()].map(({cx,cy,tiles,revision})=>({cx,cy,tiles:[...tiles],weights:biomeTerrain.chunks.get(`${cx},${cy}`).weights.map(w=>[...w]),revision})),cacheSize:terrainChunks.size};},get terrain(){return {renderer:canvas.dataset.terrainRenderer,cacheSize:terrainRenderer?.cache.size||0,contextLost:terrainRenderer?.gl.isContextLost()||false};},get renderedVfx(){return [...(vfx?.used||[])];},get audio(){return {enabled:sound,played:[...(audioEngine?.played||[])],ambient:!!audioEngine?.ambientSource,voices:audioEngine?.voices.size||0};}};
boot();requestAnimationFrame(frame);
