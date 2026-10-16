export function opaqueBounds(pixels,width,height){
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return right<left?{left:0,top:0,width,height}:{left,top,width:right-left+1,height:bottom-top+1};
}
export function playerVitalLayout(player,metrics={height:62,width:40}){
  return {x:Math.round(player.x-24),y:Math.round(player.y-metrics.height-17),width:48,height:5,health:Math.max(0,Math.min(1,player.hp/Math.max(1,player.maxHp)))};
}
export function drawPlayerVitals(ctx,player,metrics){
  const bar=playerVitalLayout(player,metrics);ctx.save();
  ctx.fillStyle='#080d0c';ctx.fillRect(bar.x-2,bar.y-2,bar.width+4,bar.height+4);
  ctx.strokeStyle='#bba77c';ctx.lineWidth=1;ctx.strokeRect(bar.x-1.5,bar.y-1.5,bar.width+3,bar.height+3);
  ctx.fillStyle='#3f211f';ctx.fillRect(bar.x,bar.y,bar.width,bar.height);
  ctx.fillStyle=bar.health<.3?'#ee6f53':'#9fc475';ctx.fillRect(bar.x,bar.y,Math.round(bar.width*bar.health),bar.height);
  const shield=player.statuses?.shield;
  if(shield?.ttl>0&&shield.pool>0){ctx.fillStyle='#132d42';ctx.fillRect(bar.x,bar.y+7,bar.width,2);ctx.fillStyle='#bbe6ff';ctx.fillRect(bar.x,bar.y+7,Math.round(bar.width*Math.min(1,shield.pool/(shield.maxPool||shield.pool))),2);}
  ctx.restore();return bar;
}
