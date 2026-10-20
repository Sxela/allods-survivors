import {applyGift} from './knowledge.mjs';
import {inspectSpell,SPELL_VALUE_LABELS,SPELL_VALUE_UNITS} from './inspection.mjs';
import {SPELLS,SELF_BUFFS} from './original-spells.mjs';
import {currentStats,formatValue} from './build-stats.mjs';
// Clone only the build boundary. Inventory is read-only; combat objects/RNG are never stepped.
export function previewBuild(world){
 const clone=Object.assign(Object.create(Object.getPrototypeOf(world)),world);
 for(const key of ['player','baseStats','classBases','statSources','skills','localBonuses','behaviors','individualPurchases','milestones','cooldowns','cooldownDurations','cooldownWaiting'])clone[key]=structuredClone(world[key]??{});
 return clone;
}
export function offerPreview(world,choice,replaceId=null){
 if(choice.type==='keep')return {summary:'Keep all current spells and improvements.',lines:[]};
 const after=previewBuild(world);let valid=true;
 if(['skill','passive'].includes(choice.type))valid=applyGift(after,choice);
 else if(choice.type==='behavior')(after.behaviors[choice.id]??=[]).push(choice.mode);
 else if(['learn','replace'].includes(choice.type)){if(replaceId){delete after.skills[replaceId];for(const key of ['localBonuses','behaviors','individualPurchases','cooldowns'])delete after[key][replaceId];delete after.player.statuses[replaceId];}after.skills[choice.id]=1;}
 if(!valid)return {summary:'This offer no longer improves the current build.',lines:[]};
 const lines=[],beforeStats=currentStats(world),afterStats=currentStats(after);
 for(const row of afterStats){const before=beforeStats.find(r=>r.id===row.id);if(before&&Math.abs(row.value-before.value)>1e-8)lines.push({label:row.label,before:before.value,after:row.value,unit:row.unit});}
 const ids=new Set([...world.castingSkills().map(s=>s.id),...after.castingSkills().map(s=>s.id),...(SPELLS[choice.id]?[choice.id]:[])]);
 for(const id of ids){
  const before=inspectSpell(world,id),next=inspectSpell(after,id,after.skills[id]?{rank:after.skills[id],source:'learned'}:null);
  if(!next){if(before){lines.push({label:SPELLS[id].name,before:'Casting',after:'Removed; individual improvements reset'});if(before.dps)lines.push({label:SPELLS[id].name+' - '+before.dps.label,before:before.dps.value,after:0,unit:'DPS',note:before.dps.note});}continue;}
  const always=id===choice.id&&['learn','replace'].includes(choice.type);
  for(const [key,label,unit] of [['learnedRank','Learned rank','ranks'],['effectiveRank','Effective rank','ranks'],['interval','Cooldown','seconds'],['stanceMovement','Movement while ward is active','fraction']])if((key!=='stanceMovement'||SELF_BUFFS.has(id)&&(choice.type==='behavior'||next[key]!==1||before?.[key]!==1))&&(key!=='learnedRank'||next.gearRank||next.schoolRank)&&(always||before&&Math.abs(next[key]-before[key])>1e-8))lines.push({label:SPELLS[id].name+' - '+label,before:before?.[key]??0,after:next[key],unit});
  if(next.dps&&(always||!before?.dps||Math.abs(next.dps.value-before.dps.value)>1e-8||Math.abs(next.values.damage-before.values.damage)>1e-8||Math.abs(next.interval-before.interval)>1e-8))lines.push({label:SPELLS[id].name+' - '+next.dps.label,before:before?.dps?.value??0,after:next.dps.value,unit:'DPS',note:next.dps.note});
  for(const [key,value] of Object.entries(next.values))if(typeof value==='number'&&(always||before&&Math.abs(value-(before.values[key]||0))>1e-8))lines.push({label:SPELLS[id].name+' - '+(SPELL_VALUE_LABELS[key]||key),before:before?.values[key]??0,after:value,unit:SPELL_VALUE_UNITS[key]||'points'});
 }
 let summary='';
 if(choice.type==='passive'){
  if(choice.stat==='maxHp')summary='Maximum HP only; does not heal.';
  else if(choice.stat==='speed')summary=`+${(choice.amount/world.classBases.speed*100).toFixed(1)}% of class base ${world.classBases.speed.toFixed(1)} px/s.`;
  else if(choice.stat==='magicFind')summary='Improves quality, not drop frequency.';
 }else if(choice.type==='skill'&&choice.skillStat)summary=`Individual ${choice.skillStat==='ward'?'ward potency':'cast speed'} +${(choice.amount*100).toFixed(1)}%.`;
 else if(choice.type==='behavior')summary=choice.description;
 else if(['learn','replace'].includes(choice.type))summary=SPELLS[choice.id]?.description||'';
 return {summary,lines};
}
