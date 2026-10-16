const path=require('node:path');
const {spawn}=require('node:child_process');
const {stage}=require('./stage-electron.cjs');
(async()=>{
  process.env.ELECTRON_CACHE=path.resolve(__dirname,'../.cache/electron');
  process.env.electron_config_cache=process.env.ELECTRON_CACHE;
  const {stage:directory}=await stage(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),[directory,...process.argv.slice(2)],{stdio:'inherit',env,windowsHide:true});
  child.on('error',error=>{console.error(error);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code||0;});
})().catch(error=>{console.error(error);process.exitCode=1;});
