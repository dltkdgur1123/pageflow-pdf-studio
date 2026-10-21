export const sampleSongs=[
 {title:'봄날의 산책',english:'Spring Walk',count:1,chosen:true},
 {title:'작은 별빛',english:'Little Starlight',count:1,chosen:false},
 {title:'바다로 가는 길',english:'Road to the Sea',count:2,chosen:true},
 {title:'오후의 편지',english:'Afternoon Letter',count:1,chosen:true},
 {title:'달빛 정원',english:'Moonlit Garden',count:1,chosen:false},
 {title:'다시 만나는 날',english:'Until We Meet',count:2,chosen:true}
];
export async function createSongbook(lib){
 const doc=await lib.PDFDocument.create();let number=0;const songs=[];
 for(const [i,song] of sampleSongs.entries()){
  const start=number;
  for(let part=0;part<song.count;part++){
   const page=doc.addPage([595,842]);number++;
   page.drawRectangle({x:0,y:720,width:595,height:122,color:lib.rgb(.15,.23,.18)});
   page.drawText('PAGEFLOW / SAMPLE SONGBOOK',{x:42,y:805,size:10,color:lib.rgb(.8,.9,.7)});
   page.drawText(`${String(i+1).padStart(2,'0')}  ${song.english}`,{x:42,y:760,size:24,color:lib.rgb(1,1,1)});
   page.drawText(`Song ${i+1} / Part ${part+1} of ${song.count}`,{x:42,y:687,size:12});
   page.drawText('Illustrative score - not an existing song',{x:42,y:665,size:10,color:lib.rgb(.4,.45,.4)});
   for(let staff=0;staff<6;staff++){
    const y=605-staff*82;
    for(let line=0;line<5;line++)page.drawLine({start:{x:45,y:y-line*7},end:{x:550,y:y-line*7},thickness:.6,color:lib.rgb(.4,.44,.4)});
    for(let bar=0;bar<5;bar++)page.drawLine({start:{x:45+bar*126,y},end:{x:45+bar*126,y:y-28},thickness:.7});
    for(let note=0;note<12;note++){
     const x=70+note*40,ny=y-((note*3+i+staff+part)%9)*3.5;
     page.drawEllipse({x,y:ny,xScale:4,yScale:3,color:lib.rgb(.12,.15,.12)});
     page.drawLine({start:{x:x+4,y:ny},end:{x:x+4,y:ny+24},thickness:.8});
    }
    page.drawText(['C','Am','F','G'][(staff+i)%4],{x:49,y:y+15,size:11});
   }
   page.drawText(`Original page ${number}  |  SAMPLE ONLY`,{x:42,y:40,size:10});
  }
  songs.push({...song,indexes:Array.from({length:song.count},(_,j)=>start+j)});
 }
 return {bytes:await doc.save(),songs};
}
export function collectSongPages(groups){return groups.filter(s=>s.chosen).flatMap(s=>s.pages.map(p=>({...p})));}
