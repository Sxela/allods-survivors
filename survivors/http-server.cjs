// Shared local/production serving policy; no dependency on a developer checkout.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {promisify}=require('node:util'),gzip=promisify(zlib.gzip);
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.wav':'audio/wav','.ttf':'font/ttf'};
function createGameServer({root,production=false}={}){
 root=path.resolve(root);const representations=new Map();
 return http.createServer(async(req,res)=>{
  try{
   if(req.url==='/__health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('allods-survivors-v1');}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});return res.end();}
   const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
   if(name.includes('\\')||name.includes('\0')){res.writeHead(403);return res.end();}
   const filename=path.resolve(root,name==='/'?'index.html':'.'+name),relative=path.relative(root,filename),type=TYPES[path.extname(filename)];
   if(relative.startsWith('..')||path.isAbsolute(relative)||!relative||!type){res.writeHead(403);return res.end();}
   // Resolve links as well as lexical paths so serving cannot escape the selected root.
   const real=await fs.realpath(filename),relReal=path.relative(root,real);
   if(relReal.startsWith('..')||path.isAbsolute(relReal)){res.writeHead(403);return res.end();}
   const stat=await fs.stat(real);if(!stat.isFile()){res.writeHead(404);return res.end();}
   const fingerprint=`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;let asset=representations.get(real);
   if(!asset||asset.fingerprint!==fingerprint){
    const body=await fs.readFile(real),digest=crypto.createHash('sha256').update(body).digest('hex');
    asset={fingerprint,body,digest};
    // Bound the server cache; browsers still retain/revalidate their own payloads.
    if(representations.size>=128)representations.delete(representations.keys().next().value);
    representations.set(real,asset);
   }
   const compress=production&&/\b(?:text|application\/(?:javascript|json))/.test(type)&&asset.body.length>512&&/(?:^|[,\s])gzip(?:\s*;\s*q=(?!0(?:\.0*)?(?:\s|,|$))[\d.]+)?(?:\s|,|$)/.test(req.headers['accept-encoding']||'');
   let body=asset.body;if(compress){asset.gzip??=await gzip(body);body=asset.gzip;}
   const etag=`"${asset.digest}${compress?'-gzip':''}"`,headers={'Content-Type':type,'ETag':etag,'Cache-Control':production&&url.searchParams.get('v')===asset.digest?'public, max-age=31536000, immutable':'no-cache','Vary':'Accept-Encoding','X-Content-Type-Options':'nosniff'};
   if(compress)headers['Content-Encoding']='gzip';
   if((req.headers['if-none-match']||'').split(/\s*,\s*/).includes(etag)){res.writeHead(304,headers);return res.end();}
   headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);
  }catch(error){if(!res.headersSent)res.writeHead(['ENOENT','ENOTDIR'].includes(error.code)?404:error instanceof URIError?400:500);res.end('Asset unavailable');}
 });
}
module.exports={createGameServer};
