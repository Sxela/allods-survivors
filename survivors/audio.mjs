// Original local WAV playback with per-event throttling and bounded overlap.
export class GameAudio {
  constructor(manifest){this.manifest=manifest;this.enabled=true;this.context=null;this.buffers=new Map();this.pending=new Map();this.last=new Map();this.voices=new Set();this.scene='menu';this.ambientSource=null;this.ambientGain=null;this.played=new Set();}
  unlock(){
    if(!this.context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.enabled?.7:0;this.master.connect(this.context.destination);}
    if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    this.ensureAmbience();
  }
  setEnabled(enabled){this.enabled=enabled;if(this.master)this.master.gain.setTargetAtTime(enabled?.7:0,this.context.currentTime,.04);if(enabled)this.unlock();}
  setScene(scene){this.scene=scene;if(this.ambientGain)this.ambientGain.gain.setTargetAtTime(scene==='playing'?.075:scene==='hidden'?0:.025,this.context.currentTime,.3);this.ensureAmbience();}
  async load(id){
    if(this.buffers.has(id))return this.buffers.get(id);if(this.pending.has(id))return this.pending.get(id);
    const entry=this.manifest.sounds[id];if(!entry||!this.context)return null;
    const pending=(async()=>{try{const response=await fetch(entry.src);if(!response.ok)throw Error(`Cannot load sound ${id}`);const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(id,buffer);return buffer;}catch(error){console.warn(error.message);return null;}finally{this.pending.delete(id);}})();
    this.pending.set(id,pending);return pending;
  }
  async play(id,{volume=.3,interval=.09}={}){
    if(!this.enabled||!this.manifest.sounds[id])return false;this.unlock();if(!this.context)return false;
    const now=this.context.currentTime;if(now-(this.last.get(id)??-Infinity)<interval)return false;this.last.set(id,now);
    const buffer=await this.load(id);if(!buffer||!this.enabled||this.scene==='hidden'||this.voices.size>=12)return false;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};this.voices.add(source);source.start();this.played.add(id);return true;
  }
  async ensureAmbience(){
    if(!this.context||this.ambientSource||this.ambientLoading||!this.manifest.sounds.ambience)return;this.ambientLoading=true;
    const buffer=await this.load('ambience');this.ambientLoading=false;if(!buffer||this.ambientSource)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=this.scene==='playing'?.075:this.scene==='hidden'?0:.025;source.connect(gain);gain.connect(this.master);source.start();this.ambientSource=source;this.ambientGain=gain;
  }
}
