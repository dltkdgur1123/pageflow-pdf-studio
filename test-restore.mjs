import assert from 'node:assert/strict';
import {restorePixels,buildPDF} from './dist/core.mjs';
import * as lib from 'pdf-lib';
const width=80,height=60,data=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const j=(y*width+x)*4;data.set([238,230,211,255],j);if(y===30)data.set([30,30,30,255],j);if(x>=37&&x<=42&&y>12&&y<48)data.set([185,35,42,255],j);if(x>=32&&x<=47&&y>=8&&y<=52)mask[y*width+x]=255;}
const input=data.slice(),out=restorePixels({width,height,data},mask,true);assert(out.count>100);assert.deepEqual(data,input);
for(let x=0;x<width;x++)assert.deepEqual([...out.data.slice((30*width+x)*4,(30*width+x)*4+4)],[30,30,30,255]);
assert.deepEqual([...out.data.slice((20*width+40)*4,(20*width+40)*4+4)],[238,230,211,255]);
assert.deepEqual([...out.data.slice(0,4)],[238,230,211,255]);
const empty=restorePixels({width,height,data},new Uint8Array(width*height),true);assert.equal(empty.count,0);assert.deepEqual(empty.data,data);
// A brush inside a large purple banner must not pull purple from outside it.
const banner=data.slice(),bm=new Uint8Array(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){banner.set(y>=15&&y<45?[157,40,148,255]:[238,230,211,255],(y*width+x)*4);if(x>=15&&x<65&&y>=20&&y<40)bm[y*width+x]=255;}
const clean=restorePixels({width,height,data:banner},bm,true);
for(let i=0;i<bm.length;i++)assert.deepEqual([...clean.data.slice(i*4,i*4+4)],bm[i]?[238,230,211,255]:[...banner.slice(i*4,i*4+4)]);
const noPaper=new Uint8ClampedArray(banner.length);for(let i=0;i<bm.length;i++)noPaper.set([157,40,148,255],i*4);
assert.equal(restorePixels({width,height,data:noPaper},bm,true).count,0);
const gray=data.slice();for(let y=18;y<24;y++)for(let x=20;x<25;x++)gray.set([20,20,20,255],(y*width+x)*4);const gm=new Uint8Array(width*height);for(let y=18;y<24;y++)for(let x=20;x<25;x++)gm[y*width+x]=255;
assert.equal(restorePixels({width,height,data:gray},gm,true).count,0);assert(restorePixels({width,height,data:gray},gm,false).count>0);
// Restored exports must contain a replacement image, not hidden source text.
const original=await lib.PDFDocument.create();original.addPage([300,500]).drawText('ORIGINAL_HANDWRITING');const bytes=await original.save();
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO2cAAAAASUVORK5CYII=';
for(const rotation of [0,90,180,270]){const result=await buildPDF(lib,new Map([['a',{bytes}]]),[{source:'a',index:0,rotation,drawing:{flattened:png,width:300,height:500,pageRotation:0}}]);const doc=await lib.PDFDocument.load(result);assert.equal(doc.getPageCount(),1);assert.equal(doc.getPage(0).getRotation().angle,rotation);const fonts=doc.getPage(0).node.Resources().lookup(lib.PDFName.of('Font'));assert(!fonts||fonts.keys().length===0);}
console.log('PASS: non-white background restoration, neutral print protection, brush boundaries, immutable input, black ink mode, replacement export and 4 rotations.');

