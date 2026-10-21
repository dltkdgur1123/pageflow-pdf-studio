import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync('dist/app.js','utf8');
const fn=source.slice(source.indexOf('async function download(onlySelected'),source.indexOf("for(const id of ['add','start'])",source.indexOf('async function download(onlySelected')));
async function run(picker,standard=false,writeFails=false){
 const events=[];const ctx={suggestedDocumentName:()=> '테스트.pdf',busy:false,viewPages:()=>[{id:'1'}],selected:new Set(),$:()=>({value:'테스트.pdf'}),window:{showSaveFilePicker:picker?async options=>{events.push('picker');assert.equal(options.suggestedName,'테스트.pdf');if(typeof picker==='string')throw Object.assign(new Error(picker),{name:picker});return{name:'테스트.pdf',createWritable:async()=>({write:async()=>{events.push('write');if(writeFails)throw Error('disk full');},close:async()=>events.push('close'),abort:async()=>events.push('abort')})};}:undefined},controls:()=>{},renderFiles:()=>{},say:m=>events.push(m),downloadFallback:()=>events.push('fallback'),buildPDF:async()=>{events.push('build');return new Uint8Array([1,2]);},PDFLib:{},sources:new Map(),Blob,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},document:{body:{append:()=>{}},createElement:()=>({click:()=>events.push('download'),remove:()=>{}})},setTimeout:()=>{}};
 vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.download(false,standard);assert.equal(ctx.busy,false);return events;
}
let e=await run(true);assert(e.indexOf('picker')<e.indexOf('build'));assert(e.includes('write')&&e.includes('close'));
e=await run('AbortError');assert(!e.includes('build')&&!e.includes('download')&&!e.includes('fallback'));
e=await run('SecurityError');assert(e.includes('fallback')&&!e.includes('build'));
e=await run(false);assert.deepEqual(e,['fallback']);
e=await run(false,true);assert(e.includes('build')&&e.includes('download'));
e=await run(true,false,true);assert(e.includes('abort')&&!e.includes('close'));
console.log('PASS: picker before PDF build, save success, cancellation, blocked/unsupported fallback, standard download, failed-write abort.');
