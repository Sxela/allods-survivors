// Pointer-based dragging works for mouse and touch inside the scaled game UI.
import {canEquip,classLabel} from './loot.mjs';
export function attachInventoryDrag(root,{inventory,onMove,onReject}){
  const controller=new AbortController(),options={signal:controller.signal};
  let gesture=null,ghost=null,hover=null,suppressClick=false;
  const clearHover=()=>{if(hover)hover.classList.remove('drop-valid','drop-invalid');hover=null;};
  const cleanup=()=>{clearHover();ghost?.remove();ghost=null;gesture?.source.classList.remove('drag-origin');gesture=null;root.classList.remove('is-dragging');};
  const targetAt=(x,y)=>{
    const element=document.elementFromPoint(x,y),cell=element?.closest('[data-drop-slot],[data-bag-index],[data-drop-auto]');
    if(!cell||!root.contains(cell))return null;
    const item=gesture.item;
    if(cell.hasAttribute('data-bag-index')){const index=Number(cell.dataset.bagIndex),other=inventory.bagAt(index),inBag=inventory.bag.some(entry=>entry.id===item.id);
      return {cell,target:{bagIndex:index},valid:inBag?inventory.positions[item.id]!==index:!other||(other.slot===item.slot&&canEquip(other,inventory.hero))};}
    const slot=cell.dataset.dropSlot||item.slot;
    return {cell,target:{slot},valid:canEquip(item,inventory.hero)&&item.slot===slot&&inventory.bag.some(entry=>entry.id===item.id)};
  };
  const update=event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    if(!gesture.dragging&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<5)return;
    event.preventDefault();
    if(!gesture.dragging){gesture.dragging=true;suppressClick=true;root.classList.add('is-dragging');gesture.source.classList.add('drag-origin');
      const image=gesture.source.querySelector('img')||root.querySelector(`[data-select="${CSS.escape(gesture.item.id)}"] img`);
      if(image){ghost=image.cloneNode();const bounds=gesture.source.getBoundingClientRect();ghost.className='inventory-drag-ghost';ghost.style.width=`${Math.min(90,Math.max(36,bounds.width))}px`;ghost.style.height=ghost.style.width;document.body.append(ghost);}}
    if(ghost){ghost.style.left=`${event.clientX}px`;ghost.style.top=`${event.clientY}px`;}
    clearHover();const target=targetAt(event.clientX,event.clientY);if(target){hover=target.cell;hover.classList.add(target.valid?'drop-valid':'drop-invalid');}
  };
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0||gesture)return;const source=event.target.closest('[data-item-id]');if(!source||!root.contains(source))return;
    const item=[...inventory.bag,...Object.values(inventory.equipment).filter(Boolean)].find(entry=>entry.id===source.dataset.itemId);if(!item)return;
    gesture={pointerId:event.pointerId,source,item,x:event.clientX,y:event.clientY,dragging:false};source.setPointerCapture(event.pointerId);
  },options);
  document.addEventListener('pointermove',update,{...options,passive:false});
  document.addEventListener('pointerup',event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;const {dragging,item}=gesture,drop=dragging?targetAt(event.clientX,event.clientY):null;
    cleanup();if(dragging){event.preventDefault();setTimeout(()=>suppressClick=false,0);if(drop?.valid)onMove(item.id,drop.target);else if(drop)onReject?.(canEquip(item,inventory.hero)?`Use the ${item.slot} slot, or an available backpack cell.`:`Requires ${classLabel(item)}. Store this item in your backpack.`);}
  },options);
  document.addEventListener('pointercancel',cleanup,options);
  root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}},{...options,capture:true});
  root.addEventListener('dragstart',event=>event.preventDefault(),options);
  return ()=>{controller.abort();cleanup();};
}
