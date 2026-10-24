import {ITEM_CATALOG} from './item-catalog.mjs';
import {canEquip} from './loot.mjs';
// Presentation-only base outfits; these never grant items or equipment stats.
export const CLASS_CLOTHING=Object.freeze({mage:'gear-1507113',warrior:'gear-0507416',ranger:'gear-0507416'});
export function presentationClothing(manifest,hero){return manifest.items?.[CLASS_CLOTHING[hero]]?.overlays?.[hero]?.src||null;}
export function rearPaperdollItem(item){
  // Use the native catalog identity, not randomized loot names or rarity prefixes.
  return ITEM_CATALOG[item?.icon]?.slot==='armor'&&/\b(?:cloak|cape|wings)\b/i.test(ITEM_CATALOG[item.icon].name);
}
export function paperdollLayers(manifest,hero,equipment={}){
  const doll=manifest.paperdolls[hero]||manifest.paperdolls.mage;
  const gear=['boots','armor','bracers','gloves','helm','weapon','shield','ring','amulet'].flatMap(slot=>{
    const item=equipment[slot];if(!item||!canEquip(item,hero))return [];
    const src=manifest.items[item.icon]?.overlays?.[hero]?.src||(item.icon===slot?doll.overlays?.[slot]?.src:null);
    return src?[{kind:'equipment',slot,src,back:rearPaperdollItem(item)}]:[];
  });
  const armor=equipment.armor,clothing=(!armor||!canEquip(armor,hero)||rearPaperdollItem(armor))&&presentationClothing(manifest,hero);
  // Footwear sits over the body but under robe hems, including the base outfit.
  return [...gear.filter(layer=>layer.back),{kind:'body',src:doll.src},...gear.filter(layer=>layer.slot==='boots'),...(clothing?[{kind:'clothing',src:clothing}]:[]),...gear.filter(layer=>!layer.back&&layer.slot!=='boots')];
}
export function classPortraitLayers(manifest,hero){
  const kit={mage:['gear-0006405','gear-1301513'],warrior:['gear-0212130','gear-0206110','gear-0001004','gear-0002002'],ranger:['gear-0212129','gear-0006006','gear-0901121']};
  return [manifest.paperdolls[hero].src,presentationClothing(manifest,hero),...kit[hero].map(id=>manifest.items?.[id]?.overlays?.[hero]?.src)].filter(Boolean);
}
