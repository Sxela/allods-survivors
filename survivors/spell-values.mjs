// Shared by the original-behavior caster and the live spell inspector.
export function spellValues(id,rank){
  if(['bolt','ice','stone','fireball'].includes(id))return {damage:(id==='fireball'?32:18)+rank*10,...(id==='fireball'?{radius:65+rank*7}:{})};
  if(['lightning','prismatic'].includes(id))return {damage:22+rank*12,targets:id==='lightning'?1:3+Math.floor(rank/2)};
  if(['poison','frost'].includes(id))return {damage:5+rank*4,radius:65+rank*9,duration:3+rank*.35,tick:.4};
  if(id==='firewall')return {damage:8+rank*6,duration:4+rank*.3,length:100+rank*15,tick:.4};
  if(id==='earthwall')return {duration:5+rank*.4,length:100+rank*15};
  if(id==='heal')return {healing:12+rank*6};
  if(id==='drain')return {damage:20+rank*10,leech:true};
  if(id==='shield')return {absorption:30+rank*12,fraction:.55,duration:8+rank*.5};
  if(id==='stonecurse')return {duration:2+rank*.35};
  if(id.startsWith('protect'))return {reduction:Math.min(.8,.35+rank*.04),duration:8+rank*.5};
  if(id==='bless')return {maxRollChance:Math.min(1,.45+rank*.06),duration:8+rank*.5};
  if(id==='hasteSpell')return {movement:1.25+rank*.04,duration:7+rank*.5};
  if(id==='invisibility')return {duration:4+rank*.4};
  if(id==='teleport')return {distance:135+rank*8};
  if(['summon','animate'].includes(id))return {allyHp:45+rank*18,allyDamage:10+rank*5,duration:20+rank*2};
  return {};
}
