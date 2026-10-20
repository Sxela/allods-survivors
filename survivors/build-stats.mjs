import {equipmentStats} from './loot.mjs';
import {attributeContributions} from './equipment-combat.mjs';
import {movementMultiplier,resistance} from './original-spells.mjs';
import {STAT_DEFINITIONS} from './item-affixes.mjs';
export function formatValue(value,unit='points'){
 if(unit==='fraction')return `${(value*100).toFixed(1)}%`;
 if(unit==='HP/s')return `${value.toFixed(2)} HP/s`;
 if(unit==='seconds')return `${value.toFixed(2)} s`;
 return `${value.toFixed(1)}${unit==='points'?'':` ${unit}`}`;
}
export function currentStats(world){
 const p=world.player,items=equipmentStats(world.inventory.equipment,world.hero),derived=attributeContributions(world),ledger=world.statSources||{},rows=[];
 const add=(id,label,unit,value=p[id]||0)=>{
  const base=world.classBases[id]||0,level=ledger.level?.[id]||0,camp=ledger.camp?.[id]||0,earlier=(world.baseStats[id]||0)-base-level-camp;
  const sources={Class:base,Items:items[id]||0,Attributes:derived[id]||0,'Level upgrades':level,'Camp upgrades':camp,'Earlier improvements':earlier};
  let formula='Add the listed contributions.';
  if(id==='speed'){sources['Active effects']=(p.speed||0)*(movementMultiplier(p)-1);value=p.speed*movementMultiplier(p);formula='(Class + items + attributes + improvements) * active movement effects.';}
  rows.push({id,label,unit,value,base,sources,formula});
 };
 for(const [id,label,unit] of [['maxHp','Maximum health','HP'],['speed','Movement speed','px/s'],['regen','Health regeneration','HP/s'],['magnet','Pickup radius','world units'],['damage','All damage (% of base)','fraction'],['spellDamage','Additional spell damage','fraction'],['haste','Cast rate (% of base)','fraction'],['attackSpeed','Additional weapon attack speed','fraction'],['armor','Physical absorption','HP/hit'],['attack','Attack rating','points'],['defense','Defense rating','points'],['minDamage','Added minimum weapon damage','HP'],['maxDamage','Added maximum weapon damage','HP'],['range','Additional weapon reach','world units'],['sight','Additional spell range','world units'],['magicFind','Magic Find (build / upgrades)','fraction'],['goldFind','Gold Find','fraction'],['body','Body','points'],['agility','Agility','points'],['mind','Mind','points']])add(id,label,unit);
 rows.push({id:'equipmentFind',label:'Equipment Magic Find (quality only)',unit:'fraction',value:p.magicFind+world.rules.magicFind,sources:{Build:p.magicFind,Difficulty:world.rules.magicFind},formula:'Build Magic Find + difficulty rarity bonus. Does not increase item drop frequency.'});
 rows.push({id:'goldPayout',label:'Gold payout (% of base)',unit:'fraction',operator:'multiply',value:(1+p.goldFind)*world.rules.gold,sources:{'Build multiplier':1+p.goldFind,'Difficulty multiplier':world.rules.gold},formula:'Base gold * (1 + Gold Find) * difficulty, applied once; fractional gold is stochastically rounded.'});
 if(world.hero!=='mage'){
  const interval=world.hero==='warrior'?.75:1.1,reach=world.hero==='warrior'?(world.campaign?85:70):500;
  rows.push({id:'weaponInterval',label:'Automatic weapon attack interval',unit:'seconds',value:interval/(1+p.attackSpeed),sourceUnits:{'Attack-speed rate bonus':'fraction'},sources:{'Base interval':interval,'Attack-speed rate bonus':p.attackSpeed},formula:'Base interval / (1 + attack-speed bonus). Rate bonus is a fraction, not seconds.'});
  rows.push({id:'weaponReach',label:'Automatic weapon attack reach',unit:'world units',value:reach+(p.range||0),sources:{Class:reach,Items:p.range||0},formula:'Class reach + equipment reach.'});
 }
 rows.push({id:'spellTargetRange',label:'Default spell target acquisition range',unit:'world units',value:700+(p.sight||0),sources:{Class:700,Items:p.sight||0},formula:'Default targeting range; individual spell patterns can use a narrower area.'});
 for(const element of ['fire','water','air','earth','astral']){
  const ward=p.statuses?.[{fire:'protectFire',water:'protectWater',air:'protectAir',earth:'protectEarth'}[element]],gear=Math.min(.75,Math.max(0,p[`${element}Resist`]||0)),reduction=ward?.ttl>0?ward.reduction:0;
  rows.push({id:element+'Resist',label:element[0].toUpperCase()+element.slice(1)+' resistance',unit:'fraction',base:0,value:resistance(p,element),sources:{Class:0,Items:gear,'Active ward':reduction},operator:'layer',formula:'1 - (1 - item resistance, capped at 75%) * (1 - ward). Total cap 90%.'});
 }
 for(const [element,label] of [['physical','Physical'],['fire','Fire'],['water','Water'],['air','Air'],['earth','Earth'],['astral','Astral']])rows.push({id:element+'Damage',label:label+' damage (% of attack base)',unit:'fraction',value:p.damage*(element==='physical'?1:1+p.spellDamage),operator:'multiply',sources:{'All damage multiplier':p.damage,...(element==='physical'?{}:{'Spell multiplier':1+p.spellDamage})},formula:'Multiply the listed layers once. Weapon rolls / spell rank and target resistance are separate.'});
 rows.push({id:'evasion',label:'Physical evasion chance',unit:'fraction',value:Math.min(.6,p.defense/(p.defense+100)),sourceUnit:'points',sources:{'Defense rating':p.defense},formula:'Defense / (Defense + 100), capped at 60%.'});
 for(const id of Object.keys(STAT_DEFINITIONS).filter(id=>id.endsWith('Skill')||id.startsWith('skill:')))if(p[id])add(id,STAT_DEFINITIONS[id].label,id.startsWith('skill:')?'ranks':'points');
 return rows;
}
