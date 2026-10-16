import {SLOTS,makeItem,sellPrice,canEquip} from './loot.mjs';
export const REFRESH_COST=8;
export const buyPrice=item=>sellPrice(item)*3;
export function shopStock(seed=Date.now(),level=1,hero=null){
  let state=seed>>>0;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  return SLOTS.map((slot,index)=>makeItem(rng,{hero,id:`shop-${seed}-${index}`,slot,level,boss:index>=3}));
}
export function purchase(inventory,stock,gold,id){
  const item=stock.find(entry=>entry.id===id);
  if(!item)return {ok:false,gold,message:'This item has already been sold.'};
  if(!canEquip(item,inventory.hero))return {ok:false,gold,message:'This item belongs to another class.'};
  const price=buyPrice(item);
  if(!Number.isFinite(gold)||gold<price)return {ok:false,gold,message:'Not enough gold.'};
  if(!inventory.add(item))return {ok:false,gold,message:'Backpack is full. Sell an item to make room.'};
  stock.splice(stock.indexOf(item),1);return {ok:true,gold:gold-price,item};
}
