export const MOBILE_BREAKPOINT=900;
export function mobileLayout(screenWidth,screenHeight){
  const mobile=screenHeight>screenWidth||screenWidth<=MOBILE_BREAKPOINT;
  const width=mobile?(screenHeight>screenWidth?600:800):800;
  return {mobile,width,height:mobile?Math.max(320,Math.round(width*screenHeight/screenWidth)):600};
}
export function joystickVector(dx,dy,radius,deadZone=.18){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {x:0,y:0,knobX:0,knobY:0};
  const distance=Math.hypot(dx,dy);if(!distance)return {x:0,y:0,knobX:0,knobY:0};
  const strength=Math.min(1,distance/radius),moving=strength>deadZone;
  return {x:moving?dx/distance:0,y:moving?dy/distance:0,knobX:dx/distance*strength,knobY:dy/distance*strength};
}
export function mountThumbstick(root,{enabled}){
  const element=document.createElement('div');element.id='mobile-joystick';element.setAttribute('role','group');
  element.setAttribute('aria-label','Movement joystick: drag to move, release to stop');
  element.innerHTML='<span class="joystick-knob" aria-hidden="true"></span>';root.append(element);
  const knob=element.querySelector('.joystick-knob');let pointerId=null,vector=joystickVector(0,0,1);
  function draw(){knob.style.left=(50+vector.knobX*32)+'%';knob.style.top=(50+vector.knobY*32)+'%';}
  function cancel(){const previous=pointerId;pointerId=null;vector=joystickVector(0,0,1);element.classList.remove('active');draw();if(previous!==null&&element.hasPointerCapture(previous))element.releasePointerCapture(previous);}
  function update(event){const bounds=element.getBoundingClientRect();vector=joystickVector(event.clientX-bounds.x-bounds.width/2,event.clientY-bounds.y-bounds.height/2,bounds.width*.32);draw();}
  element.addEventListener('pointerdown',event=>{
    if(!enabled()||pointerId!==null||event.button!==0)return;
    event.preventDefault();event.stopPropagation();pointerId=event.pointerId;element.setPointerCapture(pointerId);element.classList.add('active');update(event);
  });
  element.addEventListener('pointermove',event=>{if(event.pointerId!==pointerId)return;if(!enabled()){cancel();return;}event.preventDefault();update(event);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,event=>{if(event.pointerId===pointerId)cancel();});
  return {element,cancel,get active(){return pointerId!==null;},get input(){return {x:vector.x,y:vector.y};}};
}
