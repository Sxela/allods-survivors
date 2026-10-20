import {SPELLS} from './original-spells.mjs';
import {spellValues} from './spell-values.mjs';
export function inspectSpell(world,id,override=null){
  const entry=override||world.castingSkills().find(s=>s.id===id);if(!entry)return null;
  const rank=world.effectiveRank(id,entry.rank),values=spellValues(id,rank),p=world.player;
  const info={id,name:SPELLS[id].name,description:SPELLS[id].description,source:entry.source,learnedRank:entry.rank,gearRank:p[`skill:${id}`]||0,schoolRank:Math.floor((p[`${SPELLS[id].element}Skill`]||0)/5),effectiveRank:rank,interval:world.spellInterval(id,entry.rank),values:{...values,...(values.allyDamage?{allyDamage:values.allyDamage*p.damage}:{}),...(values.damage?{damage:values.damage*p.damage*(1+p.spellDamage)}:{})},stanceMovement:world.spellModifiers(id).movement,rankMultiplier:world.spellModifiers(id).rank,tempoMultiplier:world.spellModifiers(id).tempo,wardBonus:world.localBonuses[id]?.ward||0,tempoBonus:world.localBonuses[id]?.tempo||0,damageMultiplier:p.damage,spellDamage:p.spellDamage,purchases:world.individualPurchases[id]||0,behaviors:world.behaviors[id]||[]};
  info.dps=spellDpsEstimate(info);return info;
}
// Sustained, per-target potential at the live cast interval, before target defenses.
export function spellDpsEstimate(info){
  const {values,interval}=info;if(!(values.damage>0&&Number.isFinite(interval)&&interval>0))return null;
  const field=values.tick>0&&values.duration>0,ticks=field?Math.ceil(values.duration/values.tick-1e-9):1;
  return {value:values.damage*ticks/interval,label:field?'Est. field DPS / target':'Est. DPS / target',note:field?'Before resistance; assumes full-duration contact with every cast and overlapping fields.'+(info.id==='poison'?' Excludes lingering poison damage.':''):'Before resistance; assumes every cast hits one target.'};
}
export function spellSummary(info){
  if(!info)return '';
  const labels={damage:'damage before target resistance',radius:'radius (world units)',duration:'duration (seconds)',tick:'tick interval (seconds)',targets:'targets',healing:'healing',absorption:'shield pool',fraction:'shield absorption fraction',reduction:'resistance fraction',length:'wall length',movement:'movement multiplier',distance:'teleport distance',allyHp:'summon health',allyDamage:'summon maximum weapon damage',maxRollChance:'maximum weapon roll chance'};
  return `${info.source==='gear'?'Equipment autocast, not learned':'Learned rank '+info.learnedRank.toFixed(1)}; gear +${info.gearRank.toFixed(1)}, school +${info.schoolRank.toFixed(1)}. Effective rank ${info.effectiveRank.toFixed(1)}. Interval ${info.interval.toFixed(2)}s. ${info.dps?`${info.dps.label}: ${info.dps.value.toFixed(1)}. ${info.dps.note} `:''}${Object.entries(info.values).filter(([,v])=>typeof v==='number').map(([key,v])=>`${labels[key]||key}: ${v.toFixed(1)}`).join('; ')}. ${info.purchases} individual purchases. ${info.behaviors.length?info.behaviors.join(', '):'No behavior milestones.'}`;
}

export const SPELL_VALUE_LABELS={damage:'Damage per hit / tick',radius:'Radius',duration:'Duration',tick:'Tick interval',targets:'Targets',healing:'Healing',absorption:'Shield pool',fraction:'Incoming damage absorbed',reduction:'Resistance',length:'Wall length',movement:'Movement (% of base)',distance:'Teleport distance',allyHp:'Summon health',allyDamage:'Summon maximum weapon damage',maxRollChance:'Maximum weapon roll chance'};
export const SPELL_VALUE_UNITS={radius:'world units',duration:'seconds',tick:'seconds',targets:'targets',healing:'HP',absorption:'HP',fraction:'fraction',reduction:'fraction',length:'world units',movement:'fraction',distance:'world units',allyHp:'HP',allyDamage:'HP',maxRollChance:'fraction',damage:'HP'};
