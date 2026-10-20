import {arenaFor,arenaHeight} from './map-arenas.mjs';
import {MONSTERS} from './monsters.mjs';
import {ENEMY_SPELLBOOKS} from './enemy-spells.mjs';
// Shared by spawning and bestiary. These are survival formulas, not native server stats.
export function monsterCombat(world,type,{boss=false,captain=false}={}){
 const def=MONSTERS[type];if(!def)throw new Error(`Unknown monster: ${type}`);
 // Region growth is bounded independently of a 12- or 202-map route. Longer
 // fights strengthen new arrivals, keeping sustain builds from stalling safely.
 const pressure=world.campaign?Math.min(1,Math.max(0,world.campaign.index)/4):0,overstay=world.campaign?Math.min(1,Math.max(0,world.campaign.time-60)/150):0;
 const healthScale=world.rules.health*(1+(world.rules.healthGrowth||0)*pressure)*(1+(world.rules.overstayHealth||0)*overstay),damageScale=world.rules.damage*(1+(world.rules.damageGrowth||0)*pressure)*(1+(world.rules.overstayDamage||0)*overstay);
 const minute=world.terrainTime/60,tier=def.tier||0,book=ENEMY_SPELLBOOKS[type],projectile=def.projectile??def.projectileId;
 return {hp:(15+tier*12)*(1+minute*.24)*(boss?16:1)*(captain?3:1)*healthScale,damage:(7+tier*2)*damageScale*(captain?1.15:1),speed:((type==='wolf'?58:type==='spider'?66:45)+minute*2)*world.rules.speed,range:book||projectile?550:(type==='dragon'?30:14)+24,attack:book?'Spellcaster':projectile?'Ranged projectile':'Melee',element:book?null:projectile===12?'fire':'physical',spells:book?[...book.attacks,...book.support]:[],spellDamage:book?(7+tier*2)*damageScale*(captain?1.15:1)*.9:0,flying:!!def.flying};
}

export function visibleEnemyCount(world){
 const a=arenaFor(world),p=world.player,v=world.viewport,origin=p.y-(arenaHeight(a,p.x,p.y)||0);
 return world.enemies.filter(e=>{if(e.hp<=0||e.arrival>0)return false;const [width,height]=MONSTERS[e.type]?.dimensions||[40,80],x=e.x-p.x,y=e.y-(arenaHeight(a,e.x,e.y)||0)-origin;return x+width/2>=-v.width/2&&x-width/2<=v.width/2&&y+6>=-v.height/2&&y-height<=v.height/2;}).length;
}
