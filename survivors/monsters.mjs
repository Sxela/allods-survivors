import catalog from './monster-data.mjs';

export const MONSTERS=catalog.monsters;
export const projectileVfxById=catalog.projectileVfxById;
export const MONSTER_PROVENANCE=catalog.provenance;
const aliases={skeleton:'skeleton_f1',zombie:'zombie_f1'};
export const ENEMY_SPRITES=Object.fromEntries([
  ...Object.entries(MONSTERS).map(([id,monster])=>[id,monster.dimensions]),
  ...Object.entries(aliases).map(([id,original])=>[id,MONSTERS[original].dimensions]),
]);

// The registry supplies relative frame times but no verified seconds per tick.
// Twelve ticks per second is the standalone game's playback rate.
export function sampleMonsterFrame(type,action='walk',dx=0,dy=1,time=0){
  const monster=MONSTERS[aliases[type]||type];
  if(!monster)return {frame:0,flipX:false};
  const animation=monster.animation[action]||monster.animation.idle;
  const fullDirections=action==='idle'?16:8;
  const direction=((Math.round((Math.atan2(dy,dx)-Math.PI/2)*fullDirections/(2*Math.PI))%fullDirections)+fullDirections)%fullDirections;
  const flipX=animation.mirror&&direction>fullDirections/2;
  const storedDirection=flipX?fullDirections-direction:direction;
  const frameTimes=animation.AnimTime;
  let phase;
  if(frameTimes?.length){
    let tick=((time*12)%frameTimes.reduce((sum,value)=>sum+value,0)+frameTimes.reduce((sum,value)=>sum+value,0))%frameTimes.reduce((sum,value)=>sum+value,0);
    let index=0;while(index<frameTimes.length-1&&tick>=frameTimes[index])tick-=frameTimes[index++];
    phase=(animation.AnimFrame?.[index]??index)%animation.phases;
  }else phase=Math.floor(Math.max(0,time)*12)%animation.phases;
  return {frame:animation.offset+storedDirection*(animation.stride||animation.phases)+phase,flipX};
}
