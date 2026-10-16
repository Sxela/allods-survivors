// Standalone combat formulas: original attribute names, survival-scale values.
import {ITEM_CATALOG} from './item-catalog.mjs';
import {weaponSchool} from './item-affixes.mjs';
export const MANA_COSTS={bolt:2,ice:2,stone:3,fireball:6,firewall:6,frost:6,poison:5,lightning:5,prismatic:8,heal:6,drain:5,summon:8,animate:7,teleport:5};
export function applyEquipment(world,stats){
  const p=world.player;
  for(const [key,value] of Object.entries(stats))if(!Object.hasOwn(world.baseStats,key))p[key]=value;
  for(const key of Object.keys(world.baseStats))p[key]=world.baseStats[key]+(stats[key]||0);
  p.maxHp+=(p.body||0)*5;p.speed+=(p.agility||0)*.2;p.attack+=(p.agility||0)*2+(p.body||0)*.5;p.defense+=(p.agility||0)*2;
  p.maxMana+=(p.spirit||0)*4;p.manaRegen+=(p.spirit||0)*.06;p.spellDamage+=(p.mind||0)*.015;
  for(const e of ['fire','water','air','earth'])p[`${e}Resist`]=Math.min(.75,(p[`${e}Resist`]||0)+(p.spirit||0)*.0015);
  const weapon=world.inventory.equipment.weapon,name=weapon&&ITEM_CATALOG[weapon.icon]?.name;
  p.weaponSkill=p[`${weaponSchool(name|| (world.hero==='ranger'?'bow':''))}Skill`]||0;p.attack+=p.weaponSkill*3;
  p.hp=Math.min(p.hp,p.maxHp);p.mana=Math.min(p.mana??p.maxMana,p.maxMana);
}
export function effectiveSpellRank(world,id,rank,element){return Math.min(30,Math.max(1,rank+(world.player[`skill:${id}`]||0)+Math.floor((world.player[`${element}Skill`]||0)/5)));}
export function hitChance(attack,defense){return Math.max(.25,Math.min(.98,(80+attack)/(100+defense)));}
