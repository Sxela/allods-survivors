const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = __dirname;
const port=Number(process.env.ALLODS_PORT||17832);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'application/javascript','.js':'application/javascript','.json':'application/json','.png':'image/png','.wav':'audio/wav','.ttf':'font/ttf'};
const server = http.createServer((req,res)=>{
  if(req.url==='/__health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('allods-survivors-v1');}
  let filename;
  try { filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)); }catch {res.writeHead(400);return res.end('Bad request');}
  if(filename===root)filename=path.join(root,'index.html');
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(filename,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(filename).pipe(res);
  });
});
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
