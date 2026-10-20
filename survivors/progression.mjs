import {Inventory} from './loot.mjs';
import {shopStock} from './shop.mjs';

export function freshProgress(previous,hero,now=Date.now()){
  const generation=Math.max(now,(previous.shopGeneration||0)+1);
  return {gold:0,best:0,runs:0,upgrades:{},difficulty:previous.difficulty,inventory:new Inventory().snapshot(),shopGeneration:generation,shopStock:shopStock(generation,1,hero)};
}

export function resetAfterDeath(world,previous){
  world.inventory=new Inventory({},world.hero);world.skills={};world.cooldowns={};
  world.localBonuses={};world.individualPurchases={};world.behaviors={};world.milestones=[];world.learningQueue=[];world.cooldownDurations={};world.cooldownWaiting={};world.pendingLevels=0;world.choices=[];
  world.refreshEquipment();world.player.statuses={};world.fields=[];world.allies=[];world.lootDrops=[];world.gold=0;
  return freshProgress(previous,world.hero);
}
