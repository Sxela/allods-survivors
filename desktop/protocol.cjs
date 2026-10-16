const path=require('node:path');
const fs=require('node:fs/promises');
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.wav':'audio/wav','.ttf':'font/ttf'};
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'";
function resolveAsset(root,address){
  const url=new URL(address);
  if(url.protocol!=='allods:'||url.host!=='game')throw new Error('Invalid game origin');
  const requested=decodeURIComponent(url.pathname);
  if(requested.includes('\\')||requested.includes('\0')||requested.includes(':'))throw new Error('Invalid asset path');
  const filename=path.resolve(root,requested==='/'?'index.html':'.'+requested),relative=path.relative(root,filename);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!Object.hasOwn(TYPES,path.extname(filename)))throw new Error('Asset outside game');
  return filename;
}
async function serveAsset(root,request){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  let filename;try{filename=resolveAsset(root,request.url);}catch{return new Response('Forbidden',{status:403});}
  try{
    const body=await fs.readFile(filename);
    return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':TYPES[path.extname(filename)],'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Not found',{status:404});}
}
module.exports={resolveAsset,serveAsset};
