import {terrainElevation,terrainNormal,TERRAIN_MESH_STEP} from './landscape.mjs';

// Orthographic 3D ground, composited beneath the original upright sprite art.
export function terrainMesh(cx,cy,size=128){
  const vertices=[],indices=[],step=TERRAIN_MESH_STEP,n=size/step;
  for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
    const wx=cx*size+x*step,wy=cy*size+y*step;
    vertices.push(wx,wy,terrainElevation(wx,wy),x/n,y/n,...terrainNormal(wx,wy));
  }
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const a=y*(n+1)+x,b=a+1,c=a+n+1,d=c+1;indices.push(a,b,c,b,d,c);
  }
  return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices)};
}

export class TerrainRenderer{
  constructor(canvas){
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
    if(!this.gl)throw new Error('WebGL terrain unavailable');
    const gl=this.gl;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`
      attribute vec3 position; attribute vec2 uv; attribute vec3 normal;
      uniform vec2 camera; uniform vec2 viewport;
      varying vec2 texcoord; varying vec3 surfaceNormal;
      void main(){
        vec2 screen=vec2(position.x,position.y-position.z)-camera;
        gl_Position=vec4(screen.x*2.0/viewport.x,-screen.y*2.0/viewport.y,-position.z/1024.0,1.0);
        texcoord=uv;surfaceNormal=normal;
      }`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
      precision mediump float;
      uniform sampler2D ground; varying vec2 texcoord; varying vec3 surfaceNormal;
      void main(){
        vec3 n=normalize(vec3(surfaceNormal.xy*1.65,surfaceNormal.z));
        vec3 sun=normalize(vec3(-0.65,-0.8,0.5));
        float light=clamp(0.72+max(0.0,dot(n,sun)),0.72,1.55);
        vec3 color=texture2D(ground,texcoord).rgb;
        // Keep the biome texture continuous over slopes; repeating a single dirt
        // cell here stamps its distinctive markings into a grid across every hill.
        vec3 ambient=vec3(0.88,0.94,1.0);
        gl_FragColor=vec4(color*mix(ambient,vec3(1.06,1.02,0.92),clamp(light-0.45,0.0,1.0))*light,1.0);
      }`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    this.program=program;this.cache=new Map();
    this.camera=gl.getUniformLocation(program,'camera');this.viewport=gl.getUniformLocation(program,'viewport');
    this.attributes=['position','uv','normal'].map(name=>gl.getAttribLocation(program,name));
    gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'ground'),0);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);canvas.dataset.renderer='heightmap-webgl';
  }
  release(entry){const gl=this.gl;gl.deleteBuffer(entry.vertices);gl.deleteBuffer(entry.indices);gl.deleteTexture(entry.texture);}
  reset(){for(const entry of this.cache.values())this.release(entry);this.cache.clear();}
  draw(chunks,getTexture,camera,width,height){
    const gl=this.gl;if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clearColor(.045,.08,.06,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);gl.uniform2f(this.camera,camera.x,camera.y);gl.uniform2f(this.viewport,width,height);
    const live=new Set(chunks.map(c=>`${c.cx},${c.cy}`));
    for(const [key,entry] of this.cache)if(!live.has(key)){this.release(entry);this.cache.delete(key);}
    for(const chunk of chunks){
      if(chunk.cx*128>camera.x+width/2+32||(chunk.cx+1)*128<camera.x-width/2-32||chunk.cy*128>camera.y+height/2+192||(chunk.cy+1)*128<camera.y-height/2-192)continue;
      const key=`${chunk.cx},${chunk.cy}`;let entry=this.cache.get(key);
      if(!entry){
        const mesh=terrainMesh(chunk.cx,chunk.cy);entry={vertices:gl.createBuffer(),indices:gl.createBuffer(),texture:gl.createTexture(),revision:-1,count:mesh.indices.length};
        gl.bindBuffer(gl.ARRAY_BUFFER,entry.vertices);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,entry.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
        gl.bindTexture(gl.TEXTURE_2D,entry.texture);
        for(const parameter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.NEAREST);
        for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.CLAMP_TO_EDGE);
        this.cache.set(key,entry);
      }
      gl.bindTexture(gl.TEXTURE_2D,entry.texture);
      if(entry.revision!==chunk.revision){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,getTexture(chunk));entry.revision=chunk.revision;}
      gl.bindBuffer(gl.ARRAY_BUFFER,entry.vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,entry.indices);
      for(let i=0;i<3;i++){gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],i===1?2:3,gl.FLOAT,false,32,[0,12,20][i]);}
      gl.drawElements(gl.TRIANGLES,entry.count,gl.UNSIGNED_SHORT,0);
    }
  }
}
