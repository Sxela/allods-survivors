import {SPELLS,SELF_BUFFS} from './original-spells.mjs';
export const SPELL_CAPS=Object.freeze({offense:5,defense:3});
export function spellGroup(id){return SELF_BUFFS.has(id)||['heal','teleport','earthwall'].includes(id)?'defense':'offense';}
export function learnedCount(skills,group){return Object.keys(skills||{}).filter(id=>SPELLS[id]&&spellGroup(id)===group).length;}
export function canLearn(skills,id){return !!SPELLS[id]&&(!!skills?.[id]||learnedCount(skills,spellGroup(id))<SPELL_CAPS[spellGroup(id)]);}
export function replacementIds(skills,id){return Object.keys(skills||{}).filter(old=>SPELLS[old]&&spellGroup(old)===spellGroup(id));}
export function castingPool(skills,player){
  const pool=[],counts={offense:0,defense:0},seen=new Set();
  const add=(id,rank,source)=>{if(!SPELLS[id]||seen.has(id))return;const group=spellGroup(id);if(counts[group]>=SPELL_CAPS[group])return;counts[group]++;seen.add(id);pool.push({id,rank,source,group});};
  for(const [id,rank] of Object.entries(skills||{}))if(rank>0)add(id,rank,'learned');
  for(const id of Object.keys(SPELLS))if((player?.[`skill:${id}`]||0)>0)add(id,0,'gear');
  return pool.sort((a,b)=>spellGroup(a.id).localeCompare(spellGroup(b.id))||0);
}
