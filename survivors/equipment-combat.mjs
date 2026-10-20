// Standalone combat formulas: original attribute names, survival-scale values.
import {ITEM_CATALOG} from './item-catalog.mjs';
import {weaponSchool} from './item-affixes.mjs';
export function applyEquipment(world,stats){
  const p=world.player;
  for(const [key,value] of Object.entries(stats))if(!Object.hasOwn(world.baseStats,key))p[key]=value;
  for(const key of Object.keys(world.baseStats))p[key]=world.baseStats[key]+(stats[key]||0);
  const {weaponSkill,...derived}=attributeContributions(world);p.weaponSkill=weaponSkill;for(const [key,value] of Object.entries(derived))p[key]+=value;
  p.hp=Math.min(p.hp,p.maxHp);
}
export function effectiveSpellRank(world,id,rank,element){return Math.min(30,Math.max(1,rank+(world.player[`skill:${id}`]||0)+Math.floor((world.player[`${element}Skill`]||0)/5)));}
export function hitChance(attack,defense){return Math.max(.25,Math.min(.98,(80+attack)/(100+defense)));}

export function attributeContributions(world){
 const p=world.player,weapon=world.inventory.equipment.weapon,name=weapon&&ITEM_CATALOG[weapon.icon]?.name;
 const weaponSkill=p[`${weaponSchool(name||(world.hero==='ranger'?'bow':''))}Skill`]||0;
 return {weaponSkill,maxHp:(p.body||0)*5,speed:(p.agility||0)*.2,attack:(p.agility||0)*2+(p.body||0)*.5+weaponSkill*3,defense:(p.agility||0)*2,spellDamage:(p.mind||0)*.015};
}
