import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainMesh} from '../survivors/terrain-renderer.mjs';
import {terrainElevation,terrainNormal,landscapeFeatures,TERRAIN_MESH_STEP} from '../survivors/landscape.mjs';

test('3D terrain chunks share identical positions and smooth normals along their boundaries',()=>{
  const a=terrainMesh(-3,4),b=terrainMesh(-2,4),n=128/TERRAIN_MESH_STEP;
  for(let y=0;y<=n;y++){
    const ai=(y*(n+1)+n)*8,bi=y*(n+1)*8;
    assert.deepEqual(a.vertices.slice(ai,ai+3),b.vertices.slice(bi,bi+3));
    assert.deepEqual(a.vertices.slice(ai+5,ai+8),b.vertices.slice(bi+5,bi+8));
  }
  assert.equal(a.indices.length,n*n*6);assert.ok(a.indices.every(i=>i<a.vertices.length/8));
});

test('sprite feet use the exact rendered triangle height, including the diagonal and negative cells',()=>{
  for(const [cx,cy] of [[3,4],[-4,-5]]){
    const mesh=terrainMesh(cx,cy),n=128/TERRAIN_MESH_STEP;
    for(const [u,v] of [[.2,.3],[.7,.8],[.4,.6]]){
      const x=3,y=4,a=(y*(n+1)+x)*8,b=a+8,c=a+(n+1)*8,d=c+8;
      const z=u+v<=1?mesh.vertices[a+2]*(1-u-v)+mesh.vertices[b+2]*u+mesh.vertices[c+2]*v:mesh.vertices[d+2]*(u+v-1)+mesh.vertices[c+2]*(1-u)+mesh.vertices[b+2]*(1-v);
      assert.ok(Math.abs(z-terrainElevation(cx*128+(x+u)*16,cy*128+(y+v)*16))<1e-5);
    }
  }
});

test('broad landforms have smoothly varying normalized surface normals',()=>{
  const hills=landscapeFeatures({left:-1800,right:1800,top:-1800,bottom:1800}).filter(f=>f.kind==='hill');
  assert.ok(hills.every(f=>f.rx>=300&&f.ry>=230));
  for(const hill of hills)for(let x=-hill.rx;x<hill.rx;x+=25){
    const a=terrainNormal(hill.x+x,hill.y),b=terrainNormal(hill.x+x+.1,hill.y);
    assert.ok(Math.abs(Math.hypot(...a)-1)<1e-10);assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<.01);
  }
});
