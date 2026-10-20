const {app,BrowserWindow,Menu,protocol,session,dialog,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {serveAsset}=require('./protocol.cjs');
const SAVE_KEY='allods-survivors-v1';
const profileIndex=process.argv.indexOf('--profile-dir');
if(profileIndex>=0&&process.argv[profileIndex+1])app.setPath('userData',path.resolve(process.argv[profileIndex+1]));
else app.setPath('userData',path.join(app.getPath('appData'),'AllodsSurvivors'));
app.setName('Allods Survivors');
protocol.registerSchemesAsPrivileged([{scheme:'allods',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
let window;
const pauseForDialog=async()=>{
  if(!window||window.isDestroyed())return;
  await window.webContents.executeJavaScript("if(window.survivors?.world?.status==='playing')document.querySelector('#pause-button').click()");
};
async function exportSave(){
  await pauseForDialog();const raw=await window.webContents.executeJavaScript(`localStorage.getItem('${SAVE_KEY}')`);
  if(!raw){await dialog.showMessageBox(window,{message:'There is no saved progress to export yet.'});return;}
  const result=await dialog.showSaveDialog(window,{title:'Export progress',defaultPath:'Allods-Survivors-save.json',filters:[{name:'Game save',extensions:['json']}]});
  if(!result.canceled)await fs.writeFile(result.filePath,raw,'utf8');
}
async function importSave(){
  await pauseForDialog();const result=await dialog.showOpenDialog(window,{title:'Import progress',properties:['openFile'],filters:[{name:'Game save',extensions:['json']}]});
  if(result.canceled)return;const file=result.filePaths[0];if((await fs.stat(file)).size>4_000_000)throw new Error('Save file is too large.');
  const save=JSON.parse(await fs.readFile(file,'utf8'));
  if(!save||typeof save!=='object'||Array.isArray(save)||!save.inventory||!Number.isFinite(save.gold)||save.gold<0)throw new Error('This is not an Allods Survivors save.');
  const confirm=await dialog.showMessageBox(window,{type:'question',buttons:['Cancel','Import'],defaultId:0,cancelId:0,message:'Replace desktop progress with this save?',detail:'The active run will end. Export your current save first if you want a backup.'});
  if(confirm.response!==1)return;
  await window.webContents.executeJavaScript(`localStorage.setItem('${SAVE_KEY}',${JSON.stringify(JSON.stringify(save))});location.reload()`);
}
const action=fn=>()=>fn().catch(error=>dialog.showErrorBox('Allods Survivors',error.message));
function createWindow(){
  if(process.argv.includes('--smoke-test'))console.log('Desktop: creating game window');
  window=new BrowserWindow({title:'Allods Survivors',width:1080,height:840,minWidth:640,minHeight:640,backgroundColor:'#050806',show:false,icon:path.join(__dirname,'game/assets/portrait-dragon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,offscreen:process.argv.includes('--smoke-test'),backgroundThrottling:!process.argv.includes('--smoke-test')}});
  window.webContents.setWindowOpenHandler(({url})=>{
    if(['https://github.com/Sxela/allods-survivors','https://github.com/Sxela/regis'].includes(url))shell.openExternal(url).catch(error=>console.error('Could not open project link:',error.message));
    return {action:'deny'};
  });
  window.webContents.on('will-navigate',(event,address)=>{if(address!=='allods://game/index.html'&&address!=='allods://game/')event.preventDefault();});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.webContents.on('did-fail-load',(_event,code,description)=>console.error('Game load failed:',code,description));
  window.once('ready-to-show',()=>{if(!process.argv.includes('--smoke-test'))window.show();});
  window.on('closed',()=>{window=null;});
  window.loadURL('allods://game/index.html');
}
if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(()=>{
    if(process.argv.includes('--smoke-test'))console.log('Desktop: application ready');
    app.setAppUserModelId('local.allods.survivors');
    protocol.handle('allods',request=>serveAsset(path.join(__dirname,'game'),request));
    session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Game',submenu:[{label:'Export progress…',click:action(exportSave)},{label:'Import progress…',click:action(importSave)},{type:'separator'},{role:'quit'}]},
      {label:'View',submenu:[{role:'togglefullscreen',accelerator:'F11'},{role:'reload'},{role:'resetZoom'},{role:'toggleDevTools'}]}
    ]));
    createWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
  }).catch(error=>{dialog.showErrorBox('Could not start Allods Survivors',error.message);app.quit();});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
