/* ================================================================
   Pop It — The Ultimate Anti-Stress Bubble Game 🎈
================================================================ */

/* ─── LEVEL CONFIG ─── */
const LEVELS = [
  { num:1, name:'WARM UP',     msg:'Pop all bubbles to advance!\nBuild combos for bonus points.',  bubbles:24, minR:18, maxR:54, speed:1.0 },
  { num:2, name:'BUBBLE RUSH', msg:'More bubbles incoming!\nKeep your combo streak alive.',         bubbles:30, minR:16, maxR:50, speed:1.1 },
  { num:3, name:'POP FRENZY',  msg:'Bubbles shrink faster now.\nBig combos = massive points!',     bubbles:36, minR:14, maxR:46, speed:1.2 },
  { num:4, name:'CHAOS MODE',  msg:'Tiny bubbles are worth more.\nPrecision is key!',              bubbles:42, minR:12, maxR:42, speed:1.3 },
  { num:5, name:'∞ ENDLESS',   msg:'You\'ve mastered the art of popping.\nThis loop never ends…', bubbles:48, minR:10, maxR:40, speed:1.4 },
];
function getLevel(n){ return LEVELS[Math.min(n-1, LEVELS.length-1)]; }

/* ─── STATE ─── */
const State = {
  current:   'start',
  level:     1,
  score:     0,
  xp:        0,
  xpNeeded:  300,
  combo:     0,
  bestCombo: 0,
  totalPopped: 0,
  bestScore: parseInt(localStorage.getItem('bpp_best') || '0'),
  gamesPlayed: parseInt(localStorage.getItem('bpp_played') || '0'),
  comboTimer: null,
  COMBO_WIN:  1300,
};

/* ─── PALETTE (vibrant, varied) ─── */
const PALETTES = {
  core: [
    [120,160,255,200], // electric blue
    [200,120,255,200], // violet
    [255,100,180,200], // hot pink
    [80,230,220,200],  // cyan
    [100,255,160,200], // neon green
    [255,200,80,200],  // gold
    [255,130,80,200],  // orange
    [180,80,255,200],  // purple
    [80,220,255,200],  // sky blue
    [255,80,120,200],  // red-pink
  ],
  neon: [
    [0,240,255,210],   // laser cyan
    [255,0,200,210],   // magenta
    [0,255,120,210],   // matrix green
    [255,200,0,210],   // amber
    [120,80,255,210],  // deep violet
  ]
};
function rndPalette(lvl){ return lvl >= 4 ? PALETTES.neon : PALETTES.core; }
function rndCol(lvl){ const p=rndPalette(lvl); return p[Math.floor(Math.random()*p.length)]; }

/* ─── AUDIO ─── */
let audioCtx=null;
function initAudio(){
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
}
function playPop(r){
  try{
    initAudio();
    const freq=380+(1-r/54)*420+Math.random()*60;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    const filter=audioCtx.createBiquadFilter();
    filter.type='bandpass'; filter.frequency.value=freq*1.2; filter.Q.value=2;
    osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc.type='sine'; osc.frequency.setValueAtTime(freq,audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq*.55,audioCtx.currentTime+.1);
    gain.gain.setValueAtTime(.1,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.18);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+.18);
  }catch(e){}
}
function playCombo(n){
  try{
    initAudio();
    const notes=[523,659,784,988,1175,1319];
    const freq=notes[Math.min(n-2,notes.length-1)];
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type='triangle'; osc.frequency.value=freq;
    gain.gain.setValueAtTime(.07,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.3);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+.3);
  }catch(e){}
}
function playLevelUp(){
  try{
    initAudio();
    [523,659,784,1047].forEach((f,i)=>{
      const osc=audioCtx.createOscillator();
      const gain=audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type='sine'; osc.frequency.value=f;
      const t=audioCtx.currentTime+i*.12;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(.08,t+.04);
      gain.gain.exponentialRampToValueAtTime(.001,t+.25);
      osc.start(t); osc.stop(t+.25);
    });
  }catch(e){}
}

/* ─── DOM ─── */
const $=id=>document.getElementById(id);
const screens={ start:$('screen-start'), game:$('screen-game'), gameover:$('screen-gameover') };
const hud=$('hud'), hudScore=$('hud-score'), hudBest=$('hud-best');
const hudLeft=$('hud-left'), hudLvl=$('hud-lvl');
const comboToast=$('combo-toast'), refillHint=$('refill-hint');
const pauseOverlay=$('pause-overlay'), levelOverlay=$('level-overlay');
const fabRestart=$('btn-fab-restart'), fabLabel=$('fab-label');

/* ─── SCREEN TRANSITION ─── */
function showScreen(name){
  // hide all screens
  Object.entries(screens).forEach(([k,s])=>{
    if(s.classList.contains('active')){
      gsap.to(s,{opacity:0,scale:.96,y:-10,duration:.25,ease:'power2.in',
        onComplete:()=>s.classList.remove('active')});
    }
  });
  if(name!=='game'){
    gsap.to(hud,{opacity:0,y:-8,duration:.2});
    fabRestart.style.display='none';
  }
  setTimeout(()=>{
    const t=screens[name];
    if(!t) return;
    t.classList.add('active');
    gsap.fromTo(t,{opacity:0,scale:.93,y:24},{opacity:1,scale:1,y:0,duration:.45,ease:'back.out(1.5)'});
    if(name==='game'){
      gsap.to(hud,{opacity:1,y:0,duration:.4,delay:.2});
      fabRestart.style.display='flex';
      gsap.fromTo(fabRestart,{scale:0,rotate:-180},{scale:1,rotate:0,duration:.5,delay:.4,ease:'back.out(2)'});
    }
  },230);
}

/* ─── SCORE POP ─── */
function spawnScorePop(cx,cy,pts,combo){
  const el=document.createElement('div');
  el.className='score-pop';
  el.textContent=combo>1?`+${pts} ×${combo}`:`+${pts}`;
  const cvs=document.getElementById('p5canvas').getBoundingClientRect();
  const sx=cvs.width/(p5inst?p5inst.width:1);
  const sy=cvs.height/(p5inst?p5inst.height:1);
  el.style.left=(cvs.left+cx*sx)+'px';
  el.style.top=(cvs.top+cy*sy-10)+'px';
  el.style.fontSize=combo>1?'1.2rem':'.9rem';
  el.style.color=combo>1?'#f472b6':'#4f8ef7';
  el.style.textShadow=combo>1?'0 0 16px rgba(244,114,182,.8)':'0 0 12px rgba(79,142,247,.7)';
  document.body.appendChild(el);
  gsap.fromTo(el,{opacity:1,y:0,scale:1},{opacity:0,y:-65,scale:combo>1?1.35:1.1,duration:.9,ease:'power2.out',onComplete:()=>el.remove()});
}

/* ─── COMBO ─── */
function triggerCombo(){
  State.combo++;
  if(State.combo>State.bestCombo) State.bestCombo=State.combo;
  clearTimeout(State.comboTimer);
  State.comboTimer=setTimeout(resetCombo, State.COMBO_WIN);
  if(State.combo>=2){
    const labels={2:'DOUBLE!',3:'TRIPLE!',4:'QUAD!',5:'FRENZY!',6:'INSANE!',7:'UNSTOPPABLE!'};
    comboToast.textContent=labels[Math.min(State.combo,7)]||`${State.combo}× CHAIN!`;
    gsap.killTweensOf(comboToast);
    gsap.fromTo(comboToast,{opacity:0,y:-8,scale:.8},{opacity:1,y:0,scale:1,duration:.22,ease:'back.out(2)',
      onComplete:()=>gsap.to(comboToast,{opacity:0,y:8,delay:.75,duration:.3})});
    playCombo(State.combo);
  }
}
function resetCombo(){ State.combo=0; }

/* ─── SCORE ─── */
function addScore(r,cx,cy){
  const base=Math.round(r*2.8);
  const mult=State.combo>=2?State.combo:1;
  const pts=base*mult;
  State.score+=pts;
  State.xp+=Math.round(pts*.4);
  hudScore.textContent=State.score;
  gsap.fromTo(hudScore,{scale:1.4,color:'#f472b6'},{scale:1,color:'#4f8ef7',duration:.4,ease:'elastic.out(1,.5)'});
  spawnScorePop(cx,cy,pts,mult);
  State.totalPopped++;
  hudLeft.textContent=bubbles.length;
}

/* ─── BUBBLES ─── */
let bubbles=[], sparkles=[];
let gameActive=false;
let p5inst=null;

class Bubble{
  constructor(x,y,r,col){
    this.x=x; this.y=y; this.r=r;
    this.col=col||rndCol(State.level);
    this.phaseX=Math.random()*100;
    this.phaseY=Math.random()*100;
    this.drift=.22+Math.random()*.28;
    this.hlAngle=Math.random()*Math.PI*2;
    this.hlSpeed=.002+Math.random()*.004;
    this.born=Date.now();
    this.drawScale=0;
  }
  floatUpdate(){
    this.phaseX+=.005; this.phaseY+=.004;
    this.x+=Math.sin(this.phaseX)*this.drift*.22;
    this.y+=Math.cos(this.phaseY)*this.drift*.22;
    const p=p5inst, m=this.r+6;
    if(this.x<m) this.x=m;
    if(this.x>p.width-m) this.x=p.width-m;
    if(this.y<m) this.y=m;
    if(this.y>p.height-m) this.y=p.height-m;
    this.hlAngle+=this.hlSpeed;
    const age=(Date.now()-this.born)/350;
    this.drawScale=Math.min(1, age<1? age*age*(3-2*age):1);
  }
  contains(px,py){
    return p5inst.dist(px,py,this.x,this.y)<this.r+5;
  }
  draw(){
    const p=p5inst;
    const r=this.r*this.drawScale; if(r<1) return;
    const {x,y}=this;
    const [cr,cg,cb,ca]=this.col;
    p.push(); p.noStroke();

    // outer glow (multi-layer, vivid)
    for(let i=4;i>0;i--){
      p.fill(cr,cg,cb,6-i*1);
      p.ellipse(x,y,r*2.1+i*7);
    }
    // neon rim glow
    p.fill(cr,cg,cb,20);
    p.ellipse(x,y,r*2.3);

    // base sphere — rich translucent color
    p.fill(cr,cg,cb,ca||190);
    p.ellipse(x,y,r*2);

    // color gradient center (lighter)
    const lR=Math.min(255,cr+60), lG=Math.min(255,cg+60), lB=Math.min(255,cb+60);
    p.fill(lR,lG,lB,80);
    p.ellipse(x-r*.15,y-r*.15,r*1.3);

    // dark shading bottom-right
    p.fill(Math.max(0,cr-60),Math.max(0,cg-60),Math.max(0,cb-60),70);
    p.ellipse(x+r*.22,y+r*.22,r*1.4);

    // specular highlight main
    const hlX=x-r*.28+Math.cos(this.hlAngle)*r*.07;
    const hlY=y-r*.28+Math.sin(this.hlAngle)*r*.07;
    p.fill(255,255,255,55);
    p.ellipse(hlX,hlY,r*1.1,r*.85);
    p.fill(255,255,255,115);
    p.ellipse(hlX-r*.15,hlY-r*.15,r*.38,r*.28);
    // tiny glint
    p.fill(255,255,255,180);
    p.ellipse(hlX-r*.22,hlY-r*.22,r*.14,r*.1);

    // neon edge ring
    p.noFill();
    p.stroke(cr,cg,cb,55);
    p.strokeWeight(1.5);
    p.ellipse(x,y,r*2-1.5);
    // top arc highlight
    p.stroke(255,255,255,30);
    p.strokeWeight(1.2);
    p.arc(x,y,r*1.7,r*1.7,-Math.PI*.75,-Math.PI*.1);

    p.pop();
  }
  popBubble(){
    const p=p5inst;
    const [cr,cg,cb]=this.col;
    const count=Math.floor(this.r*.55)+10;
    for(let i=0;i<count;i++){
      const angle=p.random(p.TWO_PI);
      const speed=p.random(.5,3.2);
      // mix bubble color with random neon
      const mix=rndCol(State.level);
      sparkles.push(new Sparkle(this.x,this.y,Math.cos(angle)*speed,Math.sin(angle)*speed,
        p.random(3,13),[cr*.5+mix[0]*.5,cg*.5+mix[1]*.5,cb*.5+mix[2]*.5]));
    }
    playPop(this.r);
  }
}

class Sparkle{
  constructor(x,y,vx,vy,size,col){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.size=size;this.col=col;
    this.life=1; this.decay=.006+Math.random()*.016;
  }
  update(){
    this.x+=this.vx; this.y+=this.vy;
    this.vx*=.96; this.vy*=.96;
    this.life-=this.decay; this.size*=.998;
    return this.life>.02&&this.size>.3;
  }
  draw(){
    const p=p5inst; p.push(); p.noStroke();
    const a=this.life*210;
    const [r,g,b]=this.col;
    p.fill(r,g,b,a);
    p.ellipse(this.x,this.y,this.size*this.life*1.8);
    p.fill(r,g,b,a*.2);
    p.ellipse(this.x,this.y,this.size*3.5*this.life);
    p.fill(255,255,255,a*.32);
    p.ellipse(this.x,this.y,this.size*.65*this.life);
    p.pop();
  }
}

function spawnBubbles(count){
  const p=p5inst; if(!p) return;
  const cfg=getLevel(State.level);
  const n=count||cfg.bubbles+Math.floor(p.random(6));
  for(let i=0;i<n;i++){
    const r=p.random(cfg.minR,cfg.maxR);
    const x=p.random(r+14,p.width-r-14);
    const y=p.random(r+14,p.height-r-14);
    bubbles.push(new Bubble(x,y,r,rndCol(State.level)));
  }
  hudLeft.textContent=bubbles.length;
  gsap.to(refillHint,{opacity:0,duration:.3});
}

function handlePop(px,py){
  if(!gameActive||State.current==='pause'||State.current==='levelup') return;
  const hits=[];
  for(let i=0;i<bubbles.length;i++) if(bubbles[i].contains(px,py)) hits.push(i);
  if(!hits.length){
    // miss sparkle feedback
    for(let i=0;i<4;i++) sparkles.push(new Sparkle(px,py,(Math.random()-.5)*1.3,(Math.random()-.5)*1.3,Math.random()*5+2,rndCol(State.level)));
    return;
  }
  let idx=hits[0];
  for(const i of hits) if(bubbles[i].r>bubbles[idx].r) idx=i;
  const b=bubbles[idx];
  b.popBubble();
  bubbles.splice(idx,1);
  triggerCombo();
  addScore(b.r,b.x,b.y);
  // check level complete — simple delay, lock prevents double-fire
  if(bubbles.length === 0){
    setTimeout(levelComplete, 700);
  }
}

/* ─── P5 SKETCH ─── */
new p5(function(p){
  p5inst=p;
  p.setup=function(){
    const c=p.createCanvas(p.windowWidth,p.windowHeight);
    c.parent('p5canvas');
    p.colorMode(p.RGB,255);
    p.pixelDensity(Math.min(window.devicePixelRatio||1,2));
    p.noLoop();
  };
  p.draw=function(){
    p.background(7,9,15);
    // star field
    p.push(); p.noStroke();
    for(let i=0;i<50;i++){
      const x=(i*61+p.frameCount*.009)%p.width;
      const y=(i*83+p.frameCount*.005)%p.height;
      const br=3+(i%6)*1.3;
      p.fill(255,255,255,br);
      p.ellipse(x,y,1.6,1.6);
    }
    p.pop();
    for(let i=sparkles.length-1;i>=0;i--){
      if(!sparkles[i].update()) sparkles.splice(i,1);
      else sparkles[i].draw();
    }
    for(const b of bubbles){ b.floatUpdate(); b.draw(); }
  };
  p.mousePressed=function(){
    if(p.mouseX<0||p.mouseX>p.width||p.mouseY<0||p.mouseY>p.height) return;
    if(State.current==='game') handlePop(p.mouseX,p.mouseY);
    return false;
  };
  p.touchStarted=function(){
    if(p.touches.length>0){
      const t=p.touches[0];
      if(t.x>=0&&t.x<=p.width&&t.y>=0&&t.y<=p.height){
        if(State.current==='game') handlePop(t.x,t.y);
        return false;
      }
    }
    return false;
  };
  p.windowResized=function(){ p.resizeCanvas(p.windowWidth,p.windowHeight); };
});

/* ─── HELPERS: close overlays instantly ─── */
function hideOverlay(el){
  gsap.killTweensOf(el);
  gsap.set(el,{opacity:0});
  el.classList.remove('active');
}
function showOverlay(el){
  el.classList.add('active');
  gsap.fromTo(el,{opacity:0},{opacity:1,duration:.3,ease:'power2.out'});
}

/* ─── LEVEL COMPLETE ─── */
let _levelLock = false; // prevents double-fire
function levelComplete(){
  if(State.current !== 'game') return;
  if(_levelLock) return;
  _levelLock = true;

  State.current = 'levelup';
  gameActive = false;
  if(p5inst) p5inst.noLoop();
  playLevelUp();

  const nextLvl = State.level + 1;
  const cfg = getLevel(nextLvl);
  $('lvl-number').textContent = nextLvl;
  $('lvl-name').textContent = cfg.name;
  $('lvl-msg').innerHTML = cfg.msg.replace('\n','<br>');
  const xpPct = Math.min(100, Math.round((State.xp / State.xpNeeded) * 100));
  $('xp-label').textContent = `XP: ${State.xp} / ${State.xpNeeded}`;
  $('xp-bar').style.width = '0%';

  showOverlay(levelOverlay);
  gsap.fromTo(levelOverlay.querySelector('.card'),
    {scale:.85,y:30},{scale:1,y:0,duration:.5,ease:'back.out(1.8)',delay:.05});
  gsap.fromTo('#lvl-number',
    {scale:.5,opacity:0},{scale:1,opacity:1,duration:.6,ease:'elastic.out(1,.5)',delay:.2});
  setTimeout(()=>{ $('xp-bar').style.width = xpPct+'%'; }, 500);
}

/* ─── GO NEXT LEVEL ─── */
function goNextLevel(){
  // guard: only allowed from levelup state
  if(State.current !== 'levelup') return;

  State.level++;
  State.xpNeeded = Math.round(State.xpNeeded * 1.4);
  State.combo = 0;
  clearTimeout(State.comboTimer);
  bubbles = []; sparkles = [];
  _levelLock = false;

  hudLvl.textContent = State.level;

  hideOverlay(levelOverlay);
  State.current = 'game';
  gameActive = true;
  if(p5inst) p5inst.loop();

  // slight delay so canvas loop is alive before spawning
  setTimeout(()=>{ spawnBubbles(); }, 150);
}

/* ─── START GAME (fresh) ─── */
function startGame(){
  _levelLock = false;
  clearTimeout(State.comboTimer);

  State.current = 'game';
  State.level = 1;
  State.xp = 0;
  State.xpNeeded = 300;
  State.score = 0;
  State.combo = 0;
  State.bestCombo = 0;
  State.totalPopped = 0;
  bubbles = []; sparkles = [];
  gameActive = true;

  hudScore.textContent = '0';
  hudLeft.textContent  = '0';
  hudBest.textContent  = State.bestScore;
  hudLvl.textContent   = '1';

  // kill all overlays immediately
  hideOverlay(levelOverlay);
  hideOverlay(pauseOverlay);
  $('btn-pause').textContent = '⏸';

  showScreen('game');
  setTimeout(()=>{ spawnBubbles(); if(p5inst) p5inst.loop(); }, 450);
}

/* ─── END GAME ─── */
function endGame(){
  _levelLock = false;
  gameActive = false;
  State.current = 'gameover';
  clearTimeout(State.comboTimer);
  if(p5inst) p5inst.noLoop();

  hideOverlay(levelOverlay);
  hideOverlay(pauseOverlay);

  const isNew = State.score > State.bestScore;
  if(isNew) State.bestScore = State.score;
  State.gamesPlayed++;
  localStorage.setItem('bpp_best',   State.bestScore);
  localStorage.setItem('bpp_played', State.gamesPlayed);

  $('go-score').textContent = State.score;
  $('go-best').textContent  = State.bestScore;
  $('go-combo').textContent = State.bestCombo;
  $('go-level').textContent = State.level;

  const taglines = ['Nice run, champ.','Keep popping!','Zen master! 🧘','So satisfying…','Pop legend!'];
  $('go-tagline').textContent = taglines[Math.floor(Math.random() * taglines.length)];

  const badge = $('new-best-badge');
  gsap.set(badge, {opacity:0, scale:.8});
  showScreen('gameover');
  if(isNew && State.score > 0){
    setTimeout(()=> gsap.to(badge,{opacity:1,scale:1,duration:.45,ease:'back.out(2)'}), 600);
  }
}

/* ─── PAUSE ─── */
function pauseGame(){
  if(State.current !== 'game') return;
  State.current = 'pause';
  if(p5inst) p5inst.noLoop();
  $('btn-pause').textContent = '▶';
  showOverlay(pauseOverlay);
  gsap.fromTo(pauseOverlay.querySelector('.card'),
    {scale:.88,y:20},{scale:1,y:0,duration:.4,ease:'back.out(1.6)'});
}

function resumeGame(){
  if(State.current !== 'pause') return;
  State.current = 'game';
  if(p5inst) p5inst.loop();
  $('btn-pause').textContent = '⏸';
  hideOverlay(pauseOverlay);
}

/* ─── GO HOME ─── */
function goHome(){
  _levelLock = false;
  gameActive = false;
  State.current = 'start';
  bubbles = []; sparkles = [];
  clearTimeout(State.comboTimer);
  if(p5inst) p5inst.noLoop();

  hideOverlay(pauseOverlay);
  hideOverlay(levelOverlay);

  $('start-best').textContent   = State.bestScore;
  $('start-played').textContent = State.gamesPlayed;
  showScreen('start');
}

/* ─── BUTTON EVENTS ─── */
$('btn-start').addEventListener('click',           ()=>{ initAudio(); startGame(); });
$('btn-play-again').addEventListener('click',      ()=>{ initAudio(); startGame(); });
$('btn-go-home').addEventListener('click',         goHome);
$('btn-pause').addEventListener('click',           ()=> State.current==='pause' ? resumeGame() : pauseGame());
$('btn-resume').addEventListener('click',          resumeGame);
$('btn-end').addEventListener('click',             endGame);
$('btn-end-from-pause').addEventListener('click',  ()=>{ hideOverlay(pauseOverlay); setTimeout(endGame, 80); });
$('btn-restart-from-pause').addEventListener('click',()=>{ initAudio(); startGame(); });
$('btn-next-level').addEventListener('click',      ()=>{ initAudio(); goNextLevel(); });
$('btn-fab-restart').addEventListener('click',     ()=>{ initAudio(); startGame(); });

// Keyboard
document.addEventListener('keydown', e=>{
  if(e.code === 'Space'){
    e.preventDefault();
    State.current === 'pause' ? resumeGame() : (State.current === 'game' ? pauseGame() : null);
  }
  if(e.code === 'Escape'){
    if(State.current === 'pause') resumeGame();
    if(State.current === 'levelup'){ initAudio(); goNextLevel(); }
  }
  if(e.code === 'KeyR' && (State.current === 'game' || State.current === 'pause')){
    initAudio(); startGame();
  }
  if(e.code === 'Enter' && State.current === 'levelup'){
    initAudio(); goNextLevel();
  }
});
document.addEventListener('contextmenu', e=> e.preventDefault());

/* ─── AMBIENT ORBS ─── */
function animOrbs(){
  const o=document.querySelectorAll('.orb');
  gsap.to(o[0],{opacity:1,x:50,y:40,duration:9,ease:'sine.inOut',yoyo:true,repeat:-1});
  gsap.to(o[1],{opacity:1,x:-40,y:-30,duration:11,ease:'sine.inOut',yoyo:true,repeat:-1});
  gsap.to(o[2],{opacity:1,x:30,y:50,duration:13,ease:'sine.inOut',yoyo:true,repeat:-1});
  gsap.to(o[3],{opacity:1,x:-20,y:30,duration:10,ease:'sine.inOut',yoyo:true,repeat:-1});
}

/* ─── INIT ─── */
(function init(){
  animOrbs();
  $('start-best').textContent=State.bestScore;
  $('start-played').textContent=State.gamesPlayed;

  const ss=screens.start;
  ss.classList.add('active');
  gsap.fromTo(ss,{opacity:0,scale:.9,y:30},{opacity:1,scale:1,y:0,duration:.7,ease:'back.out(1.5)',delay:.15});
  gsap.fromTo('.bubble-hero',{scale:.5,opacity:0},{scale:1,opacity:1,duration:.6,ease:'back.out(2)',delay:.3});
  gsap.to('.bubble-hero',{y:-9,duration:2.4,ease:'sine.inOut',yoyo:true,repeat:-1,delay:.9});
  gsap.fromTo('.pill',{opacity:0,y:10},{opacity:1,y:0,duration:.4,stagger:.06,ease:'power2.out',delay:.8});
  gsap.fromTo('.stat-tile',{opacity:0,y:14},{opacity:1,y:0,duration:.45,stagger:.08,ease:'power2.out',delay:.55});
  gsap.fromTo('#btn-start',{opacity:0,y:16,scale:.95},{opacity:1,y:0,scale:1,duration:.5,ease:'back.out(1.8)',delay:.6});

  // pulse start button
  gsap.to('#btn-start',{boxShadow:'0 0 0 1px #4f8ef7, 0 0 40px rgba(79,142,247,.6), 0 4px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.2)',duration:1.2,yoyo:true,repeat:-1,ease:'sine.inOut',delay:1.2});

  console.log('🫧 Bubble Pop Pro · tap · pop · level up');
})();
