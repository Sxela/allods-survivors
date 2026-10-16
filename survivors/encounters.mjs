import {MONSTERS} from './monsters.mjs';
// Standalone pacing inspired by the inspected D2 director. Titles/modifiers
// below are champion encounters, not claims of native Allods unique bosses.
export function championSchedule(duration=600){
  const majors=[120,240,360,480,duration-15],marks=[];
  for(let mark=35;mark<duration-30;mark+=45)if(majors.every(major=>Math.abs(major-mark)>=20))marks.push(mark);
  return marks;
}
export function spawnChampionEncounter(world,index=0){
  const stage=Math.min(4,Math.floor(world.time/120));
  const leaders=['goblin','orc','troll','skeleton_f3','skeleton_m4'];
  const escorts=['wolf','goblin_s','zombie_a2','skeleton_a1','ghost'];
  const pack=index%2===1,type=pack?escorts[stage]:leaders[stage];
  const leader=world.spawn(type);leader.elite=true;leader.minorBoss=true;
  leader.name=`${pack?'Pack Champion':'Captain'} ${MONSTERS[type].name}`;
  leader.hp*=pack?3.5:5;leader.maxHp=leader.hp;leader.damage*=1.2;leader.speed*=1.15;
  const dx=leader.x-world.player.x,dy=leader.y-world.player.y,d=Math.hypot(dx,dy)||1;
  for(let i=0;i<2;i++){
    const member=world.spawn(escorts[stage]);member.elite=pack;
    member.hp*=pack?2.2:1.4;member.maxHp=member.hp;
    const x=leader.x+dx/d*55-dy/d*(i?45:-45),y=leader.y+dy/d*55+dx/d*(i?45:-45);
    const [width,height]=MONSTERS[member.type].dimensions,px=x-world.player.x,py=y-world.player.y;
    if(px-width/2>world.viewport.width/2||px+width/2<-world.viewport.width/2||py-(height-2)>world.viewport.height/2||py+6<-world.viewport.height/2)Object.assign(member,{x,y});
  }
  world.emit('champion',{name:leader.name,pack});return leader;
}
export function updateChampionEncounters(world){
  for(const [index,mark] of championSchedule(world.duration).entries()){
    if(world.time<mark||world.championMarks.has(mark))continue;
    world.championMarks.add(mark);
    // Don't flood the world when loading/debugging across several timestamps.
    if(world.time-mark>2||world.time>=world.duration-30||world.enemies.filter(e=>e.minorBoss&&e.hp>0).length>=2)continue;
    spawnChampionEncounter(world,index);
  }
}
