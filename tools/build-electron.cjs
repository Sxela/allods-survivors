const path=require('node:path');
const {spawn}=require('node:child_process');
const {stage}=require('./stage-electron.cjs');
function buildPlatform(args=[],host=process.platform){
  if(args.includes('--win')&&args.includes('--linux'))throw Error('Build one platform at a time.');
  const platform=args.includes('--win')?'win32':args.includes('--linux')?'linux':host;
  if(!['win32','linux'].includes(platform))throw Error('Choose --win or --linux.');
  return platform;
}
function builderArguments(args=[],host=process.platform){
  for(const arg of args)if(!['--win','--linux','--dir'].includes(arg))throw Error(`Unsupported build argument: ${arg}`);
  return ['--config',path.join(__dirname,'../electron-builder.json'),buildPlatform(args,host)==='linux'?'--linux':'--win','--x64','--publish','never',...(args.includes('--dir')?['--dir']:[])];
}
function archivePath(platform){
  if(!['win32','linux'].includes(platform))throw Error('Unsupported archive platform');
  return `${platform==='linux'?'linux':'win'}-unpacked/resources/app.asar`;
}
async function build(args=process.argv.slice(2)){
  const platform=buildPlatform(args),builderArgs=builderArguments(args);
  await stage();
  process.env.electron_config_cache=path.resolve(__dirname,'../.cache/electron');require('electron');
  const root=path.resolve(__dirname,'..'),env={...process.env,ELECTRON_CACHE:path.join(root,'.cache/electron'),electron_config_cache:path.join(root,'.cache/electron'),ELECTRON_BUILDER_CACHE:path.join(root,'.cache/electron-builder')};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(process.execPath,[require.resolve('electron-builder/cli.js'),...builderArgs],{stdio:'inherit',env,windowsHide:true,cwd:root});
  child.on('error',error=>{console.error(error);process.exitCode=1;});child.on('exit',code=>{
    if(code!==0){process.exitCode=code||1;return;}
    const audit=spawn(process.execPath,[path.join(root,'tools/audit-electron.cjs'),platform==='linux'?'--linux':'--win'],{stdio:'inherit',env,windowsHide:true,cwd:root});
    audit.on('error',error=>{console.error(error);process.exitCode=1;});audit.on('exit',auditCode=>{process.exitCode=auditCode||0;});
  });
}
module.exports={buildPlatform,builderArguments,archivePath};
if(require.main===module)build().catch(error=>{console.error(error);process.exitCode=1;});
