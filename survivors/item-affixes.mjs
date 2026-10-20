import {SPELLS} from './original-spells.mjs';
const stat=(label,limit,base,percent=false)=>({label,limit,base,percent});
export const STAT_DEFINITIONS={
  damage:stat('Damage',20,.025,true),maxHp:stat('Maximum health',5000,9),armor:stat('Absorption',100,.7),speed:stat('Movement speed',300,3),haste:stat('Cast speed',10,.025,true),magnet:stat('Pickup radius',2000,10),regen:stat('Health per second',50,.15),magicFind:stat('Magic Find',10,.06,true),goldFind:stat('Gold Find',10,.1,true),
  body:stat('Body',100,2),agility:stat('Agility',100,2),mind:stat('Mind',100,2),attack:stat('Attack rating',500,6),defense:stat('Defense rating',500,6),minDamage:stat('Minimum weapon damage',500,2),maxDamage:stat('Maximum weapon damage',1000,4),attackSpeed:stat('Attack speed',5,.035,true),range:stat('Attack range',500,12),sight:stat('Sight range',1000,30),spellDamage:stat('Spell damage',10,.04,true),
  ...Object.fromEntries(['fire','water','air','earth'].map(e=>[`${e}Resist`,stat(`${e[0].toUpperCase()+e.slice(1)} resistance`,.75,.06,true)])),
  ...Object.fromEntries(['blade','axe','bludgeon','pike','shooting','fire','water','air','earth','astral'].map(e=>[`${e}Skill`,stat(`${e[0].toUpperCase()+e.slice(1)} skill`,100,3)])),
  ...Object.fromEntries(Object.entries(SPELLS).map(([id,spell])=>[`skill:${id}`,stat(`${spell.name} levels`,3,1)])),
};
export const STAT_LABELS=Object.freeze(Object.fromEntries(Object.entries(STAT_DEFINITIONS).map(([key,s])=>[key,s.label])));
export const STAT_LIMITS=Object.freeze(Object.fromEntries(Object.entries(STAT_DEFINITIONS).map(([key,s])=>[key,s.limit])));
export function itemFamily(icon,slot,catalog){
  if(slot!=='weapon')return slot;
  const item=catalog[icon];if(item?.classes?.length===1&&item.classes[0]==='mage')return 'staff';
  return /bow/i.test(item?.name||'')?'bow':'melee';
}
export function weaponSchool(name=''){return /bow/i.test(name)?'shooting':/axe/i.test(name)?'axe':/pike|spear|lance|halberd/i.test(name)?'pike':/club|mace|hammer|morning|cudgel/i.test(name)?'bludgeon':'blade';}
const armor=['armor','helm','boots','shield','bracers','gloves'],jewelry=['ring','amulet'],weapons=['melee','bow'],casters=['staff','helm','amulet','ring'];
const affix=(id,name,kind,keys,types,group=id)=>({id,name,kind,keys,types,group});
export const AFFIXES=[
  affix('guard','Guarding','prefix',['defense','armor'],armor),affix('life','Vital','prefix',['maxHp','body'],armor),
  affix('fireWard','Emberward','prefix',['fireResist'],[...armor,...jewelry]),affix('waterWard','Frostward','prefix',['waterResist'],[...armor,...jewelry]),affix('airWard','Stormward','prefix',['airResist'],[...armor,...jewelry]),affix('earthWard','Stoneward','prefix',['earthResist'],[...armor,...jewelry]),
  affix('precision','Precise','prefix',['attack','agility'],weapons),affix('power','Cruel','prefix',['minDamage','maxDamage'],weapons),
  affix('sorcery','Arcane','prefix',['spellDamage','mind'],['staff']),
  ...['fire','water','air','earth','astral'].map(e=>affix(`${e}Lore`,`${e[0].toUpperCase()+e.slice(1)} adept's`,'prefix',[`${e}Skill`],['staff','amulet','helm'],'schoolLore')),
  ...Object.entries(SPELLS).map(([id,spell])=>affix(`spell-${id}`,`of ${spell.name}`,'suffix',[`skill:${id}`],['staff','amulet','helm'],'spellLevels')),
  affix('wealth','of Wealth','suffix',['goldFind'],[...jewelry,'boots']),affix('fortune','of Fortune','suffix',['magicFind'],jewelry),
  affix('casting','of Quickening','suffix',['haste'],['staff','gloves','amulet','ring']),affix('recovery','of Renewal','suffix',['regen'],armor),
  affix('running','of the Wind','suffix',['speed'],['boots']),affix('striking','of Alacrity','suffix',['attackSpeed'],[...weapons,'gloves']),affix('reach','of Reach','suffix',['range'],weapons),affix('vision','of the Seer','suffix',['sight'],['helm','amulet']),
  ...['blade','axe','bludgeon','pike','shooting'].map(e=>affix(`${e}Mastery`,`of ${e[0].toUpperCase()+e.slice(1)} Mastery`,'suffix',[`${e}Skill`],[...weapons,'gloves'],'weaponMastery')),
  affix('harvest','of Gathering','suffix',['magnet'],['boots','amulet']),
];
export const BASE_STATS={
  staff:{spellDamage:.06,haste:.035,},melee:{damage:.05,minDamage:2,maxDamage:5,attack:5},bow:{damage:.04,minDamage:1,maxDamage:4,range:25},
  armor:{maxHp:14,armor:1.5,defense:8},helm:{maxHp:18,defense:4},boots:{speed:6,goldFind:.06,defense:3},ring:{magicFind:.05,goldFind:.04},amulet:{magnet:16,magicFind:.06,goldFind:.08},shield:{armor:2,defense:12},bracers:{armor:1,defense:5},gloves:{attack:5,attackSpeed:.03},
};
// Original standalone uniques: fixed identity/property packages, variable numeric rolls.
export const UNIQUES={
  staff:{name:'Keeper of the Living Flame',icon:'gear-1301113',stats:{spellDamage:.15,haste:.12,fireResist:.15,'skill:firewall':3}},
  melee:{name:'Oath of the Fallen',stats:{minDamage:5,maxDamage:12,attack:15,attackSpeed:.12,fireResist:.12,magicFind:.15}},
  bow:{name:'Horizon Seeker',stats:{minDamage:3,maxDamage:9,range:60,shootingSkill:5,spellDamage:.1,magicFind:.15}},
  armor:{name:'Ward of the Last Allod',stats:{armor:4,defense:20,maxHp:40,fireResist:.15,waterResist:.15,'skill:shield':2}},
  helm:{name:'Crown of Echoes',stats:{mind:4,'skill:prismatic':3}},
  boots:{name:'Roads Beyond the Mist',stats:{speed:12,defense:8,goldFind:.25,magicFind:.2,haste:.08}},
  ring:{name:'Star of the Lost Treasury',stats:{magicFind:.3,goldFind:.4,airResist:.15,'skill:lightning':2}},
  amulet:{name:'Memory of the Five Spheres',stats:{magicFind:.2,goldFind:.25,fireSkill:3,waterSkill:3,airSkill:3,earthSkill:3,astralSkill:3}},
  shield:{name:'The Unbroken Promise',stats:{armor:5,defense:22,fireResist:.2,waterResist:.2,spellDamage:.12}},
  bracers:{name:'Keeper of Ancient Runes',stats:{armor:3,defense:12,mind:4,haste:.1,'skill:earthwall':2}},
  gloves:{name:'Hands of the Spellsmith',stats:{attack:12,attackSpeed:.12,haste:.12,spellDamage:.12,'skill:fireball':2}},
};
export function rollAffixes(family,rarity,roll){
  if(rarity==='common'||rarity==='unique')return [];
  let kinds;if(rarity==='magic'){const n=roll();kinds=n<.25?['prefix','suffix']:n<.5?['prefix']:['suffix'];}
  else {const count=2+Math.floor(roll()*5);kinds=Array.from({length:count},()=>roll()<.5?'prefix':'suffix');}
  const chosen=[],groups=new Set(),counts={prefix:0,suffix:0};
  for(let kind of kinds){if(counts[kind]>=3)kind=kind==='prefix'?'suffix':'prefix';
    const cross=rarity==='rare'&&roll()<.2;
    let pool=AFFIXES.filter(a=>a.kind===kind&&!groups.has(a.group)&&(cross||a.types.includes(family)));
    if(!pool.length)pool=AFFIXES.filter(a=>a.kind===kind&&!groups.has(a.group)&&a.types.includes(family));
    if(!pool.length&&rarity==='rare'){kind=kind==='prefix'?'suffix':'prefix';if(counts[kind]<3)pool=AFFIXES.filter(a=>a.kind===kind&&!groups.has(a.group)&&a.types.includes(family));}
    if(!pool.length)continue;const a=pool[Math.floor(roll()*pool.length)];chosen.push(a);groups.add(a.group);counts[kind]++;
  }
  return chosen;
}

// Active affix registry: source-only/unknown fields never enter generated gear.
const consumers={damage:'World.hurt: outgoing multiplier',maxHp:'World.player health cap',armor:'World.damagePlayer: flat physical absorption',speed:'World.step: movement',haste:'World.spellInterval: casts per second',magnet:'World.step: pickup attraction',regen:'World.heal: regeneration',magicFind:'makeItem and upgradeRarity: quality only',goldFind:'World.goldAmount: currency yield',body:'applyEquipment / physicalRoll: health, attack and weapon damage',agility:'applyEquipment: speed, attack and defense',mind:'applyEquipment / World.addXp: spell damage and XP',attack:'World.hurt: physical hit chance',defense:'World.damagePlayer: evade chance',minDamage:'physicalRoll: minimum weapon hit',maxDamage:'physicalRoll: maximum weapon hit',attackSpeed:'World.step: weapon interval',range:'World.step: weapon reach',sight:'World.nearest and castOriginal: target range',spellDamage:'World.hurt: elemental/astral multiplier'};
for(const [id,definition] of Object.entries(STAT_DEFINITIONS)){
  definition.unit=definition.percent?'fraction':id.startsWith('skill:')?'spell ranks':'points';definition.baseline=0;definition.stacking='additive bonus pool; elemental protection is a separate bounded layer';definition.consumer=consumers[id]||(id.endsWith('Resist')?'resistance: incoming elemental mitigation and status duration':id.startsWith('skill:')?'castingPool / effectiveSpellRank: equipment autocast, not learning':id.endsWith('Skill')?'applyEquipment / effectiveSpellRank / physicalRoll: equipped weapon or spell school mastery':null);
  definition.families=Object.keys(BASE_STATS).filter(family=>id in BASE_STATS[family]||id in UNIQUES[family].stats||AFFIXES.some(a=>a.keys.includes(id)&&a.types.includes(family)));
  if(!definition.consumer)throw Error(`Unmapped active stat: ${id}`);
}
