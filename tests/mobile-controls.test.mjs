import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../survivors/core.mjs';
import {mobileLayout,joystickVector,normalizeControls,zoomViewport,screenSteering} from '../survivors/mobile-controls.mjs';
import {battlefieldSize} from '../survivors/vanilla-hud.mjs';
const scene=()=>{const world=new World();world.skills={};world.enemies=[];world.spawnTimer=Infinity;world.player.invulnerable=1000;return world;};
test('mobile mode fills portrait/narrow screens and reserves safe-area space',()=>{
 assert.deepEqual(mobileLayout(1600,900),{mobile:false,width:800,height:600});assert.deepEqual(mobileLayout(390,844),{mobile:true,width:600,height:1298});
 assert.equal(mobileLayout(844,390).mobile,true);assert.equal(mobileLayout(1000,1400).mobile,true);
 assert.deepEqual(battlefieldSize(600,1298,true),{width:600,height:1218});assert.deepEqual(battlefieldSize(600,1298,true,40),{width:600,height:1178});assert.deepEqual(battlefieldSize(800,600),{width:640,height:536});
});
test('thumbstick dead zone prevents drift while retaining small knob feedback',()=>{
 assert.deepEqual(joystickVector(0,0,50),{x:0,y:0,knobX:0,knobY:0});const v=joystickVector(5,0,50);assert.equal(v.x,0);assert.equal(v.y,0);assert.equal(v.knobX,.1);
 assert.equal(joystickVector(9,0,50).x,0);assert.equal(joystickVector(10,0,50).x,1);
});
test('thumbstick clamps visual travel and normalizes diagonal movement beyond the base',()=>{
 const v=joystickVector(300,-400,50);assert.equal(v.x,.6);assert.equal(v.y,-.8);assert.equal(v.knobX,.6);assert.equal(v.knobY,-.8);assert.equal(Math.hypot(v.x,v.y),1);
 const inside=joystickVector(15,20,50);assert.equal(inside.knobX,.3);assert.equal(inside.knobY,.4);
});
test('invalid joystick samples never introduce non-finite movement',()=>{
 for(const args of [[NaN,0,50],[0,Infinity,50],[20,30,0],[20,30,-1],[20,30,NaN]])assert.deepEqual(joystickVector(...args),{x:0,y:0,knobX:0,knobY:0});
});
test('joystick movement has the same speed on cardinal and diagonal directions',()=>{
 const straight=scene(),diagonal=scene();for(let i=0;i<60;i++){straight.step(.016,joystickVector(50,0,50));diagonal.step(.016,joystickVector(50,50,50));}
 assert.ok(Math.abs(Math.hypot(diagonal.player.x,diagonal.player.y)-straight.player.x)<.0001);
 const stopped={x:straight.player.x,y:straight.player.y};for(let i=0;i<20;i++)straight.step(.016,joystickVector(0,0,50));assert.equal(straight.player.x,stopped.x);assert.equal(straight.player.y,stopped.y);
});
test('thumb movement respects existing Wall of Earth collision',()=>{
 const w=scene();w.fields=[{kind:'earthwall',x1:70,y1:-60,x2:70,y2:60,width:18,ttl:100}];for(let i=0;i<100;i++)w.step(.016,joystickVector(100,0,50));assert.ok(w.player.x>30&&w.player.x<50);
});

test('control preferences reject malformed values and clamp camera zoom',()=>{
 assert.deepEqual(normalizeControls({mode:'joystick'}),{mode:'joystick',zoom:1});assert.deepEqual(normalizeControls(null),{mode:'touch',zoom:1});assert.deepEqual(normalizeControls({mode:'touch',zoom:1.5}),{mode:'touch',zoom:1.5});
 assert.deepEqual(normalizeControls({mode:'bogus',zoom:Infinity}),{mode:'touch',zoom:1});assert.equal(normalizeControls({zoom:20}).zoom,2);assert.equal(normalizeControls({zoom:-2}).zoom,1);assert.equal(normalizeControls({zoom:1.3}).zoom,1.25);
});
test('zoom scales the actual world viewport while retaining HUD dimensions',()=>{
 const screen=battlefieldSize(600,1298,true);assert.deepEqual(zoomViewport(screen,1.5),{width:400,height:812});assert.deepEqual(zoomViewport(screen,2),{width:300,height:609});assert.deepEqual(zoomViewport(screen,1),screen);
});
test('full-screen steering uses the on-screen hero center even when camera zoom changes',()=>{
 const screen=battlefieldSize(600,1298,true);assert.deepEqual(screenSteering(300,609,screen),{x:0,y:0});assert.deepEqual(screenSteering(310,609,screen),{x:0,y:0});
 assert.deepEqual(screenSteering(400,609,screen),{x:100,y:0});assert.deepEqual(screenSteering(300,409,screen),{x:0,y:-200});
});
