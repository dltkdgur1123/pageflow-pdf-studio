export function parseRange(text,total){
 if(!text.trim())throw new Error('페이지 범위를 입력하세요. 예: 1, 3-5');
 const result=new Set();for(const token of text.split(',')){const m=token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)throw new Error('범위 형식을 확인하세요. 예: 1, 3-5');const a=Number(m[1]),b=Number(m[2]||m[1]);if(a<1||b<a||b>total)throw new Error(`1~${total} 사이의 오름차순 범위를 입력하세요.`);for(let n=a;n<=b;n++)result.add(n-1);}return [...result];
}
export function moveSelection(pages,selected,direction){const result=[...pages];if(direction<0){for(let i=1;i<result.length;i++)if(selected.has(result[i].id)&&!selected.has(result[i-1].id))[result[i-1],result[i]]=[result[i],result[i-1]];}else{for(let i=result.length-2;i>=0;i--)if(selected.has(result[i].id)&&!selected.has(result[i+1].id))[result[i],result[i+1]]=[result[i+1],result[i]];}return result;}
export function moveBefore(pages,selected,target){if(selected.has(target))return pages;const moving=pages.filter(p=>selected.has(p.id)),rest=pages.filter(p=>!selected.has(p.id));const index=rest.findIndex(p=>p.id===target);if(index<0)return pages;return [...rest.slice(0,index),...moving,...rest.slice(index)];}
export async function buildPDF(PDFLib,sources,pages){if(!pages.length)throw new Error('내보낼 페이지가 없습니다.');const out=await PDFLib.PDFDocument.create();const loaded=new Map();for(const p of pages){if(p.drawing?.flattened){const d=p.drawing,copy=out.addPage([d.width,d.height]);const image=await out.embedPng(d.flattened);copy.drawImage(image,{x:0,y:0,width:d.width,height:d.height});copy.setRotation(PDFLib.degrees(((p.rotation-(d.pageRotation||0))%360+360)%360));continue;}if(!loaded.has(p.source))loaded.set(p.source,await PDFLib.PDFDocument.load(sources.get(p.source).bytes));const [copy]=await out.copyPages(loaded.get(p.source),[p.index]);copy.setRotation(PDFLib.degrees((copy.getRotation().angle+p.rotation)%360));if(p.drawing?.png){const d=p.drawing,image=await out.embedPng(d.png);copy.drawImage(image,{x:d.x,y:d.y,width:d.width,height:d.height,rotate:PDFLib.degrees(d.angle)});}out.addPage(copy);}return out.save();}


// Map normalized search ranges back to PDF-space quadrilaterals.
// Tesseract can attach the rest of a Korean word to the final symbol's box.
// Keep single CJK glyph boxes within the size of their neighbouring glyphs.
export function ocrSymbolBounds(token,symbols){
 const b=token.bbox;if(!b)return null;
 if(!/^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(token.text||''))return b;
 const height=b.y1-b.y0;
 const widths=symbols.filter(s=>s!==token&&s.bbox&&/^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(s.text||''))
  .map(s=>s.bbox.x1-s.bbox.x0).filter(w=>w>height*.45&&w<height*1.4).sort((a,b)=>a-b);
 const expected=widths.length?widths[Math.floor(widths.length/2)]:height;
 const next=symbols.filter(s=>s.bbox&&s.bbox.x0>b.x0&&Math.abs(s.bbox.y0-b.y0)<height*.5).map(s=>s.bbox.x0).sort((a,b)=>a-b)[0];
 const end=Math.min(b.x1,next??Infinity);
 return {...b,x1:Math.min(end,b.x0+((end-b.x0)>expected*1.5?expected:end-b.x0))};
}
export function textHighlightQuads(runs,query){
 const normalize=s=>s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');
 const needle=normalize(query);if(!needle)return [];
 const spans=[];let text='';
 for(const run of runs){
  const chars=Array.from(run.text||'');
  for(let i=0;i<chars.length;i++){
   const value=normalize(chars[i]);
   for(let j=0;j<value.length;j++){spans.push({run,start:i/chars.length,end:(i+1)/chars.length});text+=value[j];}
  }
 }
 const result=[];
 for(let at=text.indexOf(needle);at!==-1;at=text.indexOf(needle,at+Math.max(1,needle.length))){
  const portions=new Map();
  for(let j=at;j<at+needle.length;j++){const span=spans[j];if(!span)continue;const prior=portions.get(span.run);portions.set(span.run,{start:prior?Math.min(prior.start,span.start):span.start,end:prior?Math.max(prior.end,span.end):span.end});}
  for(const [run,part] of portions){
   const q=run.quad;if(!q||q.length!==4)continue;
   const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   result.push([mix(q[0],q[1],part.start),mix(q[0],q[1],part.end),mix(q[3],q[2],part.end),mix(q[3],q[2],part.start)]);
  }
 }
 return result;
}

// Local, bounded inpainting. The caller supplies a brush mask, never the whole page.
// Colour mode protects neutral print and restores the dominant ink hue in the mask.
export function restorePixels(image, brush, colourOnly=true){
 const {width:w,height:h,data}=image,n=w*h,result=new Uint8ClampedArray(data),mask=new Uint8Array(n),bins=new Uint32Array(24);
 const hue=(r,g,b)=>{const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(d<18)return -1;let v=max===r?(g-b)/d:max===g?2+(b-r)/d:4+(r-g)/d;return (v*60+360)%360;};
 for(let i=0;i<n;i++)if(brush[i]>0){const j=i*4,v=hue(data[j],data[j+1],data[j+2]);if(v>=0&&Math.max(data[j],data[j+1],data[j+2])-Math.min(data[j],data[j+1],data[j+2])>=45)bins[Math.floor(v/15)]++;}
 let dominant=0;for(let b=1;b<24;b++)if(bins[b]>bins[dominant])dominant=b;
 if(colourOnly&&!bins[dominant])return {data:result,count:0};
 let count=0;for(let i=0;i<n;i++)if(brush[i]>0){const j=i*4,v=hue(data[j],data[j+1],data[j+2]),delta=Math.abs(v-(dominant*15+7.5));if(!colourOnly||(v>=0&&Math.min(delta,360-delta)<40)){mask[i]=1;count++;}}
 if(!count)return {data:result,count:0};
 // Never use the remaining ink (or previously synthesized pixels) as paper.
 // Broad printed colour blocks can extend beyond the brush and the crop.
 if(colourOnly){
  const samples=[[],[],[]];
  for(let i=0;i<n;i++){const j=i*4,max=Math.max(data[j],data[j+1],data[j+2]),min=Math.min(data[j],data[j+1],data[j+2]);if(!mask[i]&&min>=160&&max-min<40)for(let c=0;c<3;c++)samples[c].push(data[j+c]);}
  if(samples[0].length<8)return {data:result,count:0,reason:'no-background'};
  const paper=samples.map(values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)];});
  for(let i=0;i<n;i++)if(mask[i]){
   let rgb=paper;const x=i%w,y=Math.floor(i/w);
   // Continue a printed rule only when original dark pixels support both ends.
   for(const [dx,dy] of [[1,0],[0,1]]){const ends=[];for(const sign of [-1,1]){for(let d=1;d<=12;d++){const xx=x+dx*d*sign,yy=y+dy*d*sign;if(xx<0||xx>=w||yy<0||yy>=h)break;const k=yy*w+xx;if(mask[k])continue;const j=k*4,max=Math.max(data[j],data[j+1],data[j+2]),min=Math.min(data[j],data[j+1],data[j+2]);if(max<120&&max-min<25)ends.push(j);break;}}if(ends.length===2&&[0,1,2].every(c=>Math.abs(data[ends[0]+c]-data[ends[1]+c])<15)){rgb=[0,1,2].map(c=>(data[ends[0]+c]+data[ends[1]+c])/2);break;}}
   for(let c=0;c<3;c++)result[i*4+c]=rgb[c];
  }
  return {data:result,count};
 }
 const known=new Uint8Array(n);for(let i=0;i<n;i++)known[i]=mask[i]?0:1;
 const pending=[];for(let i=0;i<n;i++)if(mask[i])pending.push(i);
 const dirs=[[1,0],[0,1],[1,1],[1,-1]];let remaining=pending;
 while(remaining.length){const fills=[],next=[];
  for(const i of remaining){const x=i%w,y=Math.floor(i/w);let best=null,score=Infinity;
   for(const [dx,dy] of dirs){let a=-1,b=-1,da=0,db=0;for(let d=1;d<=12;d++){const ax=x-dx*d,ay=y-dy*d;if(ax<0||ax>=w||ay<0||ay>=h)break;const k=ay*w+ax;if(known[k]){a=k;da=d;break;}}for(let d=1;d<=12;d++){const bx=x+dx*d,by=y+dy*d;if(bx<0||bx>=w||by<0||by>=h)break;const k=by*w+bx;if(known[k]){b=k;db=d;break;}}if(a<0||b<0)continue;let diff=0;for(let c=0;c<3;c++)diff+=Math.abs(result[a*4+c]-result[b*4+c]);const supportedLine=(dx===0||dy===0)&&!mask[a]&&!mask[b]&&diff<30&&[a,b].every(k=>Math.max(result[k*4],result[k*4+1],result[k*4+2])<120);const cost=diff+da+db-(supportedLine?80:0);if(cost<score){score=cost;best=[0,1,2].map(c=>(result[a*4+c]*db+result[b*4+c]*da)/(da+db));}}
   if(!best){let sum=[0,0,0],total=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const k=yy*w+xx;if(known[k]){total++;for(let c=0;c<3;c++)sum[c]+=result[k*4+c];}}if(total)best=sum.map(v=>v/total);}
   if(best)fills.push([i,best]);else next.push(i);
  }
  if(!fills.length)break;for(const [i,rgb] of fills){known[i]=1;for(let c=0;c<3;c++)result[i*4+c]=rgb[c];result[i*4+3]=255;}remaining=next;
 }
 return {data:result,count:count-remaining.length};
}
