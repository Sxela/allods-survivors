// Pickup balancing is for this standalone game. Haste and Shield reuse the
// source-described Allods spells; XP attraction is a survival-game convenience.
// These drops are not claimed to be native Allods campaign objects.
export const POWERUPS={
  haste:{name:'Haste',vfx:'bless',color:'#e8d58a',icon:'spell-haste',duration:12,description:'+40% movement speed for 12 seconds'},
  shield:{name:'Shield',vfx:'shield',color:'#a9d5fa',icon:'spell-magic',duration:12,description:'Absorbs 65% of incoming damage, up to 70 damage, for 12 seconds'},
  magnet:{name:'XP Magnet',vfx:'teleport',color:'#be9ee9',icon:'spell-portal',duration:0,description:'Attracts every experience shard on the ground'},
  heal:{name:'Healing',vfx:'healing',color:'#b6dc8d',icon:'spell-healing',duration:0,description:'Restores 35% of maximum health'},
};

// Merge maxima only from an active status. An expired buff must not resurrect
// with its old strength. Original spell stepping owns expiry and shield usage.
function refreshStatus(player,key,values){
  player.statuses??={};
  const previous=player.statuses[key];
  const active=previous?.ttl>0?previous:{};
  player.statuses[key]={...active,...Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Math.max(value,active[key]??0)]))};
}

export function grantPowerup(world,id){
  const def=POWERUPS[id];
  if(!def)return false;
  const p=world.player;
  if(id==='haste')refreshStatus(p,'hasteSpell',{ttl:12,multiplier:1.4});
  else if(id==='shield'){
    refreshStatus(p,'shield',{ttl:12,pool:70,maxPool:70,fraction:.65});
    p.statuses.shield.maxPool=Math.max(p.statuses.shield.maxPool,p.statuses.shield.pool);
  }else if(id==='magnet'){
    for(const gem of world.gems||[])if(gem.type==='xp'&&!gem.collected)gem.attracted=true;
  }else if(id==='heal')world.heal?world.heal(p.maxHp*.35):p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.35);
  world.effects??=[];
  world.effects.push({kind:def.vfx,vfx:def.vfx,x:p.x,y:p.y,ttl:.7,maxTtl:.7});
  world.emit?.('powerup',{kind:id,name:def.name});
  return true;
}
