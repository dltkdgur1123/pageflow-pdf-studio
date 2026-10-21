import * as pdfjs from './vendor/pdf.mjs';
import {parseRange,moveSelection,moveBefore,buildPDF,textHighlightQuads,ocrSymbolBounds,restorePixels} from './core.b3968241afc8cee7.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs';
const $=id=>document.getElementById(id),PDFLib=window.PDFLib;
let outputFilename='';
let sources=new Map(),pages=[],selected=new Set(),current=null,history=[],future=[],mode='single',zoom=1,fit=true,busy=false,epoch=0,renderEpoch=0;
let projects=new Map(),activeProject='original',originalState=null,pageDrag=null,sourceFilter=null;
let searchRevision=0,searchRunning=false,searchHits=[],searchIndex=-1,searchScope='',searchNote='';
const textCache=new Map(),ocrCache=new Map(),textRuns=new Map(),ocrRuns=new Map();
const previewGeometry=new WeakMap();
let activeSearchQuery='';
let ocrJob=null;
const thumbnailSize=120;
const uid=()=>crypto.randomUUID();
const say=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function viewPages(){return activeProject==='original'&&sourceFilter?pages.filter(p=>(p.file||p.source)===sourceFilter):pages;}
function reorderView(reorder){
 const visible=viewPages(),ids=new Set(visible.map(p=>p.id)),ordered=reorder(visible);let index=0;
 pages=pages.map(p=>ids.has(p.id)?ordered[index++]:p);
}
function showSource(id){
 if(busy)return;
 if(activeProject!=='original')switchProject('original');
 if(sourceFilter!==id){selected.clear();$('range').value='';}
 sourceFilter=id;current=viewPages().find(p=>p.id===current)?.id||viewPages()[0]?.id||null;
 outputFilename=id?sources.get(id).name.replace(/\.pdf$/i,''):'';
 refresh();
}
const snapshot=()=>({pages:pages.map(p=>({...p})),selected:[...selected],current,sourceFilter});
function remember(){document.querySelector('.undo-close')?.remove();history.push(snapshot());if(history.length>100)history.shift();future=[];}
function restore(s){document.querySelector('.undo-close')?.remove();pages=s.pages.map(p=>({...p}));selected=new Set(s.selected);current=s.current;sourceFilter=s.sourceFilter||null;refresh();}
function edit(fn){if(busy)return;remember();fn();if(!pages.some(p=>p.id===current))current=pages[0]?.id||null;refresh();}
function controls(){searchControls();const visible=viewPages(),any=visible.length>0,sel=selected.size>0;for(const id of ['extract','duplicate','deleteSelected'])$(id).disabled=busy||!sel;for(const id of ['merge','applyRange','selectAll','clearSelection','prev','next','pageNumber','zoomIn','zoomOut','fit','single','continuous'])$(id).disabled=busy||!any;for(const id of ['add','start'])$(id).disabled=busy;$('undo').disabled=busy||!history.length;$('redo').disabled=busy||!future.length;$('selectedCount').textContent=`${selected.size}개 선택`;$('selectionActions').hidden=!sel;$('selectAll').checked=any&&visible.every(p=>selected.has(p.id));$('selectAll').indeterminate=sel&&!$('selectAll').checked;$('pageCount').textContent=visible.length;$('totalPages').textContent=visible.length;$('fileCount').textContent=[...sources.values()].filter(s=>!s.generated&&!s.closed).length;}
async function importFiles(files){if(busy)return;showSource(null);busy=true;controls();const generation=epoch;let added=0;const errors=[];try{for(const file of files){say(`${file.name} 불러오는 중…`);let doc;try{if(file.size>300_000_000)throw new Error('이 버전은 파일당 300MB 이하만 지원합니다.');if(!file.name.toLowerCase().endsWith('.pdf'))throw new Error('PDF 파일만 불러올 수 있습니다.');const bytes=new Uint8Array(await file.arrayBuffer());if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw new Error('유효한 PDF 헤더가 없습니다.');const editable=await PDFLib.PDFDocument.load(bytes);doc=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;if(doc.numPages+pages.length>1000)throw new Error('한 세션에서 최대 1,000페이지까지 불러올 수 있습니다. 대용량 성능은 보장되지 않습니다.');if(generation!==epoch){await doc.destroy();break;}remember();const id=uid();sources.set(id,{name:file.name,bytes,doc,count:editable.getPageCount()});const incoming=Array.from({length:doc.numPages},(_,index)=>({id:uid(),source:id,index,rotation:0}));pages.push(...incoming);current??=incoming[0]?.id;added+=incoming.length;}catch(e){if(doc)await doc.destroy();errors.push(`${file.name}: ${/encrypt|password/i.test(e.message)?'암호로 보호된 PDF는 지원하지 않습니다.':e.message}`);}}}finally{busy=false;$('fileInput').value='';refresh();say(`${added}페이지를 불러왔습니다.${errors.length?' '+errors.join(' / '):' 원본 PDF는 변경되지 않습니다.'}`,errors.length>0);}}
function refresh(){
 document.getElementById('pageMenu')?.hidePopover();
 syncSearchScope();
 const visible=viewPages(),ids=new Set(visible.map(p=>p.id));
 selected=new Set([...selected].filter(id=>ids.has(id)));
 if(!ids.has(current))current=visible[0]?.id||null;
 controls();$('welcome').hidden=pages.length>0;
 $('pageNumber').value=Math.max(1,visible.findIndex(p=>p.id===current)+1);
 $('previewName').textContent=activeProject!=='original'?projects.get(activeProject).name:sourceFilter?sources.get(sourceFilter).name:visible.length?'원본 작업 공간':'문서 미리보기';
 renderFiles();renderThumbs();renderPreview();
}
function renderFiles(){
 const host=$('files');host.replaceChildren();const originalPages=activeProject==='original'?pages:(originalState?.pages||[]);
 $('originalWorkspace').classList.toggle('current',activeProject==='original'&&!sourceFilter);$('originalWorkspace').disabled=busy;
 for(const [id,s] of sources){if(s.generated||s.closed)continue;const present=originalPages.filter(p=>(p.file||p.source)===id);const button=document.createElement('button');button.className='file'+(activeProject==='original'&&sourceFilter===id?' current':'');button.disabled=busy;const strong=document.createElement('strong');strong.textContent='▤ '+s.name;const info=document.createElement('span');info.textContent=`${present.length}페이지 · ${(s.bytes.length/1024/1024).toFixed(1)} MB`;button.append(strong,info);button.onclick=()=>showSource(id);bindProjectDrop(button,id,'source');host.append(fileRow(button,id,s.name,'source'));}
 const list=$('projects');list.replaceChildren();for(const [id,p] of projects){const button=document.createElement('button');button.className='file project-file'+(activeProject===id?' current':'');button.disabled=busy;const title=document.createElement('strong');title.textContent=p.name;const info=document.createElement('span');info.textContent=`${activeProject===id?pages.length:p.state.pages.length}페이지 · 이 탭에서만 유지`;button.append(title,info);button.onclick=()=>switchProject(id);button.dataset.projectId=id;button.title='썸네일을 놓아 페이지 추가';bindProjectDrop(button,id);list.append(fileRow(button,id,p.name,'project'));}
}
function fileRow(button,id,name,kind){
 const row=document.createElement('div');row.className='file-row';const close=document.createElement('button');close.className='file-close';close.type='button';close.disabled=busy;close.title='파일 닫기';close.setAttribute('aria-label',name+' 닫기');close.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>';close.onclick=e=>{e.stopPropagation();closeFile(id,kind);};row.append(button,close);return row;
}
function closeFile(id,kind){
 if(busy)return;const source=sources.get(id),project=projects.get(id);if(kind==='source'?!source||source.closed:!project)return;
 const previous={workspace:workspaceState(),original:originalState,projects:new Map(projects),active:activeProject};
 const loadState=state=>{pages=state.pages.map(p=>({...p}));selected=new Set(state.selected);current=state.current;sourceFilter=state.sourceFilter||null;history=[...state.history];future=[...state.future];outputFilename=state.filename||'';};
 clearPageDrag();ocrJob?.stop();clearSearch();
 if(kind==='source'){
  source.closed=true;
  const clean=state=>{const kept=state.pages.filter(p=>(p.file||p.source)!==id),ids=new Set(kept.map(p=>p.id));return {...state,pages:kept,selected:state.selected.filter(x=>ids.has(x)),current:ids.has(state.current)?state.current:kept[0]?.id||null,sourceFilter:state.sourceFilter===id?null:state.sourceFilter};};
  const state=activeProject==='original'?previous.workspace:originalState;
  if(state){const next={...clean(state),history:state.history.map(clean),future:state.future.map(clean),filename:state.sourceFilter===id?'':state.filename};if(activeProject==='original')loadState(next);else originalState=next;}
 }else{
  if(activeProject===id){activeProject='original';loadState(originalState||{pages:[],selected:[],current:null,history:[],future:[],filename:''});}
  projects.delete(id);
 }
 $('range').value='';refresh();say('‘'+(kind==='source'?source.name:project.name)+'’을 닫았습니다.');
 const undoClose=document.createElement('button');undoClose.className='undo-close';undoClose.textContent='닫기 취소';undoClose.onclick=()=>{if(busy)return;if(kind==='source')source.closed=false;projects=previous.projects;originalState=previous.original;activeProject=previous.active;loadState(previous.workspace);refresh();say('닫은 파일을 다시 열었습니다.');};$('status').append(' ',undoClose);
}
function suggestedDocumentName(){const ids=[...new Set(viewPages().map(p=>p.source))];return outputFilename||(ids.length===1?sources.get(ids[0])?.name:'')||'PageFlow';}
function workspaceState(){return {...snapshot(),history:[...history],future:[...future],filename:outputFilename};}
function switchProject(id){if(busy||id===activeProject)return;const saved=workspaceState();if(activeProject==='original')originalState=saved;else projects.get(activeProject).state=saved;const next=id==='original'?originalState:projects.get(id)?.state;if(!next)return;activeProject=id;sourceFilter=next.sourceFilter||null;$('range').value='';pages=next.pages.map(p=>({...p}));selected=new Set(next.selected);current=next.current;history=[...next.history];future=[...next.future];outputFilename=next.filename;refresh();}
async function createProject(){
 if(busy)return;const chosen=pages.filter(p=>selected.has(p.id)).map(p=>({...p}));if(!chosen.length)return;
 const saved=workspaceState();busy=true;controls();renderFiles();say(`${chosen.length}페이지로 새 파일을 만드는 중…`);let doc;
 try{const bytes=await buildPDF(PDFLib,sources,chosen);doc=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;const id=uid();const base=suggestedDocumentName().trim().replace(/\.pdf$/i,'')||'PageFlow';let name=base+'_선택';let n=2;while([...projects.values()].some(p=>p.name===name+'.pdf'))name=base+'_선택_'+n++;
 const incoming=Array.from({length:doc.numPages},(_,index)=>({id:uid(),source:id,index,rotation:0}));
 if(activeProject==='original')originalState=saved;else projects.get(activeProject).state=saved;
 sources.set(id,{name:name+'.pdf',bytes,doc,count:doc.numPages,generated:true});projects.set(id,{name:name+'.pdf',state:{pages:incoming,selected:[],current:incoming[0].id,history:[],future:[],filename:name}});
 activeProject=id;sourceFilter=null;$('range').value='';pages=incoming;selected=new Set();current=incoming[0].id;history=[];future=[];outputFilename=name;mode='single';
 say(`새 프로젝트 ‘${name}.pdf’를 만들었습니다. 왼쪽에서 원본과 새 파일을 전환할 수 있습니다.`);
 }catch(e){if(doc)await doc.destroy();say('파일 생성 실패: '+e.message,true);}finally{busy=false;refresh();}
}
$('originalWorkspace').onclick=()=>showSource(null);

let thumbObserver,previewObserver;
function renderThumbs(){const visible=viewPages();thumbObserver?.disconnect();const host=$('thumbnails');host.replaceChildren();if(!visible.length){const empty=document.createElement('div');empty.className='empty-sequence';empty.textContent=sourceFilter?'이 파일의 페이지가 없습니다.':'PDF를 불러오면 페이지가 이곳에 표시됩니다.';host.append(empty);return;}thumbObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){thumbObserver.unobserve(e.target);const p=pages.find(p=>p.id===e.target.dataset.id);if(p)drawThumb(e.target,p);}}, {root:null,rootMargin:'200px'});visible.forEach((p,i)=>{const card=document.createElement('div');card.className='thumb'+(selected.has(p.id)?' selected':'')+(p.id===current?' focused':'');card.dataset.id=p.id;card.classList.toggle('search-hit',searchHits.includes(p.id));card.draggable=!busy;card.tabIndex=0;card.setAttribute('aria-label',`${i+1}페이지 미리보기, ${sources.get(p.source).name}`);const placeholder=document.createElement('div');placeholder.className='placeholder';placeholder.textContent='PDF';const footer=document.createElement('div');footer.className='thumb-footer';const num=document.createElement('span');num.textContent=String(i+1).padStart(2,'0');const box=document.createElement('input');box.type='checkbox';box.checked=selected.has(p.id);box.disabled=busy;box.setAttribute('aria-label',`${i+1}페이지 선택`);box.onclick=e=>e.stopPropagation();box.onchange=()=>{if(box.checked)selected.add(p.id);else selected.delete(p.id);card.classList.toggle('selected',box.checked);controls();};footer.append(num,box);const source=document.createElement('small');source.textContent=sources.get(p.source).name.replace(/\.pdf$/i,'');const bottom=document.createElement('div');bottom.className='thumb-bottom';const more=document.createElement('button');more.type='button';more.className='thumb-more';more.textContent='⋯';more.setAttribute('aria-label',`${i+1}페이지 편집`);more.disabled=busy;more.setAttribute('aria-expanded','false');more.onclick=e=>{e.stopPropagation();openPageMenu(p.id,more);};more.ondragstart=e=>{e.preventDefault();e.stopPropagation();};bottom.append(source,more);card.append(placeholder,footer,bottom);const focus=()=>{if(busy)return;current=p.id;refresh();};card.onclick=focus;card.onkeydown=e=>{if(e.target!==card)return;if(e.key==='Enter'){e.preventDefault();focus();}if(e.key===' '){e.preventDefault();box.click();}};card.ondragstart=e=>{if(busy){e.preventDefault();return;}if(e.target.closest('input,button')){e.preventDefault();return;}const ids=selected.has(p.id)?selected:new Set([p.id]);pageDrag={project:activeProject,pages:pages.filter(x=>ids.has(x.id)).map(x=>({...x}))};e.dataTransfer.effectAllowed='all';e.dataTransfer.setData('text/plain',p.id);document.querySelectorAll('[data-drop-id]').forEach(b=>b.classList.toggle('drop-ready',canDropPages(b.dataset.dropId,b.dataset.dropKind)));};card.ondragover=e=>{if(!pageDrag)return;e.preventDefault();e.dataTransfer.dropEffect='move';card.classList.add('dragging-over');};card.ondragleave=()=>card.classList.remove('dragging-over');card.ondrop=e=>{e.preventDefault();e.stopPropagation();card.classList.remove('dragging-over');const dragged=e.dataTransfer.getData('text/plain');if(pages.some(x=>x.id===dragged)){const moving=selected.has(dragged)?new Set(selected):new Set([dragged]);edit(()=>reorderView(list=>moveBefore(list,moving,p.id)));}};host.append(card);thumbObserver.observe(card);});}
async function drawThumb(card,p){try{const page=await sources.get(p.source).doc.getPage(p.index+1);if(!card.isConnected)return;const base=page.getViewport({scale:1,rotation:(page.rotate+p.rotation)%360});const viewport=page.getViewport({scale:Math.min((thumbnailSize-24)/base.width,(thumbnailSize*1.25)/base.height)*2,rotation:(page.rotate+p.rotation)%360});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=viewport.width/2+'px';canvas.style.height=viewport.height/2+'px';await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await paintDrawing(canvas,p,viewport);if(card.isConnected)card.firstChild.replaceWith(canvas);}catch(e){if(card.isConnected)card.firstChild.textContent='미리보기 오류';}}
function renderPreview(){const revision=++renderEpoch;previewObserver?.disconnect();const host=$('pagesPreview');host.replaceChildren();const all=viewPages(),visible=mode==='single'?all.filter(p=>p.id===current):all;$('single').classList.toggle('active',mode==='single');$('continuous').classList.toggle('active',mode==='continuous');$('single').setAttribute('aria-pressed',String(mode==='single'));$('continuous').setAttribute('aria-pressed',String(mode==='continuous'));$('zoomLabel').textContent=fit?'맞춤':`${Math.round(zoom*100)}%`;previewObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){previewObserver.unobserve(e.target);const p=visible.find(p=>p.id===e.target.dataset.id);if(p)drawPreview(e.target,p,revision);}}, {root:$('viewer'),rootMargin:'200px'});for(const p of visible){const sheet=document.createElement('div');sheet.className='preview-sheet';sheet.dataset.id=p.id;sheet.style.minHeight='400px';const label=document.createElement('small');label.textContent=`${all.indexOf(p)+1} / ${all.length} · 원본 ${p.index+1}페이지`;const footer=document.createElement('div');footer.className='preview-caption';const editButton=document.createElement('button');editButton.type='button';editButton.className='preview-edit';editButton.setAttribute('aria-label',`${all.indexOf(p)+1}페이지 바로 편집`);editButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1L20 7l-3-3L5 16zM14 7l3 3"/></svg><span>편집</span>';editButton.onclick=()=>openDrawing(p.id);footer.append(label,editButton);sheet.append(footer);host.append(sheet);previewObserver.observe(sheet);}if(mode==='continuous')host.querySelector(`[data-id="${current}"]`)?.scrollIntoView({block:'nearest'});else $('viewer').scrollTop=0;}
async function drawPreview(sheet,p,revision){try{const page=await sources.get(p.source).doc.getPage(p.index+1);if(revision!==renderEpoch)return;const rotation=(page.rotate+p.rotation)%360,base=page.getViewport({scale:1,rotation});const available=Math.max(160,$('viewer').clientWidth-64);const scale=fit?Math.min(available/base.width,Math.max(200,$('viewer').clientHeight-60)/base.height):zoom;const dpr=Math.min(window.devicePixelRatio||1,2);const viewport=page.getViewport({scale:scale*dpr,rotation});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=viewport.width/dpr+'px';canvas.style.height=viewport.height/dpr+'px';await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;await paintDrawing(canvas,p,viewport);if(revision===renderEpoch&&sheet.isConnected){sheet.style.minHeight='0';const stage=document.createElement('div');stage.className='preview-stage';stage.style.width=viewport.width/dpr+'px';stage.style.height=viewport.height/dpr+'px';stage.append(canvas);sheet.prepend(stage);previewGeometry.set(stage,{p,viewport:page.getViewport({scale,rotation})});try{await pageText(p);}catch{}if(revision===renderEpoch&&stage.isConnected)paintHighlights(stage);}}catch(e){if(revision===renderEpoch){const err=document.createElement('p');err.textContent='이 페이지를 표시하지 못했습니다.';sheet.append(err);say('일부 페이지 미리보기에 실패했습니다.',true);}}}
function downloadFallback(onlySelected){
 const dialog=document.createElement('dialog');dialog.className='save-fallback';dialog.setAttribute('aria-labelledby','saveFallbackTitle');
 dialog.innerHTML='<h2 id="saveFallbackTitle">저장 위치 선택</h2><p>이 브라우저에서는 저장 위치 선택 창을 열 수 없습니다.<br>일반 다운로드는 브라우저에 설정된 위치에 저장됩니다.</p><p class="small">폴더를 직접 고르려면 Chrome 또는 Edge에서 이 사이트를 열어 주세요. 파일은 다시 불러와야 합니다.</p><div><button data-cancel>취소</button><button data-download class="primary">일반 다운로드</button></div>';
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-download]').onclick=()=>{dialog.close();download(onlySelected,true);};dialog.showModal();
}
async function download(onlySelected,standard=false){
 if(busy)return;const items=viewPages().filter(p=>!onlySelected||selected.has(p.id)).map(p=>({...p}));if(!items.length)return;
 const base=suggestedDocumentName().trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.pdf$/i,'')||'PageFlow';const name=base+(onlySelected?'_선택':'')+'.pdf';
 if(!standard&&typeof window.showSaveFilePicker!=='function'){downloadFallback(onlySelected);return;}
 busy=true;controls();renderFiles();let writer;
 try{
  let handle;
  if(!standard){
   try{handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'PDF 문서',accept:{'application/pdf':['.pdf']}}],excludeAcceptAllOption:true});}
   catch(e){if(e.name==='AbortError'){say('저장을 취소했습니다.');return;}if(['SecurityError','NotAllowedError','NotSupportedError'].includes(e.name)){downloadFallback(onlySelected);return;}throw e;}
  }
  say(`${items.length}페이지 PDF를 만드는 중…`);const bytes=await buildPDF(PDFLib,sources,items);
  if(handle){writer=await handle.createWritable();await writer.write(new Blob([bytes],{type:'application/pdf'}));await writer.close();writer=null;say(`‘${handle.name}’을 선택한 위치에 저장했습니다.`);}
  else{const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);say(`${items.length}페이지 PDF의 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.`);}
 }catch(e){if(writer)try{await writer.abort();}catch{}say('PDF 저장 실패: '+e.message,true);}
 finally{busy=false;controls();renderFiles();}
}
for(const id of ['add','start'])$(id).onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>importFiles([...e.target.files]);
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();$('viewer').classList.add('dragging-over');}});document.addEventListener('drop',e=>{if(e.dataTransfer.files.length){e.preventDefault();$('viewer').classList.remove('dragging-over');importFiles([...e.dataTransfer.files]);}});document.addEventListener('dragend',clearPageDrag);document.addEventListener('drop',clearPageDrag);document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('viewer').classList.remove('dragging-over');});
$('applyRange').onclick=()=>{try{selected=new Set(parseRange($('range').value,viewPages().length).map(i=>viewPages()[i].id));$('rangeOptions').open=false;refresh();say(`${selected.size}페이지를 선택했습니다. 현재 표시된 페이지 순서 기준입니다.`);}catch(e){say(e.message,true);}};$('range').onkeydown=e=>{if(e.key==='Enter')$('applyRange').click();};$('selectAll').onchange=()=>{selected=$('selectAll').checked?new Set(viewPages().map(p=>p.id)):new Set();refresh();};$('clearSelection').onclick=()=>{selected.clear();refresh();};
$('duplicate').onclick=()=>{if(busy||!selected.size)return;const count=selected.size;if(pages.length+selected.size>1000){say('복제 후 1,000페이지를 초과합니다.',true);return;}edit(()=>{const clones=new Set();pages=pages.flatMap(p=>{if(!selected.has(p.id))return [p];const copy={...p,id:uid()};clones.add(copy.id);return [p,copy];});selected=clones;current=[...clones][0];});say(count+'페이지를 복제했습니다. 복제본을 선택했습니다.');document.querySelector('.thumb.selected')?.scrollIntoView({block:'nearest'});};$('undo').onclick=()=>{if(!busy&&history.length){future.push(snapshot());restore(history.pop());}};$('redo').onclick=()=>{if(!busy&&future.length){history.push(snapshot());restore(future.pop());}};
$('single').onclick=()=>{mode='single';renderPreview();};$('continuous').onclick=()=>{mode='continuous';renderPreview();};$('zoomIn').onclick=()=>{fit=false;zoom=Math.min(4,zoom+.25);renderPreview();};$('zoomOut').onclick=()=>{fit=false;zoom=Math.max(.25,zoom-.25);renderPreview();};$('fit').onclick=()=>{fit=true;renderPreview();};
function go(n){const visible=viewPages();if(!Number.isInteger(n)||n<1||n>visible.length){say('1~'+visible.length+' 사이의 페이지 번호를 입력하세요.',true);$('pageNumber').value=Math.max(1,visible.findIndex(p=>p.id===current)+1);return;}current=visible[n-1].id;refresh();}
$('prev').onclick=()=>go(Math.max(1,viewPages().findIndex(p=>p.id===current)));$('next').onclick=()=>go(Math.min(viewPages().length,viewPages().findIndex(p=>p.id===current)+2));$('pageNumber').onchange=e=>go(Number(e.target.value));$('extract').onclick=()=>createProject();$('merge').onclick=()=>download(false);
async function reset(){ocrJob?.stop();ocrCache.clear();ocrRuns.clear();textRuns.clear();clearSearch();textCache.clear();clearPageDrag();epoch++;renderEpoch++;thumbObserver?.disconnect();previewObserver?.disconnect();const old=[...sources.values()];sources=new Map();pages=[];projects.clear();activeProject='original';sourceFilter=null;originalState=null;selected.clear();current=null;history=[];future=[];mode='single';zoom=1;fit=true;refresh();await Promise.allSettled(old.map(s=>s.doc.destroy()));say('작업을 종료했습니다. 새 PDF를 불러올 수 있습니다.');}
window.addEventListener('pagehide',e=>{if(!e.persisted)ocrJob?.stop();});
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open],:popover-open'))return;
 if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey){
  const button=$(e.key==='ArrowLeft'?'prev':'next');
  if(!button.disabled){e.preventDefault();button.click();}
  return;
 }
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}
 if(e.key==='Delete'&&selected.size&&!busy){e.preventDefault();deleteSelectedPages();}
});
$('prev').title='이전 페이지 (←)';$('next').title='다음 페이지 (→)';
$('prev').setAttribute('aria-keyshortcuts','ArrowLeft');$('next').setAttribute('aria-keyshortcuts','ArrowRight');
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(fit)renderPreview();},180);});
refresh();

function openPageMenu(id,anchor){
 if(busy)return;let menu=document.getElementById('pageMenu');if(!menu){menu=document.createElement('div');menu.id='pageMenu';menu.setAttribute('popover','auto');document.body.append(menu);menu.addEventListener('toggle',e=>{if(e.newState==='closed')document.querySelectorAll('.thumb-more[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));});}
 menu.hidePopover();menu.replaceChildren();const index=viewPages().findIndex(p=>p.id===id);if(index<0)return;
 const heading=document.createElement('strong');heading.textContent=`${index+1}페이지 편집`;menu.append(heading);
 const icons={draw:'<path d="M3 5V3h12v2M9 3v13M5 16h8"/><rect x="15" y="13" width="6" height="8" rx="1"/>',left:'<path d="M3 4v6h6M3 10a9 9 0 1 1 2 9"/>',right:'<path d="M21 4v6h-6M21 10a9 9 0 1 0-2 9"/>',previous:'<path d="M12 20V4m-6 6 6-6 6 6"/>',next:'<path d="M12 4v16m-6-6 6 6 6-6"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',delete:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'};
 const decorate=(button,action,title)=>{button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[action]+'</svg>';const label=document.createElement('span');label.textContent=title;button.append(label);};
 const separator=()=>{const line=document.createElement('div');line.className='menu-separator';line.setAttribute('role','separator');menu.append(line);};
 const draw=document.createElement('button');draw.type='button';decorate(draw,'draw','편집');draw.onclick=()=>{menu.hidePopover();openDrawing(id);};menu.append(draw);separator();
 const actions=[['왼쪽으로 90° 회전','left'],['오른쪽으로 90° 회전','right'],['한 페이지 앞으로','previous'],['한 페이지 뒤로','next'],['페이지 복제','copy'],['페이지 삭제','delete']];
 for(const [title,action] of actions){if(['previous','copy','delete'].includes(action))separator();const b=document.createElement('button');b.type='button';decorate(b,action,title);b.disabled=(action==='previous'&&index===0)||(action==='next'&&index===viewPages().length-1);if(action==='delete')b.className='danger';b.onclick=()=>{menu.hidePopover();let focusId=id;edit(()=>{const at=pages.findIndex(p=>p.id===id);if(at<0)return;if(action==='left'||action==='right')pages=pages.map(p=>p.id===id?{...p,rotation:(p.rotation+(action==='left'?270:90))%360}:p);else if(action==='previous'||action==='next')reorderView(list=>moveSelection(list,new Set([id]),action==='previous'?-1:1));else if(action==='copy'){if(pages.length>=1000){say('최대 1,000페이지까지 가능합니다.',true);return;}const copy={...pages[at],id:uid()};pages.splice(at+1,0,copy);focusId=copy.id;}else{pages.splice(at,1);selected.delete(id);focusId=pages[Math.min(at,pages.length-1)]?.id;}});if(focusId)document.querySelector(`.thumb[data-id="${focusId}"] .thumb-more`)?.focus();};menu.append(b);}
 menu.showPopover();const r=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.right-menu.offsetWidth,window.innerWidth-menu.offsetWidth-8))+'px';const height=menu.offsetHeight;menu.style.top=Math.max(8,r.bottom+height+8<window.innerHeight?r.bottom+6:r.top-height-6)+'px';anchor.setAttribute('aria-expanded','true');menu.querySelector('button:not(:disabled)')?.focus();
}

function clearPageDrag(){
 pageDrag=null;
 document.querySelectorAll('.dragging-over,.drop-ready').forEach(el=>el.classList.remove('dragging-over','drop-ready'));
 document.querySelectorAll('[data-drop-id]').forEach(el=>delete el.dataset.dropLabel);
}

function canDropPages(id,kind){
 if(busy||!pageDrag||pageDrag.project!==activeProject)return false;
 return kind==='source'?!(activeProject==='original'&&sourceFilter===id):id!==activeProject;
}
function bindProjectDrop(button,id,kind='project'){
 button.dataset.dropId=id;button.dataset.dropKind=kind;
 button.title='페이지를 끌어 놓아 복사';
 const accepts=()=>canDropPages(id,kind);
 button.ondragover=e=>{
  if(!accepts())return;
  e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='copy';
  button.classList.add('dragging-over');button.dataset.dropLabel=pageDrag.pages.length+'페이지 복사';
 };
 button.ondragenter=button.ondragover;
 button.ondragleave=e=>{
  if(e.relatedTarget&&button.contains(e.relatedTarget))return;
  button.classList.remove('dragging-over');delete button.dataset.dropLabel;
 };
 button.ondrop=e=>{
  if(!accepts())return;
  e.preventDefault();e.stopPropagation();
  const chosen=pageDrag.pages;clearPageDrag();
  const isSource=kind==='source',target=isSource?sources.get(id):projects.get(id);
  if(!target)return;
  const state=isSource?(activeProject==='original'?workspaceState():originalState):target.state;
  if(!state)return;
  if(state.pages.length+chosen.length>1000){say('추가 후 작업 공간이 1,000페이지를 초과합니다.',true);return;}
  const incoming=chosen.map(p=>({...p,id:uid(),file:isSource?id:undefined}));
  if(isSource&&activeProject==='original'){
   edit(()=>{pages.push(...incoming);});
  }else{
   const previous={pages:state.pages.map(p=>({...p})),selected:[...state.selected],current:state.current,sourceFilter:state.sourceFilter||null};
   const next={...state,pages:[...state.pages,...incoming],current:state.current||incoming[0].id,history:[...state.history,previous].slice(-100),future:[]};
   if(isSource)originalState=next;else target.state=next;
   renderFiles();
  }
  say('‘'+target.name+'’에 '+incoming.length+'페이지를 복사했습니다. 원본은 그대로입니다.');
 };
}

function searchControls(){
 $('ocrStop').hidden=!ocrJob;$('searchResultsNav').hidden=!searchHits.length;
 $('searchQuery').disabled=busy||!viewPages().length;
 $('searchSubmit').disabled=busy||!viewPages().length||searchRunning;
 $('searchPrev').disabled=$('searchNext').disabled=(busy&&!ocrJob)||!searchHits.length;
 $('searchClear').disabled=!$('searchQuery').value&&!searchRunning&&!searchHits.length&&!searchNote;
}
function clearSearch(){
 activeSearchQuery='';updatePreviewHighlights();
 ocrJob?.stop();$('ocrStatus').textContent='';$('searchProgress').hidden=true;
 searchRevision++;searchRunning=false;searchHits=[];searchIndex=-1;searchNote='';
 $('searchQuery').value='';$('searchStatus').textContent='';
 document.querySelectorAll('.search-hit').forEach(el=>el.classList.remove('search-hit'));
 searchControls();
}
function syncSearchScope(){
 const key=activeProject+':'+sourceFilter+':'+viewPages().map(p=>p.id+':'+(p.drawing?.revision||'')).join(',');
 if(key!==searchScope){searchScope=key;clearSearch();if(!ocrJob)$('ocrStatus').textContent='';}
}
function pageSearchKey(p){return p.source+':'+p.index+':'+(p.drawing?.revision||'');}
function normalizedText(text){return text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');}
async function pageText(p){
 if(p.drawing?.flattened)return '';
 const key=pageSearchKey(p);
 if(textCache.has(key))return textCache.get(key);
 const source=sources.get(p.source);
 const pending=(async()=>{const page=await source.doc.getPage(p.index+1);const content=await page.getTextContent();textRuns.set(key,content.items.filter(item=>item.str).map(item=>{const [a,b,c,d,x,y]=item.transform;const h=Math.hypot(c,d)||item.height||1,w=item.width||0,u=Math.hypot(a,b)||1;const ux=a/u,uy=b/u,vx=c/h,vy=d/h;const style=content.styles[item.fontName]||{},ascent=style.ascent??0.85,descent=style.descent??-0.2;const point=(dx,dy)=>[x+ux*dx+vx*dy,y+uy*dx+vy*dy];return {text:item.str,quad:[point(0,h*ascent),point(w,h*ascent),point(w,h*descent),point(0,h*descent)]};}));return normalizedText(content.items.map(item=>item.str||'').join(' '));})();
 textCache.set(key,pending);
 try{return await pending;}catch(e){textCache.delete(key);throw e;}
}
function showSearchResult(index){
 if(!searchHits.length||(busy&&!ocrJob))return;
 searchIndex=(index+searchHits.length)%searchHits.length;
 current=searchHits[searchIndex];refresh();
 $('searchStatus').textContent=(searchIndex+1)+' / '+searchHits.length+'개 페이지'+searchNote;
 document.querySelector('.thumb[data-id="'+current+'"]')?.scrollIntoView({block:'nearest'});
}
async function searchDocument(){
 if(busy||searchRunning)return;
 const query=normalizedText($('searchQuery').value.trim());
 if(!query){clearSearch();return;}
 activeSearchQuery=query;updatePreviewHighlights();
 const revision=++searchRevision,generation=epoch,items=[...viewPages()];
 const groups=new Map();for(const p of items){const key=pageSearchKey(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 const job={cancelled:false,worker:null,render:null,stop(){if(this.cancelled)return;this.cancelled=true;this.render?.cancel();this.reject(new Error('SEARCH_CANCELLED'));}};
 const cancelled=new Promise((_,reject)=>job.reject=reject);cancelled.catch(()=>{});
 const guard=promise=>Promise.race([promise,cancelled]);
 const active=()=>revision===searchRevision&&generation===epoch&&!job.cancelled;
 ocrJob=job;busy=true;searchRunning=true;searchHits=[];searchIndex=-1;searchNote=' · 검색 중';
 const hits=new Set();let completed=0,failed=0,outcome='검색 완료';
 const progress=$('searchProgress');progress.hidden=false;progress.max=Math.max(1,groups.size);progress.value=0;
 const status=text=>{if(revision===searchRevision&&generation===epoch)$('ocrStatus').textContent=text;};
 const resultStatus=()=>{$('searchStatus').textContent=(searchHits.length?(searchIndex>=0?searchIndex+1:0)+' / '+searchHits.length+'개 페이지':'찾은 결과 0개')+searchNote;};
 const addHits=(key,text)=>{
  if(!active()||!text.includes(query))return;
  const previous=searchHits[searchIndex];const before=hits.size;
  for(const p of groups.get(key))hits.add(p.id);
  if(before===hits.size)return;
  searchHits=items.filter(p=>hits.has(p.id)).map(p=>p.id);
  searchIndex=previous?searchHits.indexOf(previous):0;
  if(!previous)showSearchResult(0);
  else{document.querySelectorAll('.thumb').forEach(el=>el.classList.toggle('search-hit',hits.has(el.dataset.id)));resultStatus();searchControls();}
 };
 document.querySelectorAll('.search-hit').forEach(el=>el.classList.remove('search-hit'));
 controls();resultStatus();
 try{
  // Show existing text matches before starting the more expensive image recognition.
  let scanned=0;
  for(const [key,group] of groups){
   let text='';try{text=await guard(pageText(group[0]));}catch(e){if(!active())throw e;}
   if(!active())return;
   addHits(key,text+' '+(ocrCache.get(key)||''));
   scanned++;status(`전체 ${groups.size}페이지 검색 준비 · ${scanned}페이지 확인`);
   if(scanned%8===0)await guard(new Promise(r=>setTimeout(r,0)));
  }
  const targets=[...groups].filter(([key])=>!ocrCache.has(key));
  completed=groups.size-targets.length;progress.value=completed;
  if(targets.length){
   status(`전체 페이지 문자 인식 준비 · ${completed} / ${groups.size}`);
   const pending=window.Tesseract.createWorker('kor+eng',1,{
    workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,
    corePath:new URL('./vendor/ocr/',import.meta.url).href,
    langPath:new URL('./vendor/ocr',import.meta.url).href,
    cacheMethod:'none',workerBlobURL:false,
    logger:m=>{if(active()&&m.status==='recognizing text'){progress.value=completed+failed+m.progress;status(`전체 페이지 검색 · ${completed+failed} / ${groups.size} · 현재 페이지 ${Math.round(m.progress*100)}%`);}},errorHandler:()=>{}
   });
   pending.then(worker=>{if(!active())worker.terminate();else job.worker=worker;},()=>{});
   const worker=await guard(pending);await guard(worker.setParameters({tessedit_pageseg_mode:'11',user_defined_dpi:'200'}));
   for(const [key,group] of targets){
    if(!active())return;
    let canvas;const p=group[0];
    try{
     status(`전체 페이지 검색 · ${completed+failed} / ${groups.size} · 페이지 준비 중`);
     const page=await guard(sources.get(p.source).doc.getPage(p.index+1));
     const base=page.getViewport({scale:1,rotation:(page.rotate+p.rotation)%360});
     const scale=Math.min(3,2400/Math.max(base.width,base.height));
     const viewport=page.getViewport({scale,rotation:(page.rotate+p.rotation)%360});
     canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     job.render=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'});
     await guard(job.render.promise);job.render=null;await guard(paintDrawing(canvas,p,viewport));
     const result=await guard(worker.recognize(canvas,{}, {text:true,blocks:true}));if(!active())return;
     const runs=[];for(const block of result.data.blocks||[])for(const para of block.paragraphs||[])for(const line of para.lines||[])for(const word of line.words||[])for(const token of word.symbols?.length?word.symbols:[word]){const b=ocrSymbolBounds(token,word.symbols||[]);if(b)runs.push({text:token.text||'',quad:[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(([x,y])=>viewport.convertToPdfPoint(x,y))});}
     ocrRuns.set(key,runs);const text=normalizedText(result.data.text||'');ocrCache.set(key,text);completed++;addHits(key,text);updatePreviewHighlights();
    }catch(e){if(!active())throw e;failed++;}
    finally{if(canvas){canvas.width=0;canvas.height=0;}job.render=null;}
    progress.value=completed+failed;
   }
  }
 }catch(e){outcome=job.cancelled?'검색 중지':'검색 오류';}
 finally{
  const stopped=job.cancelled;job.cancelled=true;job.render?.cancel();await job.worker?.terminate().catch(()=>{});
  if(ocrJob===job){ocrJob=null;busy=false;searchRunning=false;refresh();}
  if(revision===searchRevision&&generation===epoch){
   if(stopped)outcome='검색 중지';
   const partial=outcome!=='검색 완료'||failed>0;
   searchNote=partial?' · 일부 페이지 검색 결과':'';
   status(`${outcome} · 문자 인식 ${completed} / ${groups.size}페이지`+(failed?` · 실패 ${failed}페이지 (검색을 눌러 재시도)`:'')+(outcome==='검색 중지'?' · 다시 검색하면 이어서 진행합니다.':''));
   if(!searchHits.length)$('searchStatus').textContent=partial?'현재까지 찾은 결과 없음 · 전체 검색 미완료':'검색 결과 없음';else resultStatus();
   searchControls();
  }
 }
}
$('searchForm').onsubmit=e=>{e.preventDefault();searchDocument();};
$('searchPrev').onclick=()=>showSearchResult(searchIndex-1);
$('searchNext').onclick=()=>showSearchResult(searchIndex+1);
$('searchClear').onclick=()=>{clearSearch();$('searchQuery').focus();};
$('searchQuery').oninput=()=>{activeSearchQuery='';updatePreviewHighlights();$('ocrStatus').textContent='';$('searchProgress').hidden=true;searchRevision++;searchRunning=false;searchHits=[];searchIndex=-1;searchNote='';$('searchStatus').textContent='';document.querySelectorAll('.search-hit').forEach(el=>el.classList.remove('search-hit'));searchControls();};
$('searchQuery').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();clearSearch();}};
searchControls();

for(const [id,layout] of [['layoutBoth','both'],['layoutPreview','preview'],['layoutPages','pages']]){
 $(id).onclick=()=>{
  document.querySelector('.editor').dataset.layout=layout;
  for(const [button,value] of [['layoutBoth','both'],['layoutPreview','preview'],['layoutPages','pages']])$(button).setAttribute('aria-pressed',String(layout===value));
  requestAnimationFrame(()=>{if(layout!=='pages')renderPreview();});
 };
}


$('ocrStop').onclick=()=>ocrJob?.stop();

function paintHighlights(stage){
 stage.querySelector('.search-highlights')?.remove();
 const geometry=previewGeometry.get(stage);if(!geometry||!activeSearchQuery)return;
 const {p,viewport}=geometry,key=pageSearchKey(p);
 const quads=[...textHighlightQuads(textRuns.get(key)||[],activeSearchQuery),...textHighlightQuads(ocrRuns.get(key)||[],activeSearchQuery)];
 if(!quads.length)return;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('search-highlights');svg.setAttribute('viewBox',`0 0 ${viewport.width} ${viewport.height}`);svg.setAttribute('aria-hidden','true');
 const drawn=[];
 for(const quad of quads){
  const points=quad.map(([x,y])=>viewport.convertToViewportPoint(x,y));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),box=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  if(drawn.some(b=>{const intersection=Math.max(0,Math.min(b[2],box[2])-Math.max(b[0],box[0]))*Math.max(0,Math.min(b[3],box[3])-Math.max(b[1],box[1]));const area=Math.min((b[2]-b[0])*(b[3]-b[1]),(box[2]-box[0])*(box[3]-box[1]));return area>0&&intersection/area>0.8;}))continue;
  drawn.push(box);const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon');polygon.setAttribute('points',points.map(p=>p.join(',')).join(' '));svg.append(polygon);
 }
 stage.append(svg);
}
function updatePreviewHighlights(){document.querySelectorAll('.preview-stage').forEach(paintHighlights);}

async function paintDrawing(canvas,p,viewport){
 if(!p.drawing?.png)return;const d=p.drawing,img=new Image();img.src=d.png;await img.decode();
 const ctx=canvas.getContext('2d');ctx.save();ctx.transform(...viewport.transform);ctx.translate(d.x,d.y);ctx.rotate(d.angle*Math.PI/180);ctx.scale(1,-1);ctx.drawImage(img,0,-d.height,d.width,d.height);ctx.restore();
}
async function openDrawing(id){
 if(busy)return;const p=pages.find(p=>p.id===id);if(!p)return;
 const dialog=document.createElement('dialog');dialog.className='drawing-dialog';
 dialog.innerHTML=`<form method="dialog" class="drawing-header"><strong>페이지 꾸미기</strong><button value="cancel" class="drawing-close" aria-label="편집 닫기" title="닫기">×</button></form>
 <div class="drawing-tools"><div class="drawing-tool-icons" role="group" aria-label="그리기 도구"><button type="button" data-draw-tool="select" aria-label="선택 · 이동" title="선택 · 이동" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 9-7 1-3 7z"/></svg></button><button type="button" data-draw-tool="text" aria-label="텍스트" title="텍스트" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6V4h16v2M12 4v16M8 20h8"/></svg></button><button type="button" data-draw-tool="rect" aria-label="사각형" title="사각형" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1"/></svg></button><button type="button" data-draw-tool="ellipse" aria-label="원 · 타원" title="원 · 타원" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg></button><button type="button" data-draw-tool="line" aria-label="선" title="선" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20L20 4"/></svg></button><button type="button" data-draw-tool="pen" aria-label="펜" title="펜" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 12-12-3-3L5 16zM14 7l3 3"/></svg></button><button type="button" data-draw-tool="eraser" aria-label="지우개" title="지우개 · 손글씨 배경 복원" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13l9-9 8 8-8 8H9zM8 9l8 8M13 20h8"/></svg></button></div>
 <label data-erase-options hidden>지우개 방식 <select data-erase-mode aria-label="지우개 방식"><option value="colour">컬러 손글씨 복원</option><option value="area">영역 배경 복원</option><option value="annotation">추가한 내용 지우기</option></select></label><label>색상 <input data-color type="color" value="#dc2626"></label><label>글자 크기 <input data-size type="number" min="8" max="120" value="24"></label><label class="drawing-width"><span data-width-label>선 두께</span> <input data-width type="number" aria-label="선 두께" min="1" max="80" value="2"><span>pt</span></label>
 <span class="text-edit-actions" hidden><button type="button" data-text-done title="입력 완료 (Ctrl+Enter)">✓ 완료</button><button type="button" data-text-cancel title="입력 취소 (Esc)">취소</button></span><button type="button" data-delete>선택 삭제</button><button type="button" data-undo>되돌리기</button><button type="button" data-redo>다시 실행</button></div>

 <div class="drawing-view-tools" role="group" aria-label="편집 화면 배율"><button type="button" data-zoom-out aria-label="편집 화면 축소">−</button><output data-zoom>100%</output><button type="button" data-zoom-in aria-label="편집 화면 확대">＋</button><button type="button" data-fit>화면 맞춤</button></div><p class="drawing-hint">추가한 글자·도형·펜 선을 선택해 이동할 수 있습니다.</p>
 <div class="drawing-scroll"><div class="drawing-paper"><canvas data-page></canvas><canvas data-overlay aria-label="텍스트와 도형 작업 영역"></canvas></div></div>
 <div class="drawing-footer"><span data-message>페이지를 준비하는 중…</span><button type="button" data-save disabled>적용</button></div>`;
 document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 const q=selector=>dialog.querySelector(selector),base=q('[data-page]'),overlay=q('[data-overlay]'),paper=q('.drawing-paper');
 let items=structuredClone(p.drawing?.items||[]),chosen=-1,editingTextIndex=-1,drag=null,undo=[],redo=[],activeTool='select',finishText=()=>{},updateBrush=()=>{},penWidth=2,eraserWidth=24;
 function setTool(tool){finishText();if(activeTool==='pen')penWidth=Number(q('[data-width]').value)||2;if(activeTool==='eraser')eraserWidth=Number(q('[data-width]').value)||24;activeTool=tool;const label=tool==='pen'?'펜 굵기':tool==='eraser'?'지우개 크기':'선 두께';q('[data-width-label]').textContent=label;q('[data-width]').setAttribute('aria-label',label);if(tool==='pen'||tool==='eraser')q('[data-width]').value=tool==='pen'?penWidth:eraserWidth;q('[data-size]').parentElement.hidden=tool!=='text'&&tool!=='select';q('[data-color]').parentElement.hidden=tool==='eraser';q('[data-erase-options]').hidden=tool!=='eraser';q('.drawing-hint').textContent=({select:'추가한 요소를 클릭해 선택하고 끌어서 이동하세요. 글자는 두 번 클릭해 수정합니다.',text:'페이지에서 글자를 넣을 위치를 클릭하세요.',pen:'누른 채로 자유롭게 그리세요.',eraser:eraseHint()})[tool]||'끌어서 도형을 그리세요.';dialog.querySelectorAll('[data-draw-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.drawTool===tool)));overlay.style.cursor=tool==='select'?'default':tool==='text'?'text':'crosshair';updateBrush();}
 dialog.querySelectorAll('[data-draw-tool]').forEach(b=>{b.onclick=()=>setTool(b.dataset.drawTool);});
 const eraseHint=()=>q('[data-erase-mode]').value==='annotation'?'추가한 글자·도형·펜 선을 문질러 지웁니다.':q('[data-erase-mode]').value==='colour'?'컬러 부분을 주변 종이색으로 지웁니다. 인쇄된 색상도 지워지며, 가려진 그림은 복원되지 않습니다.':'문지른 영역 전체를 주변 픽셀로 복원합니다. 겹친 글자·악보 선도 달라질 수 있습니다.';
 q('[data-erase-mode]').onchange=()=>setTool('eraser');
 setTool('select');
 const remember=()=>{undo.push(structuredClone(items));redo=[];if(undo.length>30)undo.shift();};
 try{
 const page=await sources.get(p.source).doc.getPage(p.index+1);if(!dialog.isConnected)return;
 const rotation=p.drawing?.rotation??(page.rotate+p.rotation)%360,viewport=page.getViewport({scale:1,rotation});
 const patchImages=new Map();for(const it of items)if(it.type==='restore'){const img=new Image();img.src=it.png;await img.decode();patchImages.set(it.png,img);}
 const w=viewport.width,h=viewport.height,density=Math.min(2,2400/Math.max(w,h));
 for(const c of [base,overlay]){c.width=Math.ceil(w*density);c.height=Math.ceil(h*density);}
 paper.style.aspectRatio=`${w}/${h}`;
 let zoom=1;const scroll=q('.drawing-scroll');
 function setZoom(value){finishText();zoom=Math.max(.25,Math.min(3,value));paper.style.width=(w*zoom)+'px';paper.style.height=(h*zoom)+'px';q('[data-zoom]').textContent=Math.round(zoom*100)+'%';q('[data-zoom-out]').disabled=zoom<=.25;q('[data-zoom-in]').disabled=zoom>=3;updateBrush();}
 const fit=()=>setZoom(Math.min((scroll.clientWidth-40)/w,(scroll.clientHeight-40)/h,1));
 q('[data-zoom-out]').onclick=()=>setZoom(zoom-.25);q('[data-zoom-in]').onclick=()=>setZoom(zoom+.25);q('[data-fit]').onclick=fit;fit();
 await page.render({canvasContext:base.getContext('2d'),viewport:page.getViewport({scale:density,rotation})}).promise;
 if(!dialog.isConnected)return;
 function draw(ctx,item){ctx.save();ctx.strokeStyle=ctx.fillStyle=item.color;ctx.lineWidth=item.stroke;ctx.lineJoin='round';ctx.lineCap='round';
  if(item.type==='restore'){const img=patchImages.get(item.png);if(img)ctx.drawImage(img,item.x,item.y,item.w,item.h);}
  if(item.type==='eraseAdded'){ctx.globalCompositeOperation='destination-out';}
  if(['pen','eraser','eraseAdded','restoreStroke'].includes(item.type)){if(item.type==='eraser')ctx.strokeStyle='#ffffff';if(item.type==='restoreStroke'){ctx.strokeStyle='#a6b99a';ctx.globalAlpha=.4;}ctx.beginPath();item.points.forEach(([x,y],n)=>n?ctx.lineTo(item.x+x,item.y+y):ctx.moveTo(item.x+x,item.y+y));ctx.stroke();}
  if(item.type==='text'){ctx.font=`${item.size}px sans-serif`;ctx.textBaseline='top';item.text.split('\n').forEach((line,i)=>ctx.fillText(line,item.x,item.y+i*item.size*1.25));}
  if(item.type==='rect')ctx.strokeRect(item.x,item.y,item.w,item.h);
  if(item.type==='ellipse'){ctx.beginPath();ctx.ellipse(item.x+item.w/2,item.y+item.h/2,item.w/2,item.h/2,0,0,Math.PI*2);ctx.stroke();}
  if(item.type==='line'){ctx.beginPath();ctx.moveTo(item.x,item.y+(item.flip?item.h:0));ctx.lineTo(item.x+item.w,item.y+(item.flip?0:item.h));ctx.stroke();}ctx.restore();}
 const annotationCanvas=document.createElement('canvas');annotationCanvas.width=overlay.width;annotationCanvas.height=overlay.height;
 function repaint(selection=true){const ctx=overlay.getContext('2d');ctx.setTransform(density,0,0,density,0,0);ctx.clearRect(0,0,w,h);items.filter(i=>i.type==='restore').forEach(i=>draw(ctx,i));const annotations=annotationCanvas.getContext('2d');annotations.setTransform(density,0,0,density,0,0);annotations.clearRect(0,0,w,h);items.forEach((i,index)=>{if(i.type!=='restore'&&index!==editingTextIndex)draw(annotations,i);});ctx.drawImage(annotationCanvas,0,0,w,h);
  const it=items[chosen];if(selection&&it&&editingTextIndex!==chosen&&activeTool==='select'){ctx.save();ctx.strokeStyle='#2563eb';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(it.x-3,it.y-3,it.w+6,it.h+6);ctx.setLineDash([]);ctx.fillStyle='#2563eb';ctx.fillRect(it.x+it.w-4,it.y+it.h-4,8,8);ctx.restore();}
  q('[data-delete]').disabled=chosen<0;q('[data-undo]').disabled=!undo.length;q('[data-redo]').disabled=!redo.length;}
 const brush=document.createElement('div');brush.className='drawing-brush-cursor';brush.setAttribute('aria-hidden','true');brush.hidden=true;paper.append(brush);let brushPoint=null;
 updateBrush=()=>{const enabled=activeTool==='pen'||activeTool==='eraser';overlay.style.cursor=enabled?'none':activeTool==='text'?'text':activeTool==='select'?'default':'crosshair';brush.hidden=!enabled||!brushPoint;if(brush.hidden)return;const r=overlay.getBoundingClientRect(),diameter=Math.max(1,Math.min(80,Number(q('[data-width]').value)||2))*r.width/w;brush.style.width=diameter+'px';brush.style.height=diameter+'px';brush.style.left=brushPoint.x/w*100+'%';brush.style.top=brushPoint.y/h*100+'%';brush.style.background=activeTool==='pen'?q('[data-color]').value+'26':'#ffffff40';};
 const trackBrush=e=>{brushPoint=pos(e);updateBrush();};
 overlay.addEventListener('pointerenter',trackBrush);overlay.addEventListener('pointermove',trackBrush);overlay.addEventListener('pointerdown',trackBrush);overlay.addEventListener('pointerleave',()=>{brushPoint=null;updateBrush();});
 for(const selector of ['[data-width]','[data-color]'])q(selector).addEventListener('input',updateBrush);
 scroll.addEventListener('scroll',()=>{brushPoint=null;updateBrush();});
 updateBrush();
 const pos=e=>{const r=overlay.getBoundingClientRect();return {x:Math.max(0,Math.min(w,(e.clientX-r.left)*w/r.width)),y:Math.max(0,Math.min(h,(e.clientY-r.top)*h/r.height))};};
 function textBounds(it){const ctx=overlay.getContext('2d');ctx.font=`${it.size}px sans-serif`;it.w=Math.max(10,...it.text.split('\n').map(t=>ctx.measureText(t).width));it.h=it.text.split('\n').length*it.size*1.25;}
 function hit(at){return items.findLastIndex(i=>{
  if(['restore','eraseAdded','restoreStroke'].includes(i.type))return false;
  if(i.type==='pen'||i.type==='eraser'){return i.points.some(([x,y],n)=>{const prev=i.points[Math.max(0,n-1)],ax=i.x+prev[0],ay=i.y+prev[1],dx=x-prev[0],dy=y-prev[1],t=Math.max(0,Math.min(1,((at.x-ax)*dx+(at.y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(at.x-ax-t*dx,at.y-ay-t*dy)<Math.max(7,i.stroke/2+3);});}
  return at.x>=i.x-5&&at.x<=i.x+i.w+5&&at.y>=i.y-5&&at.y<=i.y+i.h+5;
 });}
 function inputText(at,index=-1){
  finishText();const existing=items[index],editor=document.createElement('textarea');editor.className='drawing-inline-text';editor.setAttribute('aria-label','페이지에 입력할 글자');editor.placeholder='';editor.wrap='off';editor.spellcheck=false;editor.maxLength=2000;editor.value=existing?.text||'';
  let size=existing?.size||Math.max(8,Math.min(120,Number(q('[data-size]').value)||24));
  editor.style.left=(at.x/w*100)+'%';editor.style.top=(at.y/h*100)+'%';editor.style.fontSize=(size*paper.clientWidth/w)+'px';editor.style.color=existing?.color||q('[data-color]').value;paper.append(editor);
  let color=existing?.color||q('[data-color]').value;q('[data-size]').value=size;q('[data-color]').value=color;editingTextIndex=index;repaint();
  const fitText=()=>{const scale=paper.clientWidth/w,ctx=overlay.getContext('2d');ctx.font=`${size}px sans-serif`;const lines=editor.value.split('\n');editor.style.width=(Math.max(size*.6,...lines.map(line=>ctx.measureText(line).width))*scale+3)+'px';editor.style.height=(lines.length*size*1.25*scale)+'px';};
  editor.addEventListener('input',fitText);fitText();q('.text-edit-actions').hidden=false;q('.drawing-hint').textContent='바로 입력하세요 · Enter 줄바꿈 · Ctrl+Enter 완료 · Esc 취소';
  q('[data-text-done]').onclick=()=>{finishText();setTool('select');};q('[data-text-cancel]').onclick=()=>{finishText(true);setTool('select');};
  const updateTextStyle=()=>{size=Math.max(8,Math.min(120,Number(q('[data-size]').value)||24));color=q('[data-color]').value;editor.style.fontSize=(size*paper.clientWidth/w)+'px';editor.style.color=color;fitText();};
  q('[data-size]').addEventListener('input',updateTextStyle);q('[data-color]').addEventListener('input',updateTextStyle);
  let done=false;finishText=(cancel=false)=>{if(done)return;done=true;const text=editor.value;q('[data-size]').removeEventListener('input',updateTextStyle);q('[data-color]').removeEventListener('input',updateTextStyle);editingTextIndex=-1;q('.text-edit-actions').hidden=true;editor.remove();finishText=()=>{};if(!cancel&&text.trim()){remember();const it=existing?{...existing,text,size,color}:{type:'text',x:at.x,y:at.y,w:1,h:1,text,size,stroke:2,color:q('[data-color]').value};textBounds(it);if(existing)items[index]=it;else items.push(it);chosen=existing?index:items.length-1;}else if(!cancel&&existing){remember();items.splice(index,1);chosen=-1;}repaint();};
  editor.onkeydown=e=>{e.stopPropagation();if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();finishText(true);}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishText();setTool('select');}};editor.focus();
 }
 overlay.ondblclick=e=>{if(activeTool==='select'){const at=pos(e),index=hit(at);if(items[index]?.type==='text')inputText(items[index],index);}};
 overlay.onpointerdown=e=>{if(e.button!==0)return;finishText();const at=pos(e),type=activeTool;
  if(type==='text'){e.preventDefault();inputText(at);return;}
  if(type==='select'){
   const prior=items[chosen],resize=prior&&!['pen','eraser'].includes(prior.type)&&Math.hypot(at.x-prior.x-prior.w,at.y-prior.y-prior.h)<14;
   if(!resize)chosen=hit(at);
   if(chosen>=0){remember();const it=items[chosen];drag={type:resize?'resize':'move',at,initial:structuredClone(it)};q('[data-size]').value=it.size||24;q('[data-color]').value=it.color;q('[data-width]').value=it.stroke;}
  }else{
   remember();const it={type,x:at.x,y:at.y,w:1,h:1,size:24,stroke:Math.max(1,Math.min(80,Number(q('[data-width]').value)||2)),color:q('[data-color]').value};
   if(type==='pen'||type==='eraser')it.points=[[0,0],[.01,.01]];if(type==='eraser'){it.type=q('[data-erase-mode]').value==='annotation'?'eraseAdded':'restoreStroke';it.colourOnly=q('[data-erase-mode]').value==='colour';}items.push(it);chosen=items.length-1;drag={type:['pen','eraser'].includes(type)?'pen':'new',at};
  }overlay.setPointerCapture(e.pointerId);repaint();};
 overlay.onpointermove=e=>{if(!drag)return;const at=pos(e);const it=items[chosen];if(!it)return;
  if(drag.type==='pen'){it.points.push([at.x-it.x,at.y-it.y]);}
  if(drag.type==='new'){it.flip=(at.x-drag.at.x)*(at.y-drag.at.y)<0;it.x=Math.min(at.x,drag.at.x);it.y=Math.min(at.y,drag.at.y);it.w=Math.max(1,Math.abs(at.x-drag.at.x));it.h=Math.max(1,Math.abs(at.y-drag.at.y));}
  if(drag.type==='move'){it.x=Math.max(0,Math.min(Math.max(0,w-it.w),drag.initial.x+at.x-drag.at.x));it.y=Math.max(0,Math.min(Math.max(0,h-it.h),drag.initial.y+at.y-drag.at.y));}
  if(drag.type==='resize'){if(it.type==='text'){it.size=Math.max(8,Math.min(120,drag.initial.size*Math.max(.1,(at.x-it.x)/drag.initial.w)));textBounds(it);q('[data-size]').value=Math.round(it.size);}else{it.w=Math.max(2,at.x-it.x);it.h=Math.max(2,at.y-it.y);}}
  repaint();};
 function restoreStroke(it){
  // Work only in a padded brush bounding box; never replace the whole page with a flat colour.
  const pad=it.stroke/2+48,rx=Math.max(0,Math.floor((it.x-pad)*density)),ry=Math.max(0,Math.floor((it.y-pad)*density)),rw=Math.min(base.width-rx,Math.ceil((it.w+pad*2)*density)),rh=Math.min(base.height-ry,Math.ceil((it.h+pad*2)*density));
  const patch=document.createElement('canvas');patch.width=rw;patch.height=rh;const ctx=patch.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(base,-rx,-ry);ctx.save();ctx.translate(-rx,-ry);ctx.scale(density,density);items.filter(i=>i.type==='restore').forEach(i=>draw(ctx,i));ctx.restore();
  const maskCanvas=document.createElement('canvas');maskCanvas.width=rw;maskCanvas.height=rh;const mc=maskCanvas.getContext('2d');mc.translate(-rx,-ry);mc.scale(density,density);mc.lineCap=mc.lineJoin='round';mc.lineWidth=it.stroke;mc.beginPath();it.points.forEach(([x,y],n)=>n?mc.lineTo(it.x+x,it.y+y):mc.moveTo(it.x+x,it.y+y));mc.stroke();
  const raw=mc.getImageData(0,0,rw,rh).data,mask=new Uint8Array(rw*rh);for(let i=0;i<mask.length;i++)mask[i]=raw[i*4+3];
  const source=ctx.getImageData(0,0,rw,rh),restored=restorePixels(source,mask,it.colourOnly);
  if(!restored.count){undo.pop();q('[data-message]').textContent=restored.reason==='no-background'?'주변 종이색을 찾지 못했습니다. 종이 여백 가까이에서 작게 나누어 지워 주세요.':it.colourOnly?'복원할 컬러 손글씨를 찾지 못했습니다. 검은 손글씨는 ‘영역 배경 복원’을 선택하세요.':'복원할 영역이 없습니다.';return;}
  ctx.putImageData(new ImageData(restored.data,rw,rh),0,0);const png=patch.toDataURL('image/png');patchImages.set(png,patch);items.push({type:'restore',x:rx/density,y:ry/density,w:rw/density,h:rh/density,png});chosen=-1;
  q('[data-message]').textContent='배경을 복원했습니다. 확인 후 적용하세요. 복원한 페이지는 이미지로 저장됩니다.';
 }
 function endStroke(){const it=items[chosen];if(drag?.type==='pen'&&it){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const [x,y] of it.points){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}it.points=it.points.map(([x,y])=>[x-minX,y-minY]);it.x+=minX;it.y+=minY;it.w=Math.max(1,maxX-minX);it.h=Math.max(1,maxY-minY);if(it.type==='restoreStroke'){items.pop();chosen=-1;try{restoreStroke(it);}catch(error){if(undo.length)items=undo.pop();q('[data-message]').textContent='복원하지 못했습니다. 영역을 작게 나누어 다시 시도하세요.';}}}drag=null;repaint();}
 overlay.onpointerup=e=>{endStroke();if(overlay.hasPointerCapture(e.pointerId))overlay.releasePointerCapture(e.pointerId);};overlay.onpointercancel=()=>{if(drag&&undo.length){items=undo.pop();chosen=-1;}drag=null;repaint();};
 q('[data-delete]').onclick=()=>{finishText();if(chosen<0)return;remember();items.splice(chosen,1);chosen=-1;repaint();};
 q('[data-undo]').onclick=()=>{finishText();if(undo.length){redo.push(structuredClone(items));items=undo.pop();chosen=-1;repaint();}};
 q('[data-redo]').onclick=()=>{finishText();if(redo.length){undo.push(structuredClone(items));items=redo.pop();chosen=-1;repaint();}};
 dialog.addEventListener('keydown',e=>{if(e.isComposing||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();q(e.shiftKey?'[data-redo]':'[data-undo]').click();}if(e.key==='Delete'){e.preventDefault();q('[data-delete]').click();}});
 for(const selector of ['[data-size]','[data-width]','[data-color]'])q(selector).onchange=()=>{if(paper.querySelector('.drawing-inline-text'))return;const it=items[chosen];if(!it||activeTool!=='select')return;remember();it.color=q('[data-color]').value;it.stroke=Math.max(1,Math.min(80,Number(q('[data-width]').value)||2));if(it.type==='text'){it.size=Math.max(8,Math.min(120,Number(q('[data-size]').value)||24));textBounds(it);}repaint();};
 q('[data-save]').disabled=false;q('[data-message]').textContent='적용하면 현재 페이지에 반영됩니다.';repaint();
 q('[data-save]').onclick=()=>{finishText();repaint(false);const [x,y]=viewport.convertToPdfPoint(0,h);const drawing=items.length?{revision:uid(),items:structuredClone(items),png:overlay.toDataURL('image/png'),x,y,width:w,height:h,angle:-rotation,rotation,pageRotation:p.drawing?.pageRotation??p.rotation}:null;if(drawing&&items.some(i=>i.type==='restore')){const flat=document.createElement('canvas');flat.width=base.width;flat.height=base.height;const ctx=flat.getContext('2d');ctx.drawImage(base,0,0);ctx.drawImage(overlay,0,0);drawing.flattened=flat.toDataURL('image/png');}dialog.close();edit(()=>{pages=pages.map(item=>item.id===id?{...item,drawing}:item);current=id;});say('편집 내용을 적용했습니다. 다운로드 PDF에도 포함됩니다.');};
 }catch(error){q('[data-message]').textContent='편집 화면을 열지 못했습니다: '+error.message;}
}

function deleteSelectedPages(){
 if(busy)return;
 const ids=new Set(viewPages().filter(p=>selected.has(p.id)).map(p=>p.id));
 if(!ids.size)return;
 edit(()=>{pages=pages.filter(p=>!ids.has(p.id));selected.clear();});
 say(`${ids.size}페이지를 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.`);
}
$('deleteSelected').onclick=deleteSelectedPages;
