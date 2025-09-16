/* helpers */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const toast = (msg, ms=1200)=>{
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  setTimeout(()=> el.hidden = true, ms);
};
/* tiny store */
const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

/* ================= 2048 ================= */
(function(){
  const gridEl = $('#g2048-grid');
  const newBtn = $('#g2048-new');
  const undoBtn = $('#g2048-undo');
  const scoreEl = $('#g2048-score');
  const bestEl = $('#g2048-best');
  const statusEl = $('#g2048-status');

  const N = 4;
  let board = Array(N*N).fill(0);
  let score = 0;
  let best = store.get('g2048-best', 0);
  let prev = null;

  bestEl.textContent = best || '—';

  function build(){
    gridEl.style.setProperty('--size', N);
    gridEl.innerHTML = '';
    for(let i=0;i<N*N;i++){
      const c = document.createElement('div');
      c.className = 'g2048-cell';
      c.dataset.v = 0;
      gridEl.appendChild(c);
    }
    render();
  }

  function render(){
    board.forEach((v,i)=>{
      const el = gridEl.children[i];
      el.dataset.v = v;
      el.textContent = v>0 ? v : '';
    });
    scoreEl.textContent = score;
    undoBtn.disabled = !prev;
  }

  function emptyCells(){
    const a=[]; for(let i=0;i<board.length;i++) if(board[i]===0) a.push(i); return a;
  }
  function addRandom(){
    const empties = emptyCells(); if(!empties.length) return;
    const idx = empties[Math.floor(Math.random()*empties.length)];
    board[idx] = Math.random()<0.9?2:4;
  }

  function slideRow(row){
    // row: number[]
    const nonzero = row.filter(v=>v);
    const merged = [];
    for(let i=0;i<nonzero.length;i++){
      if(nonzero[i]===nonzero[i+1]){
        const val = nonzero[i]*2;
        merged.push(val);
        score += val;
        i++;
      }else merged.push(nonzero[i]);
    }
    while(merged.length<N) merged.push(0);
    return merged;
  }
  function rotate(b){ // rotate right
    const r = Array(N*N).fill(0);
    for(let r0=0;r0<N;r0++)for(let c=0;c<N;c++){
      r[c*N + (N-1-r0)] = b[r0*N+c];
    }
    return r;
  }
  function move(dir){ // 0=left,1=up,2=right,3=down
    prev = { board:[...board], score };
    let b = [...board];
    // rotate so that we always move left
    for(let i=0;i<dir;i++) b = rotate(b);
    const rows = [];
    for(let r=0;r<N;r++) rows.push(b.slice(r*N,(r+1)*N));
    const slid = rows.map(slideRow).flat();
    // rotate back
    let out = slid;
    for(let i=0;i<(4-dir)%4;i++) out = rotate(out);
    const changed = out.some((v,i)=>v!==board[i]);
    if(changed){
      board = out;
      addRandom();
      render();
      checkState();
    }else{
      prev = null; // nothing changed; don't allow undo
    }
  }

  function checkState(){
    if(emptyCells().length) return;
    // if any move changes, not over
    for(const d of [0,1,2,3]){
      const before = [...board], beforeScore=score;
      move(d);
      const changed = board.some((v,i)=>v!==before[i]);
      board = before; score = beforeScore; render(); prev=null;
      if(changed) return;
    }
    statusEl.textContent = 'Game over';
    if(score>best){ best=score; store.set('g2048-best', best); bestEl.textContent=best; }
  }

  function reset(){
    board = Array(N*N).fill(0);
    score = 0; statusEl.textContent='';
    addRandom(); addRandom();
    render();
  }

  // input
  gridEl.addEventListener('keydown', e=>{
    const k = e.key;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k)){
      e.preventDefault();
      const dir = {ArrowLeft:0, ArrowUp:1, ArrowRight:2, ArrowDown:3}[k];
      move(dir);
    }
  }, {passive:false});
  // touch
  (function swipe(el){
    let s=null;
    el.addEventListener('touchstart', e=>{ const t=e.touches[0]; s={x:t.clientX,y:t.clientY}; }, {passive:true});
    el.addEventListener('touchend', e=>{
      if(!s) return;
      const t=e.changedTouches[0]; const dx=t.clientX-s.x, dy=t.clientY-s.y;
      if(Math.hypot(dx,dy)<20) return; // ignore tap
      const adx=Math.abs(dx), ady=Math.abs(dy);
      const dir = adx>ady ? (dx>0?2:0) : (dy>0?3:1);
      move(dir); s=null;
    }, {passive:true});
  })(gridEl);

  newBtn.addEventListener('click', reset);
  undoBtn.addEventListener('click', ()=>{
    if(!prev) return;
    board = prev.board; score = prev.score; prev=null; statusEl.textContent='';
    render();
  });

  build(); reset();
})();

/* ================= Match-3 ================= */
(function(){
  const gridEl = $('#m3-grid');
  const newBtn = $('#m3-new');
  const scoreEl = $('#m3-score');
  const bestEl = $('#m3-best');
  const statusEl = $('#m3-status');

  const N = 8, TYPES = 6;
  let board = []; // numbers 0..TYPES-1
  let score = 0, best = store.get('m3-best', 0);
  let sel = null; // index

  bestEl.textContent = best || '—';

  function idx(r,c){return r*N+c}
  function rc(i){return [Math.floor(i/N), i%N]}

  function build(){
    gridEl.style.setProperty('--size', N);
    gridEl.innerHTML='';
    for(let i=0;i<N*N;i++){
      const b = document.createElement('button');
      b.className='m3-cell'; b.setAttribute('aria-label', 'Gem');
      b.addEventListener('click', ()=> onSelect(i));
      gridEl.appendChild(b);
    }
  }

  function fillRandom(){
    board = Array(N*N).fill(0).map(()=>Math.floor(Math.random()*TYPES));
    // ensure no immediate matches to start
    while(findMatches().length){ shuffleBoard(); }
    render();
  }

  function render(){
    board.forEach((v,i)=>{
      const el = gridEl.children[i];
      el.className = 'm3-cell m3-type-'+v + (sel===i?' selected':'');
    });
    scoreEl.textContent = score;
  }

  function neighbors(i){
    const [r,c]=rc(i), out=[];
    if(r>0) out.push(idx(r-1,c));
    if(r<N-1) out.push(idx(r+1,c));
    if(c>0) out.push(idx(r,c-1));
    if(c<N-1) out.push(idx(r,c+1));
    return out;
  }

  function swap(i,j){
    [board[i],board[j]]=[board[j],board[i]];
  }

  function onSelect(i){
    if(sel===null){ sel=i; render(); return; }
    if(i===sel){ sel=null; render(); return; }
    if(!neighbors(sel).includes(i)){ sel=i; render(); return; }
    // tentative swap
    swap(sel,i);
    const matches = findMatches();
    if(!matches.length){
      // revert if no match
      swap(sel,i); toast('No match'); sel=null; render(); return;
    }
    // resolve cascade
    resolve(matches);
    sel=null;
  }

  function findMatches(){
    const m = new Set();
    // rows
    for(let r=0;r<N;r++){
      let run=1;
      for(let c=1;c<N;c++){
        if(board[idx(r,c)]===board[idx(r,c-1)]) run++; else{ if(run>=3) for(let k=1;k<=run;k++) m.add(idx(r,c-k)); run=1; }
      }
      if(run>=3) for(let k=0;k<run;k++) m.add(idx(r,N-1-k));
    }
    // cols
    for(let c=0;c<N;c++){
      let run=1;
      for(let r=1;r<N;r++){
        if(board[idx(r,c)]===board[idx(r-1,c)]) run++; else{ if(run>=3) for(let k=1;k<=run;k++) m.add(idx(r-k,c)); run=1; }
      }
      if(run>=3) for(let k=0;k<run;k++) m.add(idx(N-1-k,c));
    }
    return [...m];
  }

  function resolve(matches){
    let chain=0;
    (function step(){
      if(!matches.length){ // after last clear, check for new matches from gravity
        // gravity
        for(let c=0;c<N;c++){
          const col=[];
          for(let r=0;r<N;r++) col.push(board[idx(r,c)]);
          const filtered = col.filter(v=>v!==null);
          const holes = N - filtered.length;
          const newgems = Array(holes).fill(0).map(()=>Math.floor(Math.random()*TYPES));
          const newcol = Array(holes).fill(null).concat(filtered); // null as holes first
          for(let r=0;r<N;r++) board[idx(r,c)] = newcol[r]===null ? newgems.shift() : newcol[r];
        }
        const next = findMatches();
        if(next.length){ matches = next; chain++; setTimeout(step, 80); return; }
        if(chain>0) toast('Chain x'+(chain+1));
        render();
        if(score>best){ best=score; store.set('m3-best',best); bestEl.textContent=best; }
        if(!hasMoves()){ shuffleBoard(); statusEl.textContent='Shuffled'; }
        return;
      }
      // clear matched -> score
      matches.forEach(i=>{ board[i]=null; });
      score += 10*matches.length;
      render();
      setTimeout(step, 80);
    })();
  }

  function hasMoves(){
    // look for any swap creating a match (rough check)
    for(let i=0;i<N*N;i++){
      for(const j of neighbors(i)){
        swap(i,j);
        const ok = findMatches().length>0;
        swap(i,j);
        if(ok) return true;
      }
    }
    return false;
  }

  function shuffleBoard(){
    // keep colors but permute until there is a move and no immediate matches
    const colors=[...board];
    let tries=0;
    do{
      for(let i=colors.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1)); [colors[i],colors[j]]=[colors[j],colors[i]];
      }
      board=[...colors]; tries++;
      if(tries>200){ fillRandom(); return; }
    }while(findMatches().length || !hasMoves());
    render();
  }

  newBtn.addEventListener('click', ()=>{ score=0; statusEl.textContent=''; fillRandom(); });

  build(); fillRandom();
})();

/* ================= Simon ================= */
(function(){
  const pads = $$('#si-grid .pad');
  const startBtn = $('#si-start');
  const modeSel = $('#si-mode');
  const levelEl = $('#si-level');
  const bestEl = $('#si-best');
  const statusEl = $('#si-status');

  let seq = [];
  let inputIndex = 0;
  let playingBack = false;
  let best = store.get('si-best', 0);
  bestEl.textContent = best;

  // gentle tones
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  const freqs = [392, 440, 494, 523]; // G4 A4 B4 C5
  function tone(i, ms=350){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freqs[i]; o.type='sine';
    o.connect(g).connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime+0.01);
    o.start();
    setTimeout(()=>{
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.02);
      setTimeout(()=>o.stop(), 20);
    }, ms);
  }

  function light(i, ms=350){
    pads[i].classList.add('lit'); tone(i, ms);
    setTimeout(()=> pads[i].classList.remove('lit'), ms);
  }

  pads.forEach(p=>{
    p.addEventListener('click', async ()=>{
      if(playingBack) return;
      await ctx.resume().catch(()=>{});
      const i = Number(p.dataset.pad);
      light(i, 220);
      if(seq.length===0) return;
      if(i===seq[inputIndex]){
        inputIndex++;
        if(inputIndex===seq.length){
          // level complete
          const lvl = seq.length;
          if(lvl>best){ best=lvl; store.set('si-best',best); bestEl.textContent=best; }
          levelEl.textContent = lvl;
          statusEl.textContent = 'Nice.';
          setTimeout(next, 600);
        }
      }else{
        // fail
        statusEl.textContent = 'Oops.';
        if(modeSel.value==='strict'){ reset(); }
        else{
          inputIndex = 0;
          setTimeout(playback, 700);
        }
      }
    });
  });

  function randPad(){ return Math.floor(Math.random()*4); }

  function next(){
    seq.push(randPad());
    inputIndex = 0;
    playback();
  }

  function playback(){
    playingBack = true;
    let i=0;
    const t = setInterval(()=>{
      if(i>=seq.length){ clearInterval(t); playingBack=false; statusEl.textContent='Your turn'; return; }
      light(seq[i], Math.max(140, 420 - seq.length*10));
      i++;
    }, Math.max(240, 540 - seq.length*12));
  }

  function reset(){
    seq = []; inputIndex=0; levelEl.textContent='0'; statusEl.textContent='';
  }

  startBtn.addEventListener('click', async ()=>{
    await ctx.resume().catch(()=>{});
    reset(); next();
  });
})();

/* a11y nicety: keyboard focus styles for mouse users only when tabbing */
(function(){
  function onFirstTab(e){
    if(e.key==='Tab'){ document.body.classList.add('kbd'); window.removeEventListener('keydown', onFirstTab); }
  }
  window.addEventListener('keydown', onFirstTab);
})();
