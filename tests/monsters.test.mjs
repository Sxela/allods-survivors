import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTERS,ENEMY_SPRITES,projectileVfxById,sampleMonsterFrame} from '../survivors/monsters.mjs';
const manifest=JSON.parse(readFileSync(new URL('../survivors/assets/manifest.json',import.meta.url)));

test('all 42 source monster identities have complete atlases and original projectile links',()=>{
  assert.equal(Object.keys(MONSTERS).length,42);
  assert.equal(MONSTERS.orc.name,'Orc Archer');
  assert.equal(MONSTERS.goblin.name,'Goblin');
  assert.notEqual(manifest.sprites.orc.src,manifest.sprites.goblin.src);
  assert.notEqual(manifest.sprites.troll.src,manifest.sprites.ogre.src);
  assert.equal(MONSTERS.orc.projectileVfx,'orc_arrow');
  assert.equal(MONSTERS.dragon.projectileVfx,'fireball');
  for(const [id,monster] of Object.entries(MONSTERS)){
    const atlas=manifest.sprites[id];
    assert.deepEqual(ENEMY_SPRITES[id],[atlas.cellWidth,atlas.cellHeight]);
    for(const animation of Object.values(monster.animation))assert.ok(animation.offset+(animation.stride||animation.phases)*(animation.directions-1)+animation.phases<=atlas.count,id);
    if(monster.projectileId)assert.ok(manifest.vfx[projectileVfxById[monster.projectileId]],id);
  }
});

test('source movement, attack and mirrored frames stay inside their state across directions',()=>{
  for(const [id,monster] of Object.entries(MONSTERS)){
    for(const action of Object.keys(monster.animation)){
      const descriptor=monster.animation[action];
      for(let direction=0;direction<32;direction++)for(const time of [0,.2,1,9,123.45]){
        const angle=direction*Math.PI/16;
        const {frame}=sampleMonsterFrame(id,action,Math.cos(angle),Math.sin(angle),time);
        assert.ok(frame>=descriptor.offset&&frame<descriptor.offset+(descriptor.directions-1)*(descriptor.stride||descriptor.phases)+descriptor.phases,`${id}/${action}/${direction}: ${frame}`);
        assert.ok((frame-descriptor.offset)%(descriptor.stride||descriptor.phases)<descriptor.phases,`${id}/${action} must stay out of the movement lead-in`);
      }
    }
  }
  assert.equal(sampleMonsterFrame('troll','walk',1,0,0).flipX,true);
  assert.equal(sampleMonsterFrame('troll','walk',-1,0,0).flipX,false);
  assert.deepEqual(sampleMonsterFrame('skeleton','walk',1,0,1),sampleMonsterFrame('skeleton_f1','walk',1,0,1));
});
