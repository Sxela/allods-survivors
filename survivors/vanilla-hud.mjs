import {nativeTileAt} from './map-arenas.mjs';
import {paperdollLayers} from './wardrobe.mjs';
import {SPELL_CAPS} from './spell-loadout.mjs';
import {SPELLS} from './original-spells.mjs';
import {BIOMES,biomeStage} from './biomes.mjs';
import {landscapeFeatures,decorations,terrainElevation} from './landscape.mjs';
export const HUD_WIDTH=160,HUD_BOTTOM=64,MOBILE_HUD_BOTTOM=80;
export function battlefieldSize(width,height,mobile=false,safeBottom=0){return {width:width-(mobile?0:HUD_WIDTH),height:height-(mobile?MOBILE_HUD_BOTTOM+safeBottom:HUD_BOTTOM)};}
export function mountVanillaHud(hud){
  const side=document.createElement('aside');side.id='vanilla-sidebar';side.innerHTML='<div id="minimap-frame"><canvas id="minimap" width="128" height="128" aria-label="Minimap: terrain, enemies and nearby loot"></canvas></div><div id="action-bar" aria-label="Actions"></div><div id="hud-vitals"></div><div id="hud-character" aria-label="Equipped character"></div>';
  hud.append(side);side.querySelector('#action-bar').append(hud.querySelector('#inventory-button'));side.querySelector('#hud-vitals').append(hud.querySelector('.health-panel'));side.insertBefore(hud.querySelector('header'),side.querySelector('#hud-character'));
  hud.append(hud.querySelector('#pause-button'));
  const relief=document.createElement('canvas');relief.width=relief.height=16;
  return {side,relief,dollSignature:'',spellSignature:'',lastMap:-1};
}
export function renderSpellRow(root,world,icon){
  const pool=world.castingSkills(),signature=JSON.stringify(pool.map(s=>[s.id,s.rank,s.source,world.effectiveRank(s.id,s.rank)]));
  if(root.dataset.signature!==signature){
    root.dataset.signature=signature;root.replaceChildren();
    for(const group of ['offense','defense']){
      const section=document.createElement('div');section.className='spell-group';section.dataset.group=group;section.setAttribute('aria-label',`${group} spells: maximum ${SPELL_CAPS[group]}`);
      const spells=pool.filter(s=>s.group===group);
      for(let i=0;i<SPELL_CAPS[group];i++){
        const entry=spells[i],slot=document.createElement('div');slot.className=`skill-slot${entry?'':' empty'}`;slot.dataset.group=group;
        if(entry){const effective=world.effectiveRank(entry.id,entry.rank);slot.dataset.skill=entry.id;slot.classList.toggle('gear-granted',entry.source==='gear');slot.innerHTML=`${icon(entry.id)}<span class="spell-cooldown" aria-hidden="true"></span><small>${entry.source==='gear'?`G${effective}`:`${entry.rank.toFixed(1)}${effective>entry.rank?'+':''}`}</small>`;}
        section.append(slot);
      }
      root.append(section);
    }
  }
  for(const slot of root.querySelectorAll('[data-skill]')){
    const id=slot.dataset.skill,entry=pool.find(s=>s.id===id),status=world.player.statuses[id],active=status?.ttl>0&&(id!=='shield'||status.pool>0);
    const remaining=Math.max(0,world.cooldowns[id]||0),duration=world.cooldownDurations?.[id]||0,fraction=duration&&!world.cooldownWaiting?.[id]?Math.min(1,remaining/duration):0;
    slot.style.setProperty('--cooldown-angle',`${fraction*360}deg`);slot.dataset.cooldown=fraction.toFixed(3);
    slot.classList.toggle('buff-active',!!active);slot.querySelector('.buff-state')?.remove();
    if(active){const label=document.createElement('span');label.className='buff-state';label.textContent=id==='shield'?status.pool.toFixed(1):status.ttl.toFixed(1)+'s';slot.append(label);}
    slot.tabIndex=0;slot.setAttribute('role','button');slot.setAttribute('aria-controls','spell-detail');slot.setAttribute('aria-label',SPELLS[id].name+' spell details');slot.setAttribute('aria-label',`${SPELLS[id].name} - rank ${world.effectiveRank(id,entry.rank).toFixed(1)} (${entry.source==='gear'?'granted by gear; not learned':entry.rank+' learned'})${active?' - self-cast active':''}`);
  }
}
export function updateVanillaHud(state,world,manifest){
  const p=world.player,signature=world.hero+JSON.stringify(Object.values(world.inventory.equipment).map(item=>item&&[item.id,item.icon]));
  if(signature!==state.dollSignature){
    state.dollSignature=signature;const root=state.side.querySelector('#hud-character');root.replaceChildren();
    for(const layer of paperdollLayers(manifest,world.hero,world.inventory.equipment)){
      const img=document.createElement('img');img.src=layer.src;img.alt='';img.draggable=false;
      img.className=layer.kind==='body'?'doll-body':layer.kind==='clothing'?'base-clothing':'doll-equipment';
      if(layer.slot){img.dataset.dollLayer=layer.slot;img.dataset.dollDepth=layer.back?'back':'front';}
      root.append(img);
    }
  }
  if(world.time-state.lastMap<.1&&world.time>=state.lastMap)return;state.lastMap=world.time;
  const canvas=state.side.querySelector('#minimap'),g=canvas.getContext('2d'),span=1400,scale=128/span,x0=p.x-span/2,y0=p.y-span/2;
  g.fillStyle=['#35432a','#635838','#51493f','#60605b','#413b35'][biomeStage(world.terrainTime??world.time)];g.fillRect(0,0,128,128);
  if(world.campaign)for(let y=0;y<16;y++)for(let x=0;x<16;x++){const tile=nativeTileAt(x0+(x*8+4)/scale,y0+(y*8+4)/scale),type=tile>=0?(tile&960)>>6:-1;g.fillStyle=type<0?'#0a130e':type>=8&&type<=11?'#347297':type===7?'#5b554a':type===2?'#a29361':type===1||type===4?'#675848':'#354c2b';g.fillRect(x*8,y*8,8,8);}
  const view={left:x0,right:x0+span,top:y0,bottom:y0+span};
  const relief=state.relief.getContext('2d');relief.clearRect(0,0,16,16);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const h=terrainElevation(x0+(x*8+4)/scale,y0+(y*8+4)/scale);relief.fillStyle=h>0?`rgba(210,190,129,${Math.min(.6,h/170)})`:`rgba(5,15,24,${Math.min(.5,-h/130)})`;relief.fillRect(x,y,1,1);}
  g.save();g.imageSmoothingEnabled=true;g.drawImage(state.relief,0,0,128,128);g.restore();
  for(const f of landscapeFeatures(view)){if(f.kind!=='lake')continue;g.fillStyle='#347297';g.beginPath();g.ellipse((f.x-x0)*scale,(f.y-y0)*scale,f.rx*scale,f.ry*scale,0,0,Math.PI*2);g.fill();}
  for(const o of decorations(view)){g.fillStyle=o.id.startsWith('scenery-')?'#bfac7d':'#20371d';g.fillRect((o.x-x0)*scale,(o.y-y0)*scale,2,2);}
  const dot=(x,y,color,size=2)=>{const px=(x-x0)*scale,py=(y-y0)*scale;if(px<1||py<1||px>126||py>126)return;g.fillStyle=color;g.fillRect(Math.round(px-size/2),Math.round(py-size/2),size,size);};
  for(const e of world.enemies)if(e.hp>0)dot(e.x,e.y,e.boss||e.minorBoss?'#ffb277':'#e27264',e.boss?4:2);
  if(world.campaign?.exit)dot(world.campaign.exit.x,world.campaign.exit.y,'#9ce7df',5);
  for(const loot of world.lootDrops)dot(loot.x,loot.y,'#ffe392',3);
  for(const gem of world.gems)dot(gem.x,gem.y,gem.type==='heal'?'#8fe897':gem.type==='gold'?'#e3c459':'#8ba9d4');
  g.strokeStyle='#eee2a766';g.strokeRect(64-world.viewport.width*scale/2,64-world.viewport.height*scale/2,world.viewport.width*scale,world.viewport.height*scale);dot(p.x,p.y,'#ffffff',4);g.fillStyle='#ece2b0';g.font='8px Georgia';g.fillText('N',61,9);
}
