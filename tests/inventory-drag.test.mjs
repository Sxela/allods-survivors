import test from 'node:test';
import assert from 'node:assert/strict';
import {Inventory,sanitizeInventory,equipmentStats} from '../survivors/loot.mjs';
import {World} from '../survivors/core.mjs';

const item=(id,slot='weapon',stats={damage:.1})=>({id,name:'Test relic',slot,rarity:'magic',stats,icon:slot});
const assertUnique=inventory=>{
  const owned=[...inventory.bag,...Object.values(inventory.equipment).filter(Boolean)];
  assert.equal(new Set(owned.map(entry=>entry.id)).size,owned.length);
  const cells=inventory.bag.map(entry=>inventory.positions[entry.id]);
  assert.equal(new Set(cells).size,cells.length);
  assert.ok(cells.every(index=>Number.isInteger(index)&&index>=0&&index<36));
};

test('dragging to an empty bag cell leaves the vacated gap and preserves other positions',()=>{
  const inventory=new Inventory({bag:[item('a'),item('b')]});
  assert.equal(inventory.bagAt(0).id,'a');assert.equal(inventory.bagAt(1).id,'b');
  assert.equal(inventory.move('a',{bagIndex:20}),true);
  assert.ok(!inventory.bagAt(0));assert.equal(inventory.bagAt(20).id,'a');
  assert.equal(inventory.bagAt(1).id,'b');assert.equal(inventory.bag.length,2);
  assertUnique(inventory);
});

test('dragging onto an occupied bag cell swaps both positions',()=>{
  const inventory=new Inventory({bag:[item('a'),item('b')],positions:{a:4,b:18}});
  assert.equal(inventory.move('a',{bagIndex:18}),true);
  assert.equal(inventory.bagAt(18).id,'a');assert.equal(inventory.bagAt(4).id,'b');
  assert.equal(inventory.positions.a,18);assert.equal(inventory.positions.b,4);assertUnique(inventory);
});

test('bag to matching gear swaps the old gear into the exact vacated cell at full capacity',()=>{
  const inventory=new Inventory({equipment:{weapon:item('equipped')},bag:Array.from({length:36},(_,i)=>item(`bag-${i}`))});
  assert.equal(inventory.move('bag-17',{slot:'weapon'}),true);
  assert.equal(inventory.equipment.weapon.id,'bag-17');assert.equal(inventory.bagAt(17).id,'equipped');
  assert.equal(inventory.bag.length,36);assert.ok(!Object.hasOwn(inventory.positions,'bag-17'));
  assertUnique(inventory);
});

test('bag to empty gear vacates its cell without compacting other items',()=>{
  const inventory=new Inventory({bag:[item('staff'),item('ring','ring',{haste:.1})],positions:{staff:25,ring:31}});
  assert.equal(inventory.move('staff',{slot:'weapon'}),true);
  assert.ok(!inventory.bagAt(25));assert.equal(inventory.bagAt(31).id,'ring');
  assert.equal(inventory.equipment.weapon.id,'staff');assertUnique(inventory);
});

test('wrong equipment slots and invalid targets reject atomically',()=>{
  const inventory=new Inventory({bag:[item('staff')],equipment:{helm:item('crown','helm',{maxHp:20})}});
  for(const target of [{slot:'helm'},{slot:'unknown'},{bagIndex:-1},{bagIndex:36},{bagIndex:1.5},{bagIndex:NaN},{bagIndex:'1'},{}]){
    const before=inventory.snapshot();assert.equal(inventory.move('staff',target),false);
    assert.deepEqual(inventory.snapshot(),before);
  }
  const before=inventory.snapshot();assert.equal(inventory.move('missing',{bagIndex:1}),false);
  assert.deepEqual(inventory.snapshot(),before);assert.equal(inventory.move('staff',{bagIndex:0}),false);
});

test('equipped gear can be dragged to a chosen empty bag cell',()=>{
  const inventory=new Inventory({equipment:{weapon:item('staff')},bag:[item('ring','ring',{haste:.1})],positions:{ring:8}});
  assert.equal(inventory.move('staff',{bagIndex:30}),true);
  assert.equal(inventory.equipment.weapon,null);assert.equal(inventory.bagAt(30).id,'staff');
  assert.equal(inventory.bagAt(8).id,'ring');assertUnique(inventory);
});

test('equipped gear dragged onto matching bag gear swaps the bag item into equipment',()=>{
  const inventory=new Inventory({equipment:{weapon:item('old')},bag:[item('new','weapon',{damage:.3})],positions:{new:24}});
  assert.equal(inventory.move('old',{bagIndex:24}),true);
  assert.equal(inventory.equipment.weapon.id,'new');assert.equal(inventory.bagAt(24).id,'old');
  assert.equal(equipmentStats(inventory.equipment).damage,.3);assertUnique(inventory);
});

test('equipped to occupied bag swaps work without spare capacity',()=>{
  const inventory=new Inventory({equipment:{weapon:item('equipped')},bag:Array.from({length:36},(_,i)=>item(`bag-${i}`))});
  assert.equal(inventory.move('equipped',{bagIndex:35}),true);
  assert.equal(inventory.equipment.weapon.id,'bag-35');assert.equal(inventory.bagAt(35).id,'equipped');
  assert.equal(inventory.bag.length,36);assertUnique(inventory);
});

test('equipped gear rejects incompatible occupied bag cells without losing either item',()=>{
  const inventory=new Inventory({equipment:{weapon:item('staff')},bag:[item('boots','boots',{speed:10})],positions:{boots:14}});
  const before=inventory.snapshot();assert.equal(inventory.move('staff',{bagIndex:14}),false);
  assert.deepEqual(inventory.snapshot(),before);assertUnique(inventory);
});

test('positions persist through JSON save and sparse bag placement is retained',()=>{
  const inventory=new Inventory({bag:[item('a'),item('b')],positions:{a:32,b:5}});
  inventory.move('b',{bagIndex:21});const saved=JSON.parse(JSON.stringify(inventory.snapshot()));
  assert.equal(saved.positions.a,32);assert.equal(saved.positions.b,21);
  const restored=new Inventory(saved);
  assert.equal(restored.bagAt(32).id,'a');assert.equal(restored.bagAt(21).id,'b');assert.ok(!restored.bagAt(0));
  saved.positions.a=0;assert.equal(restored.positions.a,32);assertUnique(restored);
});

test('old saves autoassign cells and malformed or colliding cells repair to free positions',()=>{
  const old=new Inventory({bag:[item('a'),item('b'),item('c')]});
  assert.deepEqual(old.bag.map(entry=>old.positions[entry.id]),[0,1,2]);
  const repaired=new Inventory({bag:[item('a'),item('b'),item('c'),item('d'),item('e')],positions:{a:7,b:7,c:-1,d:36,e:3,stale:19}});
  assert.equal(repaired.positions.a,7);assert.equal(repaired.positions.e,3);
  assertUnique(repaired);assert.ok(!Object.hasOwn(repaired.positions,'stale'));
  assert.deepEqual(new Set(repaired.bag.map(entry=>repaired.positions[entry.id])),new Set([7,0,1,2,3]));
  const sanitized=sanitizeInventory({bag:[item('a')],positions:{a:Infinity}});
  assert.equal(sanitized.positions.a,0);
});

test('discard and later loot addition reuse the first free cell without shifting existing cells',()=>{
  const inventory=new Inventory({bag:[item('a'),item('b')],positions:{a:0,b:20}});
  inventory.discard('a');assert.ok(!Object.hasOwn(inventory.positions,'a'));
  assert.equal(inventory.add(item('c')),true);assert.equal(inventory.bagAt(0).id,'c');
  assert.equal(inventory.bagAt(20).id,'b');assertUnique(inventory);
});

test('prototype-like item IDs safely retain their own bag positions',()=>{
  const inventory=new Inventory({bag:[item('__proto__'),item('constructor')],positions:JSON.parse('{"__proto__":17,"constructor":9}')});
  assert.equal(inventory.bagAt(17).id,'__proto__');assert.equal(inventory.bagAt(9).id,'constructor');
  assert.equal(inventory.move('__proto__',{bagIndex:9}),true);
  assert.equal(inventory.bagAt(9).id,'__proto__');assert.equal(inventory.bagAt(17).id,'constructor');
  const restored=new Inventory(JSON.parse(JSON.stringify(inventory.snapshot())));assertUnique(restored);
  assert.equal(restored.bagAt(9).id,'__proto__');
});

test('core drag operations refresh equipment bonuses without stacking or altering pause state',()=>{
  const world=new World({seed:17,inventory:{bag:[item('staff','weapon',{damage:.2}),item('other','weapon',{damage:.4})],positions:{staff:12,other:30}}});
  world.status='inventory';
  assert.equal(world.moveItem('staff',{slot:'weapon'}),true);assert.equal(world.player.damage,1.2);
  assert.equal(world.moveItem('staff',{bagIndex:30}),true);assert.equal(world.player.damage,1.4);
  assert.equal(world.inventory.equipment.weapon.id,'other');assert.equal(world.inventory.bagAt(30).id,'staff');
  assert.equal(world.moveItem('other',{bagIndex:12}),true);assert.equal(world.player.damage,1);
  for(let i=0;i<5;i++){
    assert.equal(world.moveItem('staff',{slot:'weapon'}),true);assert.equal(world.player.damage,1.2);
    assert.equal(world.moveItem('staff',{bagIndex:30}),true);assert.equal(world.player.damage,1);
  }
  assert.equal(world.status,'inventory');assert.equal(world.moveItem('staff',{slot:'helm'}),false);
  assert.equal(world.player.damage,1);assertUnique(world.inventory);
});
