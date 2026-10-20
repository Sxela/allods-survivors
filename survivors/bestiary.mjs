import {MONSTERS} from './monsters.mjs';
import {MAP_ARENAS,arenaFor} from './map-arenas.mjs';
import {monsterCombat} from './monster-combat.mjs';
const family=id=>id.replace(/_[afm]?[0-9]+$/,'').replace(/_[a-z]+$/,'');
export function bestiaryEntries(world,{query='',local=true,page=0,pageSize=6,role='ordinary'}={}){
 const roster=new Set([...(arenaFor(world)?.roster||[]),...world.enemies.filter(e=>e.hp>0).map(e=>e.type),...(world.campaign?.index===world.campaign?.route.length-1?['mainnecro']:[])]),search=query.trim().toLowerCase(),ids=Object.keys(MONSTERS).filter(id=>(!local||roster.has(id))&&(`${id} ${MONSTERS[id].name}`).toLowerCase().includes(search)).sort((a,b)=>MONSTERS[a].name.localeCompare(MONSTERS[b].name)||a.localeCompare(b));
 const pages=Math.max(1,Math.ceil(ids.length/pageSize));page=Math.max(0,Math.min(pages-1,page));
 const entries=ids.slice(page*pageSize,(page+1)*pageSize).map(id=>{
  const def=MONSTERS[id],live=world.enemies.filter(e=>e.type===id&&e.hp>0);
  return {id,name:def.name,nativeId:def.registry?.ID??id,hostile:def.hostile,local:roster.has(id),...monsterCombat(world,id,{boss:role==='guardian',captain:role==='captain'}),variants:Object.keys(MONSTERS).filter(other=>family(other)===family(id)),zones:[...new Set(MAP_ARENAS.filter(a=>a.roster.includes(id)).map(a=>a.name))],live:live.length,statuses:[...new Set(live.flatMap(e=>Object.keys(e.statuses||{}).filter(k=>e.statuses[k]?.ttl>0)))]};
 });
 return {entries,total:ids.length,page,pages};
}
