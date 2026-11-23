import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as lib from 'pdf-lib';
import {imageToPDF,buildPDF} from './dist/core.mjs';
const sources=new Map();
for(const [ext,type,size] of [['png','png',[480,300]],['jpg','jpeg',[300,450]]]){
 const input=readFileSync(new URL('./docs/samples/import-test.'+ext,import.meta.url));
 const original=Buffer.from(input);
 const pooled=Buffer.alloc(input.length+32,0);input.copy(pooled,17);
 const offsetBytes=await imageToPDF(lib,pooled.subarray(17,17+input.length),type);
 assert.equal((await lib.PDFDocument.load(offsetBytes)).getPageCount(),1);
 const bytes=await imageToPDF(lib,input,type);const doc=await lib.PDFDocument.load(bytes);
 assert.equal(doc.getPageCount(),1);assert.deepEqual([doc.getPage(0).getWidth(),doc.getPage(0).getHeight()],size);
 assert.deepEqual(input,original);sources.set(type,{bytes});
}
const pdf=await lib.PDFDocument.create();pdf.addPage([200,300]);sources.set('pdf',{bytes:await pdf.save()});
const merged=await lib.PDFDocument.load(await buildPDF(lib,sources,[{source:'jpeg',index:0,rotation:90},{source:'pdf',index:0,rotation:0},{source:'png',index:0,rotation:0}]));
assert.equal(merged.getPageCount(),3);assert.equal(merged.getPage(0).getRotation().angle,90);
assert.deepEqual(merged.getPages().map(p=>p.getWidth()),[300,200,480]);
await assert.rejects(()=>imageToPDF(lib,new Uint8Array([1,2,3]),'jpeg'));
await assert.rejects(()=>imageToPDF(lib,new Uint8Array([1,2,3]),'png'));
console.log('PASS: JPG/transparent PNG conversion, aspect ratio, mixed PDF merge/order/rotation, unchanged inputs, corrupt images rejected.');
