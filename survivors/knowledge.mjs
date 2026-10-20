import {SPELLS,SELF_BUFFS} from './original-spells.mjs';
import {canLearn,replacementIds} from './spell-loadout.mjs';

export const LEARN_EVERY=5,MILESTONE_EVERY=5;
export const UPGRADE_RARITIES=Object.freeze([
  {id:'common',name:'Common',bonus:1,price:16,color:'#d9d0b8'},
  {id:'uncommon',name:'Uncommon',bonus:1.25,price:22,color:'#a6cd8b'},
  {id:'rare',name:'Rare',bonus:1.5,price:30,color:'#9bc4fb'},
  {id:'epic',name:'Epic',bonus:2,price:44,color:'#ce9ee9'},
  {id:'legendary',name:'Legendary',bonus:3,price:64,color:'#f2cb72'},
]);
// Shared by camp, equipment trading and save migration; unrelated to sale value.
export function shopPriceScale(world){
 if(!world?.campaign)return 1;
 const progress=Math.min(1,Math.max(0,world.campaign.index)/Math.max(1,world.campaign.route.length-1));
 return ({easy:1,normal:1.5,hard:3}[world.difficulty]||1)*(1+progress*.5);
}
export function campPrice(world,rarity){const base=UPGRADE_RARITIES.find(r=>r.id===rarity)?.price;return base?Math.ceil(base*shopPriceScale(world)):null;}
export function repriceCamp(world){for(const c of world.campaign?.shopOffers||[])c.price=campPrice(world,c.rarity);}
export function upgradeRarity(rng,luck=0){
  const n=rng(),boost=1+Math.min(5,Math.max(0,luck))*.35;
  return UPGRADE_RARITIES[n>1-.02*boost?4:n>1-.07*boost?3:n>1-.20*boost?2:n>1-.45*boost?1:0];
}
const shuffle=(entries,rng)=>{const result=[...entries];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
export function passivePool(world){
  const p=world.player,b=world.baseStats,c=world.classBases;
  return [
    ['power','Arcane force','damage',.10,'+10% base damage',b.damage<c.damage+2],
    ['haste','Quickening','haste',.08,'+8% base cast speed',b.haste<3],
    ['vitality','Heart of the allod','maxHp',10,'+10 maximum health',b.maxHp<c.maxHp+150],
    ['speed','Wayfarer','speed',c.speed*.05,'+5% base movement speed',b.speed<c.speed*1.6],
    ['magnet','Soul harvest','magnet',18,'+18 collection range',b.magnet<300],
    ['regen','Renewal','regen',.15,'+0.15 health per second',b.regen<2],
    ['fortune','Fortune','magicFind',.1,'+10% Magic Find; equipment and upgrade quality',p.magicFind<5],
  ].filter(row=>row[5]).map(([id,name,stat,amount,description])=>({id,name,stat,amount,description,type:'passive'}));
}
export function ordinaryPool(world){
  const spells=Object.entries(world.skills).flatMap(([id,rank])=>{if(rank<8)return [{id,name:SPELLS[id].name,type:'skill',rank:Math.min(8,rank+1)}];const skillStat=SELF_BUFFS.has(id)?'ward':'tempo';if(skillStat==='tempo'&&world.spellInterval(id,rank)<=SPELLS[id].cooldown*.2+1e-9)return [];const remaining=.5-(world.localBonuses[id]?.[skillStat]||0);return remaining>1e-8?[{id,name:SPELLS[id].name,type:'skill',skillStat,amount:Math.min(.05,remaining)}]:[];});
  return {spells,passives:passivePool(world)};
}
function decorate(world,choice){
  const rarity=upgradeRarity(world.rng,world.player.magicFind);const result={...choice,rarity:rarity.id,color:rarity.color,price:rarity.price};
  if(choice.type==='skill'&&choice.skillStat){result.amount=Math.min(.5-(world.localBonuses[choice.id]?.[choice.skillStat]||0),choice.amount*rarity.bonus);result.description=`+${(result.amount*100).toFixed(1)}% ${choice.skillStat==='ward'?'effective ward rank':'individual cast speed'}. Learned rank is capped; this remains a meaningful individual improvement.`;}
  else if(choice.type==='skill'){result.rank=Math.min(8,world.skills[choice.id]+rarity.bonus);result.description=`Effective base rank ${world.skills[choice.id].toFixed(1)} to ${result.rank.toFixed(1)}. Improves the spell's native rank scaling.`;}
  else {result.amount=choice.amount*rarity.bonus;result.description=`${choice.stat==='damage'||choice.stat==='haste'||choice.stat==='magicFind'?`+${(result.amount*100).toFixed(1)}%`:`+${result.amount.toFixed(1)}`} ${choice.stat==='speed'?'movement speed (additive against class base)':choice.name.toLowerCase()}.`;}
  return result;
}
export function ordinaryOffers(world,count=3){
  const {spells,passives}=ordinaryPool(world),a=shuffle(spells,world.rng),b=shuffle(passives,world.rng),pool=[];
  // Sampling by family guarantees a hero alternative when useful, even with many spells.
  if(a.length)pool.push(a.shift());if(b.length)pool.push(b.shift());pool.push(...shuffle([...a,...b],world.rng));
  return pool.slice(0,count).map(c=>decorate(world,c));
}
export function learningOffers(world){
  const ids=shuffle(Object.keys(SPELLS).filter(id=>!world.skills[id]),world.rng);
  const choices=ids.filter(id=>canLearn(world.skills,id)||replacementIds(world.skills,id).length).slice(0,3).map(id=>({id,type:canLearn(world.skills,id)?'learn':'replace',rank:1,name:SPELLS[id].name,description:SPELLS[id].description}));
  choices.push({id:'keep',type:'keep',name:'Keep current spells',description:'Continue with your current build.'});return choices;
}
export function milestoneOffers(world,id){
  const buff=SELF_BUFFS.has(id);
  return buff?[
    {id,type:'behavior',mode:'focus',name:'Greater ward',description:'+20% effective rank; -10% movement while active.'},
    {id,type:'behavior',mode:'mobile',name:'Mobile ward',description:'+12% movement while active; -10% effective rank.'},
  ]:[
    {id,type:'behavior',mode:'quick',name:'Quick invocation',description:'+25% cast speed; -15% effective rank.'},
    {id,type:'behavior',mode:'focus',name:'Focused invocation',description:'+30% effective rank; -15% cast speed.'},
  ];
}
export function applyGift(world,choice,source='level'){
  if(choice.type==='skill'){
    if(!world.skills[choice.id])return false;
    if(choice.skillStat){const key=SELF_BUFFS.has(choice.id)?'ward':'tempo',bonuses=world.localBonuses[choice.id]||{};if(choice.skillStat!==key||world.skills[choice.id]<8||!Number.isFinite(choice.amount)||choice.amount<=0||choice.amount>.15+1e-9||(bonuses[key]||0)>=.5-1e-8)return false;world.localBonuses[choice.id]={...bonuses,[key]:Math.min(.5,(bonuses[key]||0)+choice.amount)};}
    else{if(!Number.isFinite(choice.rank)||choice.rank<=world.skills[choice.id]||choice.rank>8)return false;world.skills[choice.id]=choice.rank;}
    const n=world.individualPurchases[choice.id]=(world.individualPurchases[choice.id]||0)+1;
    if(n%MILESTONE_EVERY===0&&!(world.behaviors[choice.id]?.length>=2))world.milestones.push(choice.id);
  }else if(choice.type==='passive'){
    const valid=passivePool(world).find(c=>c.id===choice.id);if(!valid||choice.stat!==valid.stat||!Number.isFinite(choice.amount)||choice.amount<=0||choice.amount>valid.amount*3)return false;
    world.baseStats[choice.stat]+=choice.amount;const ledger=(world.statSources??={level:{},camp:{}})[source]??={};ledger[choice.stat]=(ledger[choice.stat]||0)+choice.amount;world.refreshEquipment();
  }else return false;
  return true;
}
export function nextReward(world){
  if(world.milestones.length){world.rewardKind='behavior';world.choices=milestoneOffers(world,world.milestones[0]);}
  else if(world.learningQueue.length){world.rewardKind='learning';world.choices=learningOffers(world);}
  else if(world.pendingLevels>0){world.rewardKind='ordinary';world.choices=ordinaryOffers(world);if(!world.choices.length){world.pendingLevels--;world.gold+=10;world.emit('rewardFallback',{gold:10});nextReward(world);return;}}
  else {world.choices=[];world.status='playing';return;}
  world.status='levelup';world.emit('levelup');
}
export function chooseReward(world,index,replaceId){
  const c=world.choices[index];if(world.status!=='levelup'||!c)return false;
  if(world.rewardKind==='behavior'){
    const id=world.milestones[0];if(c.id!==id||!['quick','focus','mobile'].includes(c.mode))return false;world.milestones.shift();(world.behaviors[id]??=[]).push(c.mode);
  }else if(world.rewardKind==='learning'){
    if(c.type!=='keep'){
      if(world.skills[c.id])return false;
      if(c.type==='replace'){
        if(!replacementIds(world.skills,c.id).includes(replaceId))return false;
        world.skills=Object.fromEntries(Object.entries(world.skills).map(([id,rank])=>id===replaceId?[c.id,1]:[id,rank]));
        for(const key of ['cooldowns','cooldownDurations','cooldownWaiting','individualPurchases','behaviors','localBonuses'])delete world[key][replaceId];delete world.player.statuses[replaceId];
      }else if(canLearn(world.skills,c.id))world.skills[c.id]=1;else return false;
    }
    world.learningQueue.shift();
  }else {if(!applyGift(world,c))return false;world.pendingLevels--;}
  nextReward(world);return true;
}
export function spellModifiers(world,id){
  let rank=1+(world.localBonuses?.[id]?.ward||0),tempo=1+(world.localBonuses?.[id]?.tempo||0),movement=1;
  for(const mode of world.behaviors?.[id]||[]){if(mode==='quick'){rank*=.85;tempo*=1.25;}else if(mode==='mobile'){rank*=.9;movement*=1.12;}else if(SELF_BUFFS.has(id)){rank*=1.2;movement*=.9;}else{rank*=1.3;tempo*=.85;}}
  return {rank,tempo,movement};
}
