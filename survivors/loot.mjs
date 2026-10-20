// Independent, serializable loot and equipment model. All stat values are
// additive: damage/haste are fractions, the remaining stats are world units.
import {ITEM_CATALOG} from './item-catalog.mjs';
import {STAT_DEFINITIONS,STAT_LABELS,STAT_LIMITS,itemFamily,BASE_STATS,rollAffixes,UNIQUES,AFFIXES} from './item-affixes.mjs';
export {STAT_LABELS,itemFamily};
export const SLOTS=Object.freeze(['weapon','armor','helm','boots','ring','amulet','shield','bracers','gloves']);
const ITEM_VARIANTS=Object.fromEntries(SLOTS.map(slot=>[slot,Object.keys(ITEM_CATALOG).filter(key=>ITEM_CATALOG[key].slot===slot)]));
const HEROES=['mage','warrior','ranger'];
export function itemClasses(item){return own(ITEM_CATALOG,item?.icon)?ITEM_CATALOG[item.icon].classes:HEROES;}
export function canEquip(item,hero){return !HEROES.includes(hero)||itemClasses(item).includes(hero);}
export function classLabel(item){const classes=itemClasses(item);return classes.length===3?'All classes':classes.map(hero=>({mage:'Mage',warrior:'Warrior',ranger:'Archer'})[hero]).join(' / ');}
const LIMITS=STAT_LIMITS;
const RARITIES=['common','magic','rare','unique'];
const CAPACITY=36;
const ID=/^[A-Za-z0-9_.:-]{1,80}$/;
const round=value=>Math.round(value*1000)/1000;
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const emptyEquipment=()=>Object.fromEntries(SLOTS.map(slot=>[slot,null]));

export const ITEM_BALANCE_VERSION=2;
export function balancedBonus(key,value){
  if(key.startsWith('skill:'))return Math.min(3,Math.max(1,Math.floor(value)));
  const cap=key==='maxHp'?60:LIMITS[key];
  return Math.min(cap,Math.max(.001,round(value*.1)));
}
// Convert legacy gear once, retaining art, identities, affixes and spell grants.
export function rebalanceSavedItems(save){
  for(const item of [...(save.inventory?.bag||[]),...Object.values(save.inventory?.equipment||{}),...(save.shopStock||[])]){
    if(!plain(item)||!plain(item.stats))continue;item.stats=Object.fromEntries(Object.entries(item.stats).filter(([key,value])=>own(LIMITS,key)&&Number.isFinite(value)&&value>0&&value<=LIMITS[key]));if(item.balanceVersion===ITEM_BALANCE_VERSION)continue;
    item.stats=Object.fromEntries(Object.entries(item.stats).filter(([key,value])=>own(LIMITS,key)&&Number.isFinite(value)&&value>0&&value<=LIMITS[key]).map(([key,value])=>[key,balancedBonus(key,value)]));
    item.balanceVersion=ITEM_BALANCE_VERSION;
  }
  return save;
}

export function formatStat(key,value) {
  if(!own(STAT_LABELS,key)||!Number.isFinite(value))return '';
  const percent=STAT_DEFINITIONS[key].percent,amount=percent?value*100:value;
  const rounded=Math.sign(amount)*Math.round((Math.abs(amount)+Number.EPSILON)*10)/10;
  return `${rounded>=0?'+':''}${rounded.toFixed(1)}${percent?'%':''} ${STAT_LABELS[key]}`;
}

export function sellPrice(item){
  const weights={damage:40,maxHp:.08,armor:.8,speed:.2,haste:40,magnet:.05,regen:4,magicFind:15,goldFind:15};
  return Math.max(1,Math.round(({common:6,magic:14,rare:30,unique:90}[item.rarity]||0)+Object.entries(item.stats).reduce((sum,[key,value])=>sum+(weights[key]??(key.startsWith('skill:')?25:STAT_DEFINITIONS[key]?.percent?20:2))*value,0)));
}

// Missing bonuses count as zero, just like the comparison tooltip. Any gain
// or unique positive bonus prevents a sale; an extra bonus can dominate zero.
export function outclasses(better,item){
  if(better.slot!==item.slot)return false;
  if(!itemClasses(item).every(hero=>canEquip(better,hero)))return false;
  return betterStats(better,item);
}
export function betterStats(better,item){
  if(better.slot!==item.slot)return false;
  const keys=[...new Set([...Object.keys(item.stats),...Object.keys(better.stats)])];
  return keys.every(key=>(better.stats[key]||0)>=(item.stats[key]||0))&&keys.some(key=>(better.stats[key]||0)>(item.stats[key]||0));
}
function autoEquipment(bag,equipment,hero){
  const remaining=[...bag],slots={...equipment},equipped=[];
  for(const slot of SLOTS){
    const previous=slots[slot];let best=previous&&canEquip(previous,hero)?previous:null;
    for(const item of remaining)if(item.slot===slot&&canEquip(item,hero)&&(!best||betterStats(item,best)))best=item;
    if(best&&best!==previous){remaining.splice(remaining.indexOf(best),1);if(previous)remaining.push(previous);slots[slot]=best;equipped.push({item:best,previous});}
  }
  return {bag:remaining,equipment:slots,equipped};
}

function inferiorItems(candidates,equipped){
  const all=[...candidates,...equipped];
  return candidates.filter(item=>all.some(other=>outclasses(other,item)));
}

function readItem(raw) {
  if(!plain(raw)||typeof raw.id!=='string'||!ID.test(raw.id)||!SLOTS.includes(raw.slot)||!RARITIES.includes(raw.rarity))return null;
  if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>100||/[\u0000-\u001f\u007f]/.test(raw.name)||!plain(raw.stats))return null;
  const stats={};
  for(const key of Object.keys(STAT_LABELS)){
    if(!own(raw.stats,key))continue;
    const value=raw.stats[key];
    if(typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=LIMITS[key])stats[key]=key.startsWith('skill:')?Math.floor(value):round(value);
  }
  if(!Object.values(stats).some(value=>value>0))return null;
  const icon=own(ITEM_CATALOG,raw.icon)&&ITEM_CATALOG[raw.icon].slot===raw.slot?raw.icon:raw.slot;
  const item={id:raw.id,name:raw.name.trim(),slot:raw.slot,rarity:raw.rarity,stats,icon};
  if(raw.balanceVersion===ITEM_BALANCE_VERSION)item.balanceVersion=ITEM_BALANCE_VERSION;
  if(Array.isArray(raw.affixes))item.affixes=[...new Set(raw.affixes.filter(id=>typeof id==='string'&&AFFIXES.some(a=>a.id===id)))].slice(0,6);
  if(typeof raw.uniqueId==='string'&&Object.hasOwn(UNIQUES,raw.uniqueId)&&raw.rarity==='unique')item.uniqueId=raw.uniqueId;
  return item;
}

export function makeItem(rng,{level=1,boss=false,id,magicFind=0,slot:forcedSlot,statMultiplier=1,hero=null}={}) {
  if(typeof rng!=='function')throw new TypeError('makeItem requires a seeded random function');
  const roll=()=>{
    const value=rng();
    if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('Loot random values must be in [0, 1)');
    return value;
  };
  const itemId=typeof id==='string'&&ID.test(id)?id:`loot-${Math.floor(roll()*0x100000000).toString(16).padStart(8,'0')}-${Math.floor(roll()*0x100000000).toString(16).padStart(8,'0')}`;
  const available=Object.fromEntries(SLOTS.map(slot=>[slot,ITEM_VARIANTS[slot].filter(icon=>canEquip({icon},hero))]));
  const slots=SLOTS.filter(slot=>available[slot].length),rolledSlot=slots[Math.floor(roll()*slots.length)],slot=slots.includes(forcedSlot)?forcedSlot:rolledSlot,rarityRoll=roll(),find=Math.max(0,Math.min(10,Number.isFinite(magicFind)?magicFind:0));
  const uniqueChance=Math.min(.08,(boss?.025:.004)*(1+find*.4));
  const rarity=rarityRoll>=1-uniqueChance?'unique':boss?(rarityRoll<.75/(1+find*.5)?'magic':'rare'):(rarityRoll<.6/(1+find)?'common':rarityRoll<1-Math.min(.5,.1*(1+find*.8))?'magic':'rare');
  const power=Number.isFinite(statMultiplier)?Math.max(.1,Math.min(3,statMultiplier)):1;
  const rank=RARITIES.indexOf(rarity),scale=(1+(Math.max(1,Math.min(99,Number.isFinite(level)?Math.floor(level):1))-1)*.09)*[1,1.5,2.1,2.4][rank]*power;
  // Independent rolls create real tradeoffs, with occasional exceptional stats.
  // Square the roll to make the upper end less common: 0.3x to almost 3x.
  const variants=available[slot];let icon=variants[Math.floor(roll()*variants.length)];
  const family=itemFamily(icon,slot,ITEM_CATALOG),affixes=rollAffixes(family,rarity,roll);
  if(rarity==='unique'&&UNIQUES[family].icon&&variants.includes(UNIQUES[family].icon))icon=UNIQUES[family].icon;
  const statRoll=(key,value)=>key.startsWith('skill:')?Math.min(3,Math.max(1,Math.floor(value)||1)):Math.min(LIMITS[key],Math.max(.001,round(value*scale*(.3+2.7*roll()**2))));
  const stats=Object.fromEntries(Object.entries(BASE_STATS[family]).map(([key,value])=>[key,statRoll(key,value)]));
  for(const a of affixes)for(const key of a.keys){const value=key.startsWith('skill:')?1+Math.floor(roll()*3):STAT_DEFINITIONS[key].base;stats[key]=Math.min(LIMITS[key],round((stats[key]||0)+statRoll(key,value)));}
  if(rarity==='unique')for(const [key,value] of Object.entries(UNIQUES[family].stats))stats[key]=Math.min(LIMITS[key],round((stats[key]||0)+statRoll(key,value)));
  if(stats.minDamage&&stats.maxDamage)stats.maxDamage=Math.max(stats.minDamage,stats.maxDamage);
  for(const key of Object.keys(stats))stats[key]=balancedBonus(key,stats[key]);
  const prefix=affixes.find(a=>a.kind==='prefix')?.name,suffix=affixes.find(a=>a.kind==='suffix')?.name;
  const name=rarity==='unique'?UNIQUES[family].name:rarity==='rare'?`Sovereign ${ITEM_CATALOG[icon].name}`:[prefix,ITEM_CATALOG[icon].name,suffix].filter(Boolean).join(' ');
  return {id:itemId,name:name.slice(0,100),slot,rarity,stats,icon,balanceVersion:ITEM_BALANCE_VERSION,affixes:affixes.map(a=>a.id),...(rarity==='unique'?{uniqueId:family}:{})};
}

export function equipmentStats(equipment,hero=null) {
  const totals=Object.fromEntries(Object.keys(STAT_LABELS).map(key=>[key,0]));
  const seen=new Set();
  if(!plain(equipment))return totals;
  for(const slot of SLOTS){
    if(!own(equipment,slot))continue;
    const item=readItem(equipment[slot]);
    if(!item||item.slot!==slot||seen.has(item.id)||!canEquip(item,hero))continue;
    seen.add(item.id);
    for(const [key,value] of Object.entries(item.stats))totals[key]=round(totals[key]+value);
  }
  return totals;
}

export function sanitizeInventory(raw) {
  const result={bag:[],equipment:emptyEquipment(),positions:Object.create(null)},seen=new Set();
  if(!plain(raw))return result;
  // Equipped objects take precedence if a malformed save repeats an ID.
  if(plain(raw.equipment))for(const slot of SLOTS){
    if(!own(raw.equipment,slot))continue;
    const item=readItem(raw.equipment[slot]);
    if(!item||item.slot!==slot||seen.has(item.id))continue;
    result.equipment[slot]=item;seen.add(item.id);
  }
  if(Array.isArray(raw.bag))for(const entry of raw.bag.slice(0,1000)){
    if(result.bag.length>=CAPACITY)break;
    const item=readItem(entry);
    if(item&&!seen.has(item.id)){result.bag.push(item);seen.add(item.id);}
  }
  const occupied=new Set();
  for(const item of result.bag){const requested=plain(raw.positions)&&own(raw.positions,item.id)?raw.positions[item.id]:null;
    if(Number.isInteger(requested)&&requested>=0&&requested<CAPACITY&&!occupied.has(requested)){result.positions[item.id]=requested;occupied.add(requested);}}
  for(const item of result.bag)if(!own(result.positions,item.id)){let index=0;while(occupied.has(index))index++;result.positions[item.id]=index;occupied.add(index);}
  return result;
}

export class Inventory {
  constructor(saved={},hero=null) {
    this.hero=hero;
    const state=sanitizeInventory(saved);this.bag=state.bag;this.equipment=state.equipment;this.positions=state.positions;
  }
  bagAt(index){return this.bag.find(item=>this.positions[item.id]===index)||null;}
  firstEmpty(){for(let index=0;index<CAPACITY;index++)if(!this.bagAt(index))return index;return -1;}
  add(raw) {
    if(this.bag.length>=CAPACITY)return false;
    const item=readItem(raw);
    if(!item||this.bag.some(entry=>entry.id===item.id)||Object.values(this.equipment).some(entry=>entry?.id===item.id))return false;
    this.positions[item.id]=this.firstEmpty();this.bag.push(item);return true;
  }
  autoEquip(){
    const plan=autoEquipment(this.bag,this.equipment,this.hero);
    const state=sanitizeInventory({...plan,positions:this.positions});Object.assign(this,state);
    return plan.equipped;
  }
  pickup(raw,{autoEquip=false}={}){
    const item=readItem(raw),equipped=Object.values(this.equipment).filter(Boolean);
    if(!item||[...this.bag,...equipped].some(entry=>entry.id===item.id))return {ok:false,gold:0,sold:[]};
    const plan=autoEquip?autoEquipment([...this.bag,item],this.equipment,this.hero):{bag:[...this.bag,item],equipment:this.equipment,equipped:[]};
    const sold=inferiorItems(plan.bag,Object.values(plan.equipment).filter(Boolean));
    const survivors=plan.bag.filter(entry=>!sold.includes(entry));
    if(survivors.length>CAPACITY)return {ok:false,gold:0,sold:[]};
    Object.assign(this,sanitizeInventory({bag:survivors,equipment:plan.equipment,positions:this.positions}));
    return {ok:true,gold:sold.reduce((sum,entry)=>sum+sellPrice(entry),0),sold,kept:!sold.some(entry=>entry.id===item.id),equipped:plan.equipped};
  }
  autoSell(){
    const sold=inferiorItems(this.bag,Object.values(this.equipment).filter(Boolean));
    const gold=sold.reduce((sum,item)=>sum+this.sell(item.id),0);
    return {sold,gold};
  }
  equip(id) {
    const index=this.bag.findIndex(item=>item.id===id);
    if(index<0||!canEquip(this.bag[index],this.hero))return false;
    const item=this.bag[index],previous=this.equipment[item.slot],position=this.positions[item.id];
    this.bag.splice(index,1);this.equipment[item.slot]=item;delete this.positions[item.id];
    if(previous){this.bag.push(previous);this.positions[previous.id]=position;}
    return true;
  }
  unequip(slot,bagIndex=this.firstEmpty()) {
    if(!SLOTS.includes(slot)||!this.equipment[slot]||this.bag.length>=CAPACITY)return false;
    if(!Number.isInteger(bagIndex)||bagIndex<0||bagIndex>=CAPACITY||this.bagAt(bagIndex))return false;
    const item=this.equipment[slot];this.positions[item.id]=bagIndex;this.bag.push(item);this.equipment[slot]=null;return true;
  }
  move(id,target){
    if(!plain(target))return false;
    const item=this.bag.find(entry=>entry.id===id),equipped=Object.values(this.equipment).find(entry=>entry?.id===id);
    if(!item&&!equipped)return false;
    if(own(target,'slot')){if(!SLOTS.includes(target.slot)||!item||item.slot!==target.slot)return false;return this.equip(id);}
    const index=target.bagIndex;if(!Number.isInteger(index)||index<0||index>=CAPACITY)return false;
    const other=this.bagAt(index);
    if(item){const oldPosition=this.positions[id];if(oldPosition===index)return false;this.positions[id]=index;if(other)this.positions[other.id]=oldPosition;return true;}
    if(other){if(other.slot!==equipped.slot)return false;return this.equip(other.id);}
    return this.unequip(equipped.slot,index);
  }
  discard(id) {
    const index=this.bag.findIndex(item=>item.id===id);
    if(index<0)return false;
    this.bag.splice(index,1);delete this.positions[id];return true;
  }
  sell(id){const item=this.bag.find(entry=>entry.id===id);if(!item)return 0;const price=sellPrice(item);return this.discard(id)?price:0;}
  snapshot() {return sanitizeInventory({bag:this.bag,equipment:this.equipment,positions:this.positions});}
}
