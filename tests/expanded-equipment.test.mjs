import test from 'node:test';
import assert from 'node:assert/strict';
import {World,random} from '../survivors/core.mjs';
import {Inventory,makeItem,sanitizeInventory,outclasses,itemFamily} from '../survivors/loot.mjs';
import {ITEM_CATALOG} from '../survivors/item-catalog.mjs';
import {AFFIXES,UNIQUES} from '../survivors/item-affixes.mjs';
import {physicalRoll,resistance} from '../survivors/original-spells.mjs';
const gear=(id,slot,stats)=>({id,slot,stats,name:id,icon:slot,rarity:'rare'});
const enemy=w=>{const e=w.spawn('wolf');Object.assign(e,{x:80,y:0,hp:10000,maxHp:10000,speed:0});return e;};

test('attribute bonuses alter health, accuracy, evasion, movement, spell power and learning without stacking',()=>{
  const item=gear('attributes','amulet',{body:4,agility:5,mind:6,spirit:7}),w=new World({inventory:{bag:[item]}});
  w.equipItem(item.id);const p=w.player;assert.equal(p.maxHp,120);assert.equal(p.maxMana,undefined);assert.equal(p.attack,12);assert.equal(p.defense,10);assert.equal(p.speed,151);assert.equal(p.spellDamage,.09);
  const before=JSON.stringify(p);w.refreshEquipment();assert.equal(JSON.stringify(p),before);
  w.addXp(1);assert.equal(p.xp,1.06);w.unequipItem('amulet');assert.equal(p.maxHp,100);assert.equal(p.maxMana,undefined);assert.equal(p.mana,undefined);assert.equal(p.spellDamage,0);
});

test('equipment and temporary elemental resistances combine with caps, reducing real incoming spell damage',()=>{
  const w=new World({inventory:{equipment:{armor:gear('ward','armor',{fireResist:.5,waterResist:.2})}}});
  assert.equal(w.damagePlayer(40,'fire'),20);w.player.invulnerable=0;
  w.player.statuses.protectFire={ttl:5,reduction:.5};assert.equal(resistance(w.player,'fire'),.75);assert.equal(w.damagePlayer(40,'fire'),10);
  w.player.invulnerable=0;assert.equal(w.damagePlayer(10,'earth'),10);
});

test('weapon ranges and skill bonuses affect actual physical damage, accuracy and defense can avoid hits',()=>{
  const w=new World({hero:'warrior',inventory:{equipment:{weapon:gear('blade','weapon',{minDamage:4,maxDamage:8,bladeSkill:5,attackSpeed:.2,range:30})}}});
  w.rng=()=>0;assert.equal(physicalRoll(w,10,20),15);w.rng=()=>.999;assert.ok(physicalRoll(w,10,20)>28.9);
  const e=enemy(w);w.player.attack=500;w.rng=()=>.5;assert.ok(w.hurt(e,10,'physical')>0);w.player.attack=1;w.rng=()=>.99;assert.equal(w.hurt(e,10,'physical'),0);
  w.player.defense=100;w.rng=()=>0;assert.equal(w.damagePlayer(20,'physical'),0);
});

test('autocasting uses cooldowns without a mana resource or gear requirements',()=>{
 const w=new World();assert.equal(w.cast('lightning'),false);assert.equal(w.player.mana,undefined);enemy(w);assert.equal(w.cast('lightning'),true);w.spawnTimer=Infinity;w.skills={lightning:1};w.step(.05);assert.ok(w.cooldowns.lightning>0);const cooldown=w.cooldowns.lightning;w.status='inventory';w.step(.05);assert.equal(w.cooldowns.lightning,cooldown);assert.equal(w.player.mana,undefined);
});

test('+3 Wall of Fire and school bonuses boost learned casts without teaching spells or changing learned ranks',()=>{
  const item=gear('flame','weapon',{'skill:firewall':3,fireSkill:5,spellDamage:.2}),w=new World({inventory:{bag:[item]}});enemy(w);w.skills={firewall:1};
  w.equipItem(item.id);assert.equal(w.effectiveRank('firewall'),5);w.cast('firewall',1);assert.equal(w.fields[0].damage,38);assert.equal(w.skills.firewall,1);assert.equal(w.skills.fireball,undefined);
  const restored=new World({inventory:JSON.parse(JSON.stringify(w.inventory.snapshot()))});assert.equal(restored.player['skill:firewall'],3);assert.equal(restored.effectiveRank('firewall',1),5);
  w.unequipItem('weapon');assert.equal(w.effectiveRank('firewall'),1);w.cast('firewall',1);assert.equal(w.fields.at(-1).damage,14);
});

test('affixes obey magic prefix/suffix limits, rare group limits, and item-type pools with rare exceptions',()=>{
  const rng=random(456);let cross=0,unique=0;
  for(let i=0;i<8000;i++){
    const item=makeItem(rng,{id:`affix-${i}`,level:20}),family=itemFamily(item.icon,item.slot,ITEM_CATALOG),affixes=item.affixes.map(id=>AFFIXES.find(a=>a.id===id));
    assert.equal(new Set(affixes.map(a=>a.group)).size,affixes.length);
    for(const kind of ['prefix','suffix'])assert.ok(affixes.filter(a=>a.kind===kind).length<=(item.rarity==='magic'?1:3));
    if(item.rarity==='magic'){assert.ok(affixes.length>=1&&affixes.length<=2);assert.ok(affixes.every(a=>a.types.includes(family)));}
    if(item.rarity==='rare'){assert.ok(affixes.length>=2&&affixes.length<=6);if(affixes.some(a=>!a.types.includes(family)))cross++;}
    if(item.rarity==='unique'){unique++;assert.equal(item.name,UNIQUES[family].name);assert.equal(item.uniqueId,family);}
    if(family==='staff'&&item.rarity==='common'){assert.ok(item.stats.spellDamage>0);assert.ok(item.stats.haste>0);assert.equal(item.stats.minDamage,undefined);}
    assert.deepEqual(sanitizeInventory({bag:[item]}).bag,[item]);
  }
  assert.ok(cross>50);assert.ok(unique>0);
});

test('individual spell bonuses participate in comparison and autosell, and new stat saves reject invalid values',()=>{
  const a=gear('flame','ring',{'skill:firewall':3,magicFind:.1}),b=gear('ice','ring',{'skill:frost':3,magicFind:.2});
  assert.equal(outclasses(a,b),false);assert.equal(outclasses(b,a),false);const inventory=new Inventory({bag:[a,b]});assert.equal(inventory.autoSell().gold,0);
  const item=sanitizeInventory({bag:[{...a,stats:{'skill:firewall':3.8,fireResist:4,maxMana:Infinity,mind:2,'skill:invented':5}}]}).bag[0];assert.deepEqual(item.stats,{mind:2});
});
