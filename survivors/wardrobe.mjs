// Presentation-only base outfits; these never grant items or equipment stats.
export const CLASS_CLOTHING=Object.freeze({mage:'gear-1507113',warrior:'gear-0507416',ranger:'gear-0507416'});
export function presentationClothing(manifest,hero){return manifest.items?.[CLASS_CLOTHING[hero]]?.overlays?.[hero]?.src||null;}
export function classPortraitLayers(manifest,hero){
  const kit={mage:['gear-0006405','gear-1301513'],warrior:['gear-0212130','gear-0206110','gear-0001004','gear-0002002'],ranger:['gear-0212129','gear-0006006','gear-0901121']};
  return [manifest.paperdolls[hero].src,presentationClothing(manifest,hero),...kit[hero].map(id=>manifest.items?.[id]?.overlays?.[hero]?.src)].filter(Boolean);
}
