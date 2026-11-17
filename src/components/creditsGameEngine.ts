// @ts-nocheck
/* Hidden coloring minigame on the big logo (Settings → About).
   Ported from the tuned preview; settings below are the user's final values. */
const CI={w:847,h:204,dotx:468.75,doty:121.5,dotr:23.625};
const STORE='margin:credits-game';
const cfg={holdSec:1,inkMult:4,inkUse:3,brush:40,threshold:75,touchOffset:10,idle:true,idleStrength:60,idleEvery:4,holdNeed:100,glow:12,lightSpeed:0.6,flight:1,creditsFade:1.4,creditsStay:5,haptics:true,varied:false};
export function mountCreditsGame(root, holdEls, IMG_WM, IMG_CREDITS){
let dead=false, rafId=0;
const disp=[]; const on=(el,ev,fn)=>{el.addEventListener(ev,fn);disp.push(()=>el.removeEventListener(ev,fn))};
const timers=[]; 
const L=300, MR=128, RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>id==='card'?root:root.querySelector('[data-cg="'+id+'"]');

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const dur=x=>RM?0.01:x;


const mem={};
function lsGet(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return mem[k]||null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){mem[k]=v}}
let S={done:0,ink:0,best:0,won:false,margin:0,waste:0,played:false,spill:0,paint:0,prevBest:0};
{const sv=lsGet(STORE)||{};if(typeof sv.best==='number')S.best=clamp(sv.best);S.played=!!sv.played}
S.winT0=0;
function saveS(){lsSet(STORE,{best:S.best,played:S.played})}
function saveC(){}

/* ---------- assets / letters ---------- */
const wmImg=new Image(), crImg=new Image();
let tint;const tmo=(f,ms)=>{const id=setTimeout(()=>{if(!dead)f()},ms);timers.push(id);return id};
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const NAMES=['m','a','r','g','i','n'];
const LET=[[0,344],[344,579],[579,724.5],[724.5,953],[953,1032.5],[1032.5,1255]];
const WMW=1375,WMH=380;
const WM={x:30,y:0,s:640/WMW};WM.y=(300-WMH*WM.s)/2;
const WMDOT={x:WM.x+1315.5*WM.s,y:WM.y+241*WM.s,r:50.5*WM.s*.95};
const CRW=560,CRs=CRW/CI.w,CR={w:CRW,h:CI.h*CRs,x:70,y:0};CR.y=(300-CR.h)/2;
const CRDOT={x:CR.x+CI.dotx*CRs,y:CR.y+CI.doty*CRs,r:CI.dotr*CRs};
const FR={x:14,y:44,w:672,h:212,r:34};
FR.per=2*(FR.w+FR.h-4*FR.r)+2*Math.PI*FR.r;
const COP='#B9684D', DOT='#D9895F';
let LT=[],sumArea=1;
const maskC=mk(MR,MR), mctx=maskC.getContext('2d',{willReadFrequently:true});
function drawLetterOn(ctx,o){ctx.drawImage(wmImg,o.sx,o.sy,o.bw,o.bh,o.dx,o.dy,o.bw*o.sc,o.bh*o.sc)}
function buildLetters(){
  const tmp=mk(WMW,WMH),t=tmp.getContext('2d',{willReadFrequently:true});t.drawImage(wmImg,0,0);
  const full=t.getImageData(0,0,WMW,WMH).data;
  LT=LET.map(([a,b])=>{a=Math.floor(a);b=Math.ceil(b);let x0=1e9,x1=-1,y0=1e9,y1=-1;
    for(let y=0;y<WMH;y++)for(let x=a;x<b;x++)if(full[(y*WMW+x)*4+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    const bw=x1-x0+1,bh=y1-y0+1,sc=Math.min(260/bw,260/bh);
    const o={sx:x0,sy:y0,bw,bh,sc,dx:150-bw*sc/2,dy:150-bh*sc/2};
    mctx.setTransform(1,0,0,1,0,0);mctx.clearRect(0,0,MR,MR);mctx.setTransform(MR/L,0,0,MR/L,0,0);drawLetterOn(mctx,o);
    const d=mctx.getImageData(0,0,MR,MR).data;o.mask=new Uint8Array(MR*MR);let n=0;
    for(let i=0;i<MR*MR;i++)if(d[i*4+3]>128){o.mask[i]=1;n++}
    o.px=n;o.area=n*(L/MR)*(L/MR);return o});
  sumArea=LT.reduce((a,o)=>a+o.area,0)}
const needed=()=>sumArea*cfg.threshold/100/cfg.brush;
const maxInk=()=>needed()*cfg.inkMult;

/* ---------- canvases ---------- */
const stage=$('stage'), sctx=stage.getContext('2d');
const paint=$('paint'), pctx=paint.getContext('2d');
const DPR=Math.min(3,window.devicePixelRatio||1);
paint.width=paint.height=Math.round(L*DPR);
const layer=mk(paint.width,paint.height), lctx=layer.getContext('2d');
const cov=mk(MR,MR), cctx=cov.getContext('2d',{willReadFrequently:true});
let letterCream=null,letterCop=null,fx=null,wmRing=null;
function sizeStage(){const w=Math.max(10,Math.round(stage.getBoundingClientRect().width*DPR));if(stage.width!==w){stage.width=w;stage.height=Math.round(w*300/700)}}

/* ---------- game state ---------- */
let resumeOnly=false,holdBase=0,retract=null,wasFull=false,holding=false,holdStart=0,drawerOpen=false,completing=null,painting=false,last=null,brushPos=null,hintT=0,dimAmt=0;
let litStart=[null,null,null,null,null,null],coverage=0,curIns=0,curSpill=0,strokeDist=0,palIdx=0,covTick=0;
const PAL_COPPER=['#B9684D','#DCA289','#8F4E3B'], PAL_VAR=['#B9684D','#DCA289','#8F4E3B','#F2E7DC','#6FA8A0','#E0B04A','#C9728B'];
const cur=()=>Math.min(S.done,5);
function clearPaint(){lctx.setTransform(1,0,0,1,0,0);lctx.clearRect(0,0,layer.width,layer.height);cctx.setTransform(1,0,0,1,0,0);cctx.clearRect(0,0,MR,MR);coverage=0;curIns=0;curSpill=0}
function loadShape(){
  fx=null;clearPaint();const o=LT[cur()];
  letterCream=mk(layer.width,layer.height);let t=letterCream.getContext('2d');t.setTransform(DPR,0,0,DPR,0,0);t.drawImage(wmImg,o.sx,o.sy,o.bw,o.bh,o.dx,o.dy,o.bw*o.sc,o.bh*o.sc);
  letterCop=mk(layer.width,layer.height);t=letterCop.getContext('2d');t.setTransform(DPR,0,0,DPR,0,0);t.drawImage(wmImg,o.sx,o.sy,o.bw,o.bh,o.dx,o.dy,o.bw*o.sc,o.bh*o.sc);t.setTransform(1,0,0,1,0,0);t.globalCompositeOperation='source-in';t.fillStyle=COP;t.fillRect(0,0,layer.width,layer.height);
  $('shapeName').innerHTML='<span>Emergency fund <b data-cg="resV">100%</b></span><span>Over budget <b data-cg="wasteV">0%</b></span>';completing=null}
function setHint(t,keep){const h=$('hint');h.textContent=t;h.style.opacity=t?1:0;clearTimeout(hintT);if(t&&!keep)hintT=tmo(()=>{h.style.opacity=0},3500)}
function buzz(ms){if(cfg.haptics)try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}}
let playTarget=300;
function lineThick(){const sc=stage.getBoundingClientRect().width/700;return 2*WMDOT.r*sc}
function layoutPlay(){
  const card=$('card'),pl=$('play'),st=stage.getBoundingClientRect(),cb=card.getBoundingClientRect(),padL=parseFloat(getComputedStyle(card).paddingLeft)||0;
  const sc=st.width/700,dotx=st.left-(cb.left+card.clientLeft)+WMDOT.x*sc,cw=card.clientWidth;
  const xl=cw-dotx,xr=dotx,th=lineThick(),pad=th/2+8;
  const avail=Math.max(100,(xr-xl)-2*pad),Sz=avail*.86;
  const key=[xl,xr,pad,Sz].map(v=>Math.round(v*10)).join('|');
  if(pl._k!==key){pl._k=key;pl.style.marginLeft=(xl-padL)+'px';pl.style.width=(xr-xl)+'px';$('playIn').style.padding=pad+'px';paint.style.width=Sz+'px'}
  playTarget=Math.round(2*pad+46+Sz);const h=drawerOpen?playTarget:0;pl.classList.toggle('open',drawerOpen);pl.classList.toggle('live',drawerOpen&&!!S.charged);if(pl._h!==h){pl._h=h;pl.style.height=h+'px'}}
function openDrawer(){if(drawerOpen)return;drawerOpen=true;layoutPlay()}
function closeDrawer(){drawerOpen=false;painting=false;brushPos=null;layoutPlay()}

/* trophy ring around the header logo (length = best emergency fund) */
const NS='http://www.w3.org/2000/svg';
const rings=holdEls.map(()=>{const sv=document.createElementNS(NS,'svg'),r=document.createElementNS(NS,'rect');
  sv.setAttribute('aria-hidden','true');sv.style.cssText='position:fixed;pointer-events:none;overflow:visible;z-index:31;display:none';
  r.setAttribute('fill','none');r.setAttribute('stroke',COP);r.setAttribute('stroke-width','2');r.setAttribute('stroke-linecap','round');r.setAttribute('pathLength','1');
  sv.appendChild(r);document.body.appendChild(sv);disp.push(()=>sv.remove());return [sv,r]});
function trophyDraw(){
  const frac=clamp(S.best),show=(S.played||S.best>0)&&frac>.01&&!root.classList.contains('cg-on');
  holdEls.forEach((el,i)=>{const[sv,r]=rings[i],b=el.getBoundingClientRect();
    if(!show||b.width<2){sv.style.display='none';return}
    const P=6,w=b.width+2*P,h=b.height+2*P;
    sv.style.display='';sv.style.left=(b.left-P)+'px';sv.style.top=(b.top-P)+'px';sv.setAttribute('width',w);sv.setAttribute('height',h);
    r.setAttribute('x',1);r.setAttribute('y',1);r.setAttribute('width',w-2);r.setAttribute('height',h-2);r.setAttribute('rx',Math.min(14,(h-2)/2));
    r.setAttribute('stroke-dasharray',frac+' 2');sv.style.filter='drop-shadow(0 0 '+(cfg.glow*(.3+.7*frac)/3)+'px '+COP+')'})}
/* hold on logo */
const onH=(ev,fn)=>holdEls.forEach(el=>on(el,ev,fn));
onH('contextmenu',e=>e.preventDefault());
onH('pointerdown',e=>{
  if(S.won||completing)return;
  e.preventDefault();try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}
  holding=true;resumeOnly=!!S.charged;holdBase=S.ink;retract=null;wasFull=false;holdStart=performance.now();setHint('')});
const endHold=()=>{
  if(!holding)return;holding=false;if(S.won)return;
  if(resumeOnly)return;
  const need=cfg.holdNeed/100*maxInk();
  if(S.ink<=holdBase+1)return;
  if(S.ink>=need-1e-6){S.charged=true;setHint(S.ink>=maxInk()-1?'Line complete — paint!':'');saveS()}
  else{retract={to:holdBase};setHint('Keep holding until the line is complete.')}};
onH('pointerup',endHold);onH('pointercancel',endHold);
on($('closeBtn'),'click',()=>closeDrawer());

/* painting — paint goes everywhere; outside the letter counts as waste */
function toLogical(e){const r=paint.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*L,y=(e.clientY-r.top)/r.height*L;if(e.pointerType==='touch')y-=cfg.touchOffset*L/r.width;return[clamp(x,0,L),clamp(y,0,L)]}
function color(){const pal=cfg.varied?PAL_VAR:PAL_COPPER;return pal[Math.floor(strokeDist/70+palIdx)%pal.length]}
function drawSeg(a,b){
  lctx.save();lctx.setTransform(DPR,0,0,DPR,0,0);lctx.strokeStyle=color();lctx.lineWidth=cfg.brush;lctx.lineCap='round';lctx.beginPath();lctx.moveTo(a[0],a[1]);lctx.lineTo(b[0]+.01,b[1]);lctx.stroke();lctx.restore();
  cctx.save();cctx.setTransform(MR/L,0,0,MR/L,0,0);cctx.strokeStyle='#fff';cctx.lineWidth=cfg.brush;cctx.lineCap='round';cctx.beginPath();cctx.moveTo(a[0],a[1]);cctx.lineTo(b[0]+.01,b[1]);cctx.stroke();cctx.restore()}
function measure(force){
  if(!force&&++covTick%3)return;
  const d=cctx.getImageData(0,0,MR,MR).data,m=LT[cur()].mask;let ins=0,sp=0;
  for(let i=0;i<MR*MR;i++)if(d[i*4+3]>128){if(m[i])ins++;else sp++}
  curIns=ins;curSpill=sp;coverage=Math.min(1,ins/LT[cur()].px)}
function stepPaint(pt){
  if(!last)last=pt;
  const d=Math.hypot(pt[0]-last[0],pt[1]-last[1]);
  S.ink=Math.max(0,S.ink-d*cfg.inkUse);strokeDist+=d;S._painted=true;
  drawSeg(last,pt);last=pt;measure(false);
  if(coverage>=cfg.threshold/100){measure(true);if(coverage>=cfg.threshold/100)beginComplete();return}
  if(S.ink<=0){painting=false;last=null;measure(true);
    if(coverage>=cfg.threshold/100)beginComplete();
    else tmo(()=>{if(!completing){closeDrawer();resetRun();setHint('Out of ink — hold the logo to start over.',true)}},450)}}
function beginComplete(){if(completing)return;painting=false;last=null;measure(true);S.paint+=curIns+curSpill;S.spill+=curSpill;completing={t0:performance.now(),filled:false}}
on(paint,'contextmenu',e=>e.preventDefault());
on(paint,'pointerdown',e=>{
  if(!drawerOpen||!S.charged||completing||holding||retract||S.won||S.ink<=0)return;
  e.preventDefault();try{paint.setPointerCapture(e.pointerId)}catch(_){}
  painting=true;last=null;palIdx=Math.floor(Math.random()*5);const pt=toLogical(e);brushPos=pt;stepPaint(pt);setHint('')});
on(paint,'pointermove',e=>{
  if(e.pointerType==='mouse'&&!painting){brushPos=toLogical(e);return}
  if(!painting)return;e.preventDefault();
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
  (evs.length?evs:[e]).forEach(ev=>{if(!painting)return;const pt=toLogical(ev);brushPos=pt;stepPaint(pt)})});
const endPaint=()=>{painting=false;last=null;if(!S.won)saveS()};
on(paint,'pointerup',endPaint);on(paint,'pointercancel',endPaint);
on(paint,'pointerleave',e=>{if(e.pointerType==='mouse'&&!painting)brushPos=null});

function setWon(){S.prevBest=S.best;S.won=true;S.played=true;S.margin=marginFrac(S.ink);S.waste=S.paint>0?clamp(S.spill/S.paint):0;S.best=Math.max(S.best,S.margin)}
function advance(){
  S.done++;litStart[S.done-1]=performance.now();buzz(18);
  if(S.done<6){saveS();loadShape();setHint('')}
  else{closeDrawer();setWon();S.winT0=performance.now()+700;saveS();setHint('');buzz([20,40,20])}}
function resetRun(){S.done=0;S.ink=0;S.spill=0;S.paint=0;S._painted=false;S.charged=false;litStart=[null,null,null,null,null,null];loadShape()}
function endWin(){S.charged=false;S.won=false;S.done=0;S.ink=0;S.spill=0;S.paint=0;S._painted=false;litStart=[null,null,null,null,null,null];loadShape();saveS()}

/* ---------- drawing ---------- */
function makeRing(src,ow,col){const w=src.width,h=src.height,rc=mk(w,h),t=rc.getContext('2d');
  for(const m of [1,.55]){for(let a=0;a<16;a++){t.drawImage(src,Math.cos(a/16*Math.PI*2)*ow*m,Math.sin(a/16*Math.PI*2)*ow*m)}}
  t.globalCompositeOperation='source-in';t.fillStyle=col;t.fillRect(0,0,w,h);
  t.globalCompositeOperation='destination-out';t.drawImage(src,0,0);return rc}
function startFx(now){
  const o=LT[cur()],idx=[];for(let i=0;i<MR*MR;i++)if(o.mask[i])idx.push(i);
  const cols=['#F2B48C','#D9895F','#F5F5F4'],ps=[];
  for(let n=0;n<34&&idx.length;n++){const i=idx[Math.floor(Math.random()*idx.length)],x=(i%MR)*(L/MR),y=Math.floor(i/MR)*(L/MR);
    const ang=Math.atan2(y-150,x-150)+(Math.random()-.5)*1.2,sp=40+Math.random()*110;
    ps.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:.7+Math.random()*.5,d:Math.random()*.25,s:1.6+Math.random()*2.6,c:cols[n%3]})}
  const old=mk(layer.width,layer.height);old.getContext('2d').drawImage(layer,0,0);
  fx={t0:now,ring:makeRing(letterCream,5*DPR,'#F2B48C'),ps,old}}
function drawPaint(now){
  const c=pctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,paint.width,paint.height);
  c.fillStyle='#1a1817';c.fillRect(0,0,paint.width,paint.height);
  c.globalAlpha=.3;c.drawImage(letterCream,0,0);c.globalAlpha=1;
  if(fx){const e=(now-fx.t0)/1000;c.globalAlpha=1-clamp(e/.35);c.drawImage(fx.old,0,0);c.globalAlpha=1}
  c.drawImage(layer,0,0);
  c.globalAlpha=.32;c.drawImage(letterCream,0,0);c.globalAlpha=1;
  if(fx){const e=(now-fx.t0)/1000,rv=ease(clamp(e/.55));
    c.save();c.beginPath();c.rect(0,0,paint.width*rv,paint.height);c.clip();
    c.shadowColor='#F2B48C';c.shadowBlur=(10+8*Math.sin(e*9))*DPR;c.globalAlpha=1-clamp((e-1.0)/.35)*.4;c.drawImage(fx.ring,0,0);c.restore();
    c.setTransform(DPR,0,0,DPR,0,0);
    for(const p of fx.ps){const t=e-p.d;if(t>0&&t<p.life){c.globalAlpha=1-t/p.life;c.fillStyle=p.c;c.beginPath();c.arc(p.x+p.vx*t,p.y+p.vy*t+30*t*t,p.s,0,7);c.fill()}}
    c.globalAlpha=1;c.setTransform(1,0,0,1,0,0)}
  if(brushPos&&drawerOpen&&!completing){c.setTransform(DPR,0,0,DPR,0,0);c.beginPath();c.arc(brushPos[0],brushPos[1],cfg.brush/2,0,7);c.lineWidth=1.5;c.strokeStyle='rgba(245,245,244,.9)';c.stroke()}}
let lineD='',reserveFrac=.15;
const marginFrac=I=>clamp(I/(maxInk()*(reserveFrac||.1)));
let lastRect=null,lineFlash=-1e9,sparks=[];
const fxc=$('fxc'),fctx=fxc.getContext('2d');
function popFx(now){
  lineFlash=now;buzz(25);setHint('');
  if(!lastRect)return;const{x0,x1,top,bot}=lastRect,cx=(x0+x1)/2,cy=(top+bot)/2,W=x1-x0,H=bot-top,per=2*(W+H);
  const cols=['#F2B48C','#D9895F','#F5F5F4'];
  for(let n=0;n<60;n++){let t=Math.random()*per,x,y;
    if(t<W){x=x0+t;y=top}else if(t<W+H){x=x1;y=top+(t-W)}else if(t<2*W+H){x=x1-(t-W-H);y=bot}else{x=x0;y=bot-(t-2*W-H)}
    const a=Math.atan2(y-cy,x-cx)+(Math.random()-.5)*.6,sp=40+Math.random()*120;
    sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t0:now+Math.random()*120,life:.6+Math.random()*.6,s:1.6+Math.random()*2.6,c:cols[n%3]})}}
function drawFx(now){
  const card=$('card'),w=card.clientWidth,h=card.clientHeight,k=DPR;
  if(fxc.width!==Math.round(w*k)||fxc.height!==Math.round(h*k)){fxc.width=Math.round(w*k);fxc.height=Math.round(h*k)}
  fctx.setTransform(k,0,0,k,0,0);fctx.clearRect(0,0,w,h);
  sparks=sparks.filter(p=>(now-p.t0)/1000<p.life);
  for(const p of sparks){const t=(now-p.t0)/1000;if(t<0)continue;fctx.globalAlpha=1-t/p.life;fctx.fillStyle=p.c;fctx.beginPath();fctx.arc(p.x+p.vx*t,p.y+p.vy*t+30*t*t,p.s,0,7);fctx.fill()}
  fctx.globalAlpha=1}
function drawInk(){
  const sv=$('lineSvg').getBoundingClientRect(),st=stage.getBoundingClientRect(),pl=$('play').getBoundingClientRect();
  const sc=st.width/700,dx=st.left-sv.left+WMDOT.x*sc,dy=st.top-sv.top+WMDOT.y*sc,th=lineThick();
  const vis=clamp(pl.height/playTarget);
  const ln=$('inkLine'),base=$('inkBase'),tk=$('tick');
  const x0=pl.left-sv.left,x1=dx,top=pl.top-sv.top,bot=pl.bottom-sv.top;lastRect={x0,x1,top,bot};
  const r=Math.max(1,Math.min(30,(bot-top)/2-1,(x1-x0)/2-1));
  if(vis<.03||bot-top<8){ln.style.opacity=0;base.style.opacity=0;tk.style.display='none';return}
  const d=`M${x1},${dy} V${bot-r} A${r},${r} 0 0 1 ${x1-r},${bot} H${x0+r} A${r},${r} 0 0 1 ${x0},${bot-r} V${top+r} A${r},${r} 0 0 1 ${x0+r},${top} H${x1-r} A${r},${r} 0 0 1 ${x1},${top+r}`;
  if(d!==lineD){lineD=d;ln.setAttribute('d',d);base.setAttribute('d',d);ln._tot=ln.getTotalLength()}
  ln.setAttribute('stroke-width',th);base.setAttribute('stroke-width',th);
  const tot=ln._tot,M=maxInk(),I=S.ink,stemLen=Math.max(0,top+r-dy);
  reserveFrac=clamp(stemLen/tot,0,.6);
  const la=0,lb=clamp(I/M)*tot;
  const frac=clamp(I/M);
  ln.setAttribute('stroke-dasharray',Math.max(0,lb-la)+' '+(tot*3));ln.setAttribute('stroke-dashoffset',-la);
  const empty=lb-la<1;
  ln.style.opacity=empty?0:vis;base.style.opacity=.55*vis;
  {const fl=1-clamp((performance.now()-lineFlash)/600);ln.style.filter=(cfg.glow>0||fl>0)?`drop-shadow(0 0 ${cfg.glow*(.3+.7*frac)+34*fl}px #D9895F)`:'none'}
  tk.style.display='none'}
let frameFrac=0,frameAlpha=1;
function drawStage(now,dt){
  sizeStage();const k=stage.width/700,c=sctx;c.setTransform(k,0,0,k,0,0);c.clearRect(0,0,700,300);
  const wt=S.won?(now-S.winT0)/1000:-1;
  const Tl=dur(cfg.lightSpeed),Th=Tl+(RM?.01:.5),Tf=dur(cfg.flight),Ta=Th+Tf,Tc=dur(cfg.creditsFade),Tout=RM?.01:.7,Troll=dur(cfg.flight)*1.3;
  const Tb=Ta+Tc+cfg.creditsStay,Tend=Tb+Math.max(Troll,Tout)+(RM?.01:.9);
  const active=S.won?(wt<Tb+.3):(S.done>0||drawerOpen||holding||!!completing);
  dimAmt+=clamp((active?1:0)-dimAmt,-dt*4,dt*4);
  let la=1;if(S.won){if(wt<Th)la=1;else if(wt<Tb)la=1-clamp((wt-Th)/Tout);else la=clamp((wt-(Tb+.3))/Tout)}
  const litA=(S.won&&wt>=Tb)?0:la;
  const base=lerp(1,.2,dimAmt)*la;
  if(base>0||litA>0){
    for(let i=0;i<6;i++){
      const sx=LET[i][0],sw=LET[i][1]-LET[i][0];
      const dx=WM.x+sx*WM.s,dy=WM.y,dw=sw*WM.s,dh=WMH*WM.s;
      c.globalAlpha=base;c.drawImage(wmImg,sx,0,sw,WMH,dx,dy,dw,dh);
      const p=litStart[i]?clamp((now-litStart[i])/(Tl*1000)):(i<S.done?1:0);
      if(p>0&&litA>0){c.globalAlpha=litA;const ep=ease(p);c.drawImage(tint,sx,WMH*(1-ep),sw,WMH*ep,dx,dy+dh*(1-ep),dw,dh*ep)}}}
  c.globalAlpha=1;
  // completion flourish: copper outline traces the letters, then a spark burst from the dot
  if(S.won&&wt>-.3&&wt<Tb&&wmRing){
    const rv=ease(clamp((wt+.25)/.85)),pd=wmRing.pad*WM.s,x0=WM.x-pd,w=(WMW*WM.s+2*pd);
    c.save();c.beginPath();c.rect(x0,0,w*rv,300);c.clip();
    c.shadowColor='#F2B48C';c.shadowBlur=(8+6*Math.sin(wt*8))*k;c.globalAlpha=la;
    c.drawImage(wmRing,x0,WM.y-pd,w,WMH*WM.s+2*pd);c.restore();
    const t0=Tl*.5;
    for(let i=0;i<26;i++){const t=wt-t0,ang=(i*2.399)%(Math.PI*2),sp=60+((i*37)%70),life=.8+((i*13)%5)*.09;
      if(t>0&&t<life){c.globalAlpha=1-t/life;c.fillStyle=i%3?'#F2B48C':'#F5F5F4';c.beginPath();c.arc(WMDOT.x+Math.cos(ang)*sp*t,WMDOT.y+Math.sin(ang)*sp*t+24*t*t,2+(i%3),0,7);c.fill()}}
    c.globalAlpha=1}
  // idle animation: the dot hops twice, then rests
  const idleAmt=(cfg.idle&&!RM&&!S.won)?clamp(1-dimAmt)*cfg.idleStrength/100:0;
  let bY=0,bsx=1,bsy=1;
  if(idleAmt>.01){
    const u=((now/1000)%cfg.idleEvery)/1.1;
    if(u<1){const s=Math.abs(Math.sin(2*Math.PI*u));bY=-22*idleAmt*s*(1-.55*u);
      if(s<.14){const q=1-s/.14;bsx=1+.16*idleAmt*q;bsy=1-.16*idleAmt*q}}}
  // trophy frame (stays after the game; length = best margin)
  let tgt;if(S.won){tgt=wt>=Ta&&wt<Tb?S.margin:(wt>=Tb?S.best:S.prevBest)}else tgt=S.best;
  frameFrac+=clamp(tgt-frameFrac,-dt*.5,dt*.5);
  const runActive=S.done>0||drawerOpen||holding||!!completing;
  frameAlpha+=clamp((S.won||!runActive?1:0)-frameAlpha,-dt*3,dt*3);
  const glowF=cfg.glow*(.3+.7*frameFrac);
  if(frameFrac*FR.per>1&&frameAlpha>.01){c.save();c.globalAlpha=frameAlpha;c.strokeStyle=COP;c.lineWidth=5;c.lineCap='round';c.setLineDash([frameFrac*FR.per,FR.per*2]);
    if(glowF>0){c.shadowColor=COP;c.shadowBlur=glowF*k}
    const p=new Path2D(),x=FR.x,y=FR.y,w=FR.w,h=FR.h,rr=FR.r;
    p.moveTo(x+rr,y);p.arcTo(x+w,y,x+w,y+h,rr);p.arcTo(x+w,y+h,x,y+h,rr);p.arcTo(x,y+h,x,y,rr);p.arcTo(x,y,x+w,y,rr);p.closePath();c.stroke(p);c.restore()}
  // dot
  const dl=S.won?clamp(wt/Tl):0;let pos=WMDOT,r=WMDOT.r,rollA=0,rollAng=0;
  if(S.won&&wt>=Th){
    if(wt<Tb){const f=ease(clamp((wt-Th)/Tf)),P0=WMDOT,P2=CRDOT,Cc={x:(P0.x+P2.x)/2+10,y:Math.min(P0.y,P2.y)-95};
      pos={x:(1-f)*(1-f)*P0.x+2*(1-f)*f*Cc.x+f*f*P2.x,y:(1-f)*(1-f)*P0.y+2*(1-f)*f*Cc.y+f*f*P2.y};r=lerp(P0.r,P2.r,f)}
    else{const f=ease(clamp((wt-Tb)/Troll));pos={x:lerp(CRDOT.x,WMDOT.x,f),y:lerp(CRDOT.y,WMDOT.y,f)};r=lerp(CRDOT.r,WMDOT.r,f);
      rollAng=Math.hypot(pos.x-CRDOT.x,pos.y-CRDOT.y)/((CRDOT.r+WMDOT.r)/2)-Math.PI/2;rollA=clamp(f*8)*clamp((1-f)*8)}}
  const mf=S.won?S.margin:1,glowK=cfg.glow*(.3+.7*mf);
  const gf=S.won?(wt<Tb+Troll?1:1-clamp((wt-Tb-Troll)/.5)):0;
  c.save();c.globalAlpha=lerp(1,.2+.8*dl,dimAmt);c.fillStyle=DOT;if(dl>0&&glowK>0){c.shadowColor=DOT;c.shadowBlur=glowK*k*dl*gf}c.beginPath();c.ellipse(pos.x,pos.y+bY+r*(1-bsy),r*bsx,r*bsy,0,0,Math.PI*2);c.fill();c.restore();
  if(rollA>0){c.save();c.globalAlpha=rollA*.7;c.fillStyle='#FFE9D6';c.beginPath();c.arc(pos.x+Math.cos(rollAng)*r*.55,pos.y+Math.sin(rollAng)*r*.55,r*.2,0,7);c.fill();c.restore()}
  // credits
  const mt=$('marginTxt');let txt='';
  if(S.won&&wt>=Ta){
    const out=wt>=Tb?1-clamp((wt-Tb)/Tout):1;
    const ca=clamp((wt-Ta)/Tc)*out;c.globalAlpha=ca;c.drawImage(crImg,CR.x,CR.y,CR.w,CR.h);c.globalAlpha=1}
  if(S.won&&wt<Tb){if(wt>=Ta+Tc)txt='Emergency fund '+Math.round(S.margin*100)+'%  ·  Over budget '+Math.round(S.waste*100)+'%'}

  if(mt.textContent!==txt)mt.textContent=txt;
  c.globalAlpha=1;
  if(S.won&&wt>=Tend)endWin()}

/* ---------- main loop ---------- */
let prev=performance.now();
function tick(now){
  const dt=Math.min(.1,(now-prev)/1000);prev=now;
  if(holding){const el=now-holdStart;if(el>350&&!drawerOpen)openDrawer();
    if(!resumeOnly&&(el>350||drawerOpen)){S.ink=Math.min(maxInk(),S.ink+maxInk()/cfg.holdSec*dt)}}
  if(S.ink>maxInk())S.ink=maxInk();
  if(holding&&!resumeOnly&&!S.charged&&drawerOpen&&S.ink>=cfg.holdNeed/100*maxInk()-1e-6){S.charged=true;popFx(now)}
  if(holding&&!resumeOnly&&!wasFull&&S.ink>=maxInk()-1){wasFull=true;buzz(15)}
  if(retract&&!holding){S.ink=Math.max(retract.to,S.ink-maxInk()/cfg.holdSec*2.5*dt);if(S.ink<=retract.to+.01){S.ink=retract.to;const keep=S._painted||retract.to>1;retract=null;if(!keep)closeDrawer()}}
  if(completing){const e=now-completing.t0;
    if(!completing.filled&&e>250){completing.filled=true;startFx(now);lctx.setTransform(1,0,0,1,0,0);lctx.clearRect(0,0,layer.width,layer.height);lctx.drawImage(letterCop,0,0);coverage=1}
    if(e>(RM?300:1600)){completing=null;advance()}}
  {const onNow=holding||drawerOpen||S.done>0||!!completing||!!retract||S.won||dimAmt>.02;root.classList.toggle('cg-on',onNow);trophyDraw()}
  layoutPlay();drawPaint(now);drawInk();drawFx(now);drawStage(now,dt);
  $('covFill').style.width=(clamp(coverage/(cfg.threshold/100))*100)+'%';
  const rv2=$('resV');if(rv2)rv2.textContent=Math.round(clamp(S.ink/(maxInk()*(reserveFrac||.1)))*100)+'%';
  const wv=$('wasteV');if(wv){const tot=curIns+curSpill;wv.textContent=(tot>0?Math.round(curSpill/tot*100):0)+'%'}
  if(!dead)rafId=requestAnimationFrame(tick)}

function onCfg(){layoutPlay()}

/* ---------- start ---------- */
let loaded=0;
function ready(){if(++loaded<2||dead)return;
  tint=mk(wmImg.naturalWidth,wmImg.naturalHeight);const t=tint.getContext('2d');t.drawImage(wmImg,0,0);t.globalCompositeOperation='source-in';t.fillStyle=COP;t.fillRect(0,0,tint.width,tint.height);
  const PAD=24,wr=mk(WMW+2*PAD,WMH+2*PAD),wc=wr.getContext('2d');
  for(const m of [1,.55]){for(let a=0;a<20;a++){wc.drawImage(wmImg,PAD+Math.cos(a/20*Math.PI*2)*13*m,PAD+Math.sin(a/20*Math.PI*2)*13*m)}}
  wc.globalCompositeOperation='source-in';wc.fillStyle='#F2B48C';wc.fillRect(0,0,wr.width,wr.height);
  wc.globalCompositeOperation='destination-out';wc.drawImage(wmImg,PAD,PAD);wmRing=wr;wmRing.pad=PAD;
  frameFrac=S.best;buildLetters();onCfg();if(S.won){S.won=false}if(S.done>=6){S.done=0;S.ink=0}loadShape();if(S.ink>maxInk())S.ink=maxInk();
  rafId=requestAnimationFrame(t0=>{prev=t0;tick(t0)})}
wmImg.onload=crImg.onload=ready;wmImg.src=IMG_WM;crImg.src=IMG_CREDITS;
return ()=>{dead=true;cancelAnimationFrame(rafId);timers.forEach(clearTimeout);disp.forEach(f=>f())}
}
