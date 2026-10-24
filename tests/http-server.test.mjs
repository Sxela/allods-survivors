import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
const {createGameServer}=createRequire(import.meta.url)('../survivors/http-server.cjs');
function request(url,headers={},method='GET'){return new Promise((resolve,reject)=>{const req=http.request(url,{headers,method},res=>{const chunks=[];res.on('data',v=>chunks.push(v));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});}
test('production serving compresses text, revalidates payloads and changes validators after updates',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'allods-http-')),text='const sprite = 1;\n'.repeat(100);await writeFile(path.join(root,'game.mjs'),text);
 const server=createGameServer({root,production:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/game.mjs`;
 try{
  const first=await request(url,{'Accept-Encoding':'gzip'});assert.equal(first.status,200);assert.equal(first.headers['content-encoding'],'gzip');assert.equal(gunzipSync(first.body).toString(),text);
  const cached=await request(url,{'Accept-Encoding':'gzip','If-None-Match':first.headers.etag});assert.equal(cached.status,304);assert.equal(cached.body.length,0);
  const raw=await request(url,{'Accept-Encoding':'gzip;q=0'});assert.equal(raw.headers['content-encoding'],undefined);assert.equal(raw.body.toString(),text);assert.notEqual(raw.headers.etag,first.headers.etag);
  const immutable=await request(url+'?v='+raw.headers.etag.slice(1,-1));assert.match(immutable.headers['cache-control'],/immutable/);
  await writeFile(path.join(root,'game.mjs'),'updated');const changed=await request(url,{'If-None-Match':raw.headers.etag});assert.equal(changed.status,200);assert.notEqual(changed.headers.etag,raw.headers.etag);
  assert.equal((await request(url,{},'HEAD')).body.length,0);assert.equal((await request(url,{},'POST')).status,405);
  assert.equal((await request(url.replace('game.mjs','%2e%2e%2fprivate.json'))).status,403);assert.equal((await request(url.replace('game.mjs','missing.png'))).status,404);
 }finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
});
