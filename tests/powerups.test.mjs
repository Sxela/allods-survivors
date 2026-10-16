import test from 'node:test';
import assert from 'node:assert/strict';
import {POWERUPS,grantPowerup} from '../survivors/powerups.mjs';
import {movementMultiplier,absorbIncoming,stepOriginal} from '../survivors/original-spells.mjs';

function fixture(){return {player:{x:7,y:9,hp:20,maxHp:100,statuses:{}},gems:[],effects:[],enemies:[],allies:[],fields:[],corpses:[],events:[],emit(type,data){this.events.push({type,...data});}};}

test('Haste pickup uses the spell movement status and expires normally',()=>{
  const w=fixture();assert.equal(grantPowerup(w,'haste'),true);
  assert.equal(movementMultiplier(w.player),1.4);
  assert.equal(w.player.statuses.hasteSpell.ttl,12);
  stepOriginal(w,13);assert.equal(movementMultiplier(w.player),1);
});
test('Haste refresh preserves a stronger active spell without multiplying speed twice',()=>{
  const w=fixture();w.player.statuses.hasteSpell={ttl:20,multiplier:1.8};
  grantPowerup(w,'haste');grantPowerup(w,'haste');
  assert.deepEqual(w.player.statuses.hasteSpell,{ttl:20,multiplier:1.8});
  w.player.statuses.hasteSpell.ttl=0;grantPowerup(w,'haste');
  assert.equal(movementMultiplier(w.player),1.4);
});
test('Shield pickup absorbs part of damage using the existing finite shield pool',()=>{
  const w=fixture();grantPowerup(w,'shield');
  assert.equal(absorbIncoming(w.player,100),35);
  assert.equal(w.player.statuses.shield.pool,5);
  assert.equal(absorbIncoming(w.player,100),95);
  assert.equal(w.player.statuses.shield.pool,0);
  grantPowerup(w,'shield');assert.equal(w.player.statuses.shield.pool,70);
  stepOriginal(w,13);assert.equal(absorbIncoming(w.player,100),100);
});
test('Shield pickup preserves stronger active protection and replenishes without unbounded stacking',()=>{
  const w=fixture();w.player.statuses.shield={ttl:30,pool:110,maxPool:180,fraction:.8};
  grantPowerup(w,'shield');grantPowerup(w,'shield');
  assert.deepEqual(w.player.statuses.shield,{ttl:30,pool:110,maxPool:180,fraction:.8});
});
test('XP Magnet attracts all uncollected XP at any distance, leaving gold and healing untouched',()=>{
  const w=fixture();w.gems=[{type:'xp',x:2,y:3},{type:'xp',x:5000,y:-5000},{type:'xp',collected:true},{type:'gold'},{type:'heal'}];
  grantPowerup(w,'magnet');
  assert.deepEqual(w.gems.map(g=>g.attracted),[true,true,undefined,undefined,undefined]);
  assert.equal(w.player.hp,20);
});
test('Healing restores health up to its maximum and preserves equipment stats and buffs',()=>{
  const w=fixture();w.player.damage=2;w.player.statuses.shield={ttl:10,pool:50};
  grantPowerup(w,'heal');assert.equal(w.player.hp,55);
  grantPowerup(w,'heal');grantPowerup(w,'heal');assert.equal(w.player.hp,100);
  assert.equal(w.player.damage,2);assert.equal(w.player.statuses.shield.pool,50);
});
test('Every pickup emits its name and uses an original effect; unknown IDs do nothing',()=>{
  for(const [id,def] of Object.entries(POWERUPS)){
    const w=fixture();assert.equal(grantPowerup(w,id),true);
    assert.deepEqual(w.events,[{type:'powerup',kind:id,name:def.name}]);
    assert.equal(w.effects[0].vfx,def.vfx);
    assert.equal(w.effects[0].x,w.player.x);assert.equal(w.effects[0].y,w.player.y);
  }
  const w=fixture();assert.equal(grantPowerup(w,'missing'),false);
  assert.equal(w.effects.length,0);assert.equal(w.events.length,0);
});
