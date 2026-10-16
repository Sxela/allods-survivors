import test from 'node:test';
import assert from 'node:assert/strict';
import {World,random} from '../survivors/core.mjs';
import {makeItem,sanitizeInventory} from '../survivors/loot.mjs';
test('ordinary kills drop equipment near 0.4 percent, while first kill and bosses guarantee it',()=>{
  const w=new World({seed:8372});let drops=0;
  w.dropLoot=()=>drops++;const kill=boss=>{const e=w.spawn('wolf',boss);w.hurt(e,e.hp+1);w.enemies=[];w.gems=[];};
  kill(false);assert.equal(drops,1);
  for(let i=0;i<10000;i++)kill(false);
  assert.ok(drops>=22&&drops<=62,`${drops} drops in 10000 ordinary kills`);
  const before=drops;for(let i=0;i<10;i++)kill(true);assert.equal(drops,before+10);
});
test('same-level same-rarity item stats span a dramatic range, independently across bonuses',()=>{
  const rng=random(4281),items=[];
  for(let i=0;i<3000;i++){
    const item=makeItem(rng,{slot:'boots',level:1,id:`roll-${i}`});
    if(item.rarity==='common')items.push(item);
  }
  const speeds=items.map(i=>i.stats.speed).sort((a,b)=>a-b);
  assert.ok(speeds.at(-1)/speeds[0]>9);
  assert.ok(speeds[Math.floor(speeds.length*.9)]/speeds[Math.floor(speeds.length*.1)]>5);
  assert.ok(items.some(i=>i.stats.speed>1.2&&i.stats.goldFind<.004));
  assert.ok(items.some(i=>i.stats.speed<.4&&i.stats.goldFind>.012));
});
test('extreme high-level rolls remain valid through inventory save sanitizing',()=>{
  const rng=random(8765);
  for(let i=0;i<1000;i++){const item=makeItem(rng,{level:99,boss:true,id:`high-${i}`});assert.deepEqual(sanitizeInventory({bag:[item]}).bag,[item]);}
});
