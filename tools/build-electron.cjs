const path=require('node:path');
const {spawn}=require('node:child_process');
const {stage}=require('./stage-electron.cjs');
(async()=>{
  await stage();
  process.env.electron_config_cache=path.resolve(__dirname,'../.cache/electron');require('electron');
  const root=path.resolve(__dirname,'..'),env={...process.env,ELECTRON_CACHE:path.join(root,'.cache/electron'),electron_config_cache:path.join(root,'.cache/electron'),ELECTRON_BUILDER_CACHE:path.join(root,'.cache/electron-builder')};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(process.execPath,[require.resolve('electron-builder/cli.js'),'--config',path.join(root,'electron-builder.json'),'--win','--x64',...process.argv.slice(2)],{stdio:'inherit',env,windowsHide:true,cwd:root});
  child.on('error',error=>{console.error(error);process.exitCode=1;});child.on('exit',code=>{
    if(code!==0){process.exitCode=code||1;return;}
    const audit=spawn(process.execPath,[path.join(root,'tools/audit-electron.cjs')],{stdio:'inherit',env,windowsHide:true,cwd:root});
    audit.on('error',error=>{console.error(error);process.exitCode=1;});audit.on('exit',auditCode=>{process.exitCode=auditCode||0;});
  });
})().catch(error=>{console.error(error);process.exitCode=1;});
