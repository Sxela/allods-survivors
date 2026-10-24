const http = require('node:http');
const {createGameServer}=require('./http-server.cjs');
const {spawn}=require('node:child_process');
const port=Number(process.env.ALLODS_PORT||17832);
const server=createGameServer({root:__dirname,production:process.argv.includes('--production')});
const noOpen=process.argv.includes('--no-open');
function open(url){if(noOpen)return;if(process.platform==='win32')spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{stdio:'ignore',windowsHide:true}).unref();else spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'}).unref();}
server.on('error',err=>{
  if(err.code!=='EADDRINUSE'){console.error(err.message);process.exitCode=1;return;}
  http.get(`http://127.0.0.1:${port}/__health`,res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>{if(body==='allods-survivors-v1'){const url=`http://127.0.0.1:${port}/`;console.log(`Game already running: ${url}`);open(url);}else{console.error(`Port ${port} is in use by another program. Set ALLODS_PORT to choose another port.`);process.exitCode=1;}});}).on('error',e=>{console.error(e.message);process.exitCode=1;});
});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${server.address().port}/`;
  console.log(`Allods Survivors: ${url}\nKeep this window open while playing. Ctrl+C stops the server.`);
  open(url);
});
