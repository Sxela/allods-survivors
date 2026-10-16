import {STAT_LABELS,formatStat,classLabel,canEquip} from './loot.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=value=>value[0].toUpperCase()+value.slice(1);

export function attachInventoryTooltip(root,{inventory,manifest}){
  const controller=new AbortController(),options={signal:controller.signal},stage=document.querySelector('#game');
  let tooltip=null,anchor=null;
  const hide=()=>{if(anchor)anchor.removeAttribute('aria-describedby');tooltip?.remove();tooltip=null;anchor=null;};
  const position=()=>{
    if(!tooltip||!anchor)return;
    const bounds=stage.getBoundingClientRect(),cell=anchor.getBoundingClientRect(),sx=bounds.width/stage.clientWidth,sy=bounds.height/stage.clientHeight;
    const left=(cell.left-bounds.left)/sx,right=(cell.right-bounds.left)/sx,top=(cell.top-bounds.top)/sy,bottom=(cell.bottom-bounds.top)/sy,w=tooltip.offsetWidth,h=tooltip.offsetHeight,pad=8;
    let x,y;
    if(right+pad+w<=stage.clientWidth-pad){x=right+pad;y=top;}
    else if(left-pad-w>=pad){x=left-pad-w;y=top;}
    else{x=Math.max(pad,Math.min(stage.clientWidth-w-pad,(left+right-w)/2));y=bottom+pad+h<=stage.clientHeight-pad?bottom+pad:top-pad-h;}
    tooltip.style.left=`${Math.max(pad,Math.min(stage.clientWidth-w-pad,x))}px`;
    tooltip.style.top=`${Math.max(pad,Math.min(stage.clientHeight-h-pad,y))}px`;
  };
  const show=element=>{
    if(!element||root.classList.contains('is-dragging')){hide();return;}
    const item=[...inventory.bag,...Object.values(inventory.equipment).filter(Boolean)].find(entry=>entry.id===element.dataset.itemId);
    if(!item){hide();return;}if(anchor===element&&tooltip)return;
    hide();anchor=element;
    const current=inventory.equipment[item.slot],isEquipped=current?.id===item.id,compare=!isEquipped;
    const keys=[...new Set([...Object.keys(item.stats),...Object.keys(compare?current?.stats||{}:{})])];
    const value=(key,number)=>number?formatStat(key,number).split(' ')[0]:'—';
    const heading=(gear,label)=>`<div class="tooltip-item-heading"><small>${label}</small>${gear?`<div><img src="${manifest.items[gear.icon].src}" alt=""><span class="rarity-${gear.rarity}"><strong>${escape(gear.name)}</strong><em>${title(gear.rarity)} ${title(gear.slot)} - ${classLabel(gear)}${canEquip(gear,inventory.hero)?'':' - Inactive'}</em></span></div>`:'<p class="tooltip-empty">Nothing equipped</p>'}</div>`;
    tooltip=document.createElement('div');tooltip.id='inventory-item-tooltip';tooltip.className=`inventory-tooltip${compare?' comparing':''}`;tooltip.setAttribute('role','tooltip');
    tooltip.innerHTML=`<div class="tooltip-headings">${heading(item,isEquipped?'EQUIPPED':'HOVERED ITEM')}${compare?heading(current,'CURRENTLY EQUIPPED'):''}</div><table class="tooltip-stats"><thead><tr><th>Stat</th><th>${isEquipped?'Equipped':'Item'}</th>${compare?'<th>Equipped</th><th>Change</th>':''}</tr></thead><tbody>${keys.map(key=>{const amount=item.stats[key]||0,old=compare?(canEquip(current,inventory.hero)?current?.stats[key]||0:0):amount,delta=Math.round((amount-old)*1000)/1000;return `<tr data-stat="${key}"><th>${STAT_LABELS[key]}</th><td>${value(key,amount)}</td>${compare?`<td>${value(key,old)}</td><td class="${delta>0?'better':delta<0?'worse':'unchanged'}">${delta?value(key,delta):'—'}</td>`:''}</tr>`;}).join('')}</tbody></table><p class="tooltip-note">${!canEquip(item,inventory.hero)?'Unavailable for this class':compare?'Green improves · red reduces · changes apply when equipped':'Currently worn by your character'}</p>`;
    stage.append(tooltip);anchor.setAttribute('aria-describedby',tooltip.id);position();
  };
  // Rich tooltips replace native title bubbles on items and paperdoll regions.
  root.querySelectorAll('[data-item-id]').forEach(element=>element.removeAttribute('title'));
  root.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;show(event.target.closest('[data-item-id]'));},options);
  root.addEventListener('pointerout',event=>{if(anchor&&!anchor.contains(event.relatedTarget))hide();},options);
  root.addEventListener('focusin',event=>show(event.target.closest('[data-item-id]')),options);
  root.addEventListener('focusout',hide,options);
  root.addEventListener('pointerdown',hide,options);
  root.addEventListener('scroll',hide,{...options,capture:true});
  window.addEventListener('resize',hide,options);window.addEventListener('blur',hide,options);
  return ()=>{controller.abort();hide();};
}
