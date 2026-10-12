// Photo deformation is restricted to the fixed mouth patch.
export function mouthPatch(source,width,height,amount,pose={}) {
 const output=new Uint8ClampedArray(source);
 const opening=Math.max(0,Math.min(1,Number(amount)||0));
 const smile=Math.max(0,Math.min(1,Number(pose.smile)||0));
 const roundness=Math.max(0,Math.min(1,Number(pose.roundness)||0));
 if(!opening&&!smile)return output;
 const cx=width*.5,cy=height*.49,rx=width*(.44-.08*roundness*opening),ry=height*.46;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const nx=(x-cx)/rx,ny=(y-cy)/ry,feather=1-nx*nx-ny*ny;
  if(feather<=0)continue;
  const horizontal=Math.pow(Math.max(0,1-nx*nx),.9+roundness);
  const seam=cy-smile*height*.16*nx*nx;
  const gap=opening*height*.29*horizontal;
  const offset=gap*feather;
  const lift=smile*height*.30*nx*nx*feather;
  const sx=Math.max(0,Math.min(width-1,cx+(x-cx)/(1+(.06*opening*(1-roundness)+.10*smile)*feather)));
  const sy=Math.max(0,Math.min(height-1,y+(y<cy?offset:-offset)+lift));
  const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=sx-x0,fy=sy-y0;
  const index=(y*width+x)*4;
  for(let c=0;c<3;c++){
   const top=source[(y0*width+x0)*4+c]*(1-fx)+source[(y0*width+x1)*4+c]*fx;
   const bottom=source[(y1*width+x0)*4+c]*(1-fx)+source[(y1*width+x1)*4+c]*fx;
   output[index+c]=top*(1-fy)+bottom*fy;
  }
  const dy=y-seam,distance=Math.abs(dy);
  if(gap>.5&&distance<gap){
   const edge=Math.min(1,(gap-distance)/2);
   const upperTeeth=opening>.45&&dy< -gap*.52&&dy> -gap*.91;
   let inner=upperTeeth?[193,183,175]:dy>gap*.35?[71,29,38]:[41,21,28];
   // Sample Adnane's actual teeth/cavity from his supplied smiling photo.
   // Keep the photographed lip contour and surrounding face from the base portrait.
   const texture=pose.texture;
   if(texture?.data&&texture.width>0&&texture.height>0){
    const u=Math.max(0,Math.min(1,(nx+1)/2));
    const v=Math.max(0,Math.min(1,(dy/gap+1)/2));
    const tx=Math.min(texture.width-1,Math.round(u*(texture.width-1)));
    const ty=Math.min(texture.height-1,Math.round(v*(texture.height-1)));
    const ti=(ty*texture.width+tx)*4;
    inner=[texture.data[ti],texture.data[ti+1],texture.data[ti+2]];
   }
   for(let c=0;c<3;c++)output[index+c]=output[index+c]*(1-edge)+inner[c]*edge;
  }
 }
 return output;
}
