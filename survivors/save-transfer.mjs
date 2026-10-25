import {restoreRun} from './run-state.mjs';
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const MAX_SAVE_BYTES=4_000_000;
export function parseSaveImport(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_SAVE_BYTES)throw Error('Save files must be smaller than 4 MB.');
  let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''),(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error();return value;});}catch{throw Error('This file is not valid save JSON.');}
  if(!plain(data)||!plain(data.inventory)||!Number.isFinite(data.gold)||data.gold<0)throw Error('This is not an Allods Survivors save.');
  for(const key of ['best','runs'])if(data[key]!==undefined&&(!Number.isFinite(data[key])||data[key]<0))throw Error('The save contains invalid progress values.');
  if(data.upgrades!==undefined&&(!plain(data.upgrades)||!Object.values(data.upgrades).every(n=>Number.isFinite(n)&&n>=0)))throw Error('The save contains invalid upgrades.');
  if(data.inventory.bag!==undefined&&!Array.isArray(data.inventory.bag)||data.inventory.equipment!==undefined&&!plain(data.inventory.equipment)||data.shopStock!==undefined&&!Array.isArray(data.shopStock))throw Error('The save contains invalid inventory data.');
  if(data.run!=null&&!restoreRun(data.run))throw Error('The saved run could not be restored. Your current progress has not been changed.');
  return Object.fromEntries(['gold','best','runs','upgrades','inventory','shopGeneration','shopStock','difficulty','run'].filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]));
}
