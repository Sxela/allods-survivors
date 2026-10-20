import {POWERUPS} from './powerups.mjs';
// Screen-space pickup guidance stays inside the HUD's playable area.
export function pickupGuides(world,{width,height}){
  const player=world.player,minX=24,maxX=width-24,minY=88,maxY=height-112,cx=width/2,cy=height/2;
  const point=target=>{
    const dx=target.x-player.x,dy=target.y-player.y,distance=Math.hypot(dx,dy),x=cx+dx,y=cy+dy;
    if(distance>1400||x>=minX&&x<=maxX&&y>=minY&&y<=maxY)return null;
    const tx=dx>0?(maxX-cx)/dx:dx<0?(minX-cx)/dx:Infinity,ty=dy>0?(maxY-cy)/dy:dy<0?(minY-cy)/dy:Infinity,t=Math.min(tx,ty);
    return {x:cx+dx*t,y:cy+dy*t,angle:Math.atan2(dy,dx),distance:Math.round(distance)};
  };
  const guides=[];if(world.campaign?.exit){const p=point(world.campaign.exit);if(p)guides.push({...p,kind:'exit',label:'EXIT',color:'#9ce7df'});}
  const loot=[...world.lootDrops].sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
  for(const drop of loot){const p=point(drop);if(p){guides.push({...p,kind:'loot',label:'LOOT',rarity:drop.item.rarity});if(guides.length>=3)break;}}
  const powerups=[...(world.powerups||[])].filter(drop=>drop.ttl>0).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
  for(const drop of powerups.slice(0,3)){const p=point(drop),def=POWERUPS[drop.kind];if(p&&def)guides.push({...p,kind:'powerup',label:def.name.toUpperCase(),color:def.color});}
  for(const kind of ['xp','gold','heal']){
    if(kind==='heal'&&player.hp>=player.maxHp)continue;
    const target=world.gems.filter(g=>g.type===kind).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).find(g=>point(g));
    if(target)guides.push({...point(target),kind,label:kind==='xp'?'XP':kind==='gold'?'GOLD':'HEAL'});
  }
  // Nearby edge markers group together so several drops don't overprint labels.
  const spaced=[];for(const guide of guides){const previous=spaced.find(p=>p.kind===guide.kind&&Math.hypot(p.x-guide.x,p.y-guide.y)<52);if(previous){previous.count=(previous.count||1)+1;if(previous.kind==='powerup')previous.label='POWER-UPS';continue;}spaced.push(guide);}return spaced;
}
