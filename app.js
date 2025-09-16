/* utils */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

/* prevent touch scrolling (since site is fixed) */
document.addEventListener('touchmove', e => { e.preventDefault(); }, {passive:false});

/* ===================== SNAKE ===================== */
(function(){
  const c = $('#snk-canvas'), ctx = c.getContext('2d');
  const newBtn = $('#snk-new'), pauseBtn = $('#snk-pause');
  const scoreEl = $('#snk-score'), bestEl = $('#snk-best'), statusEl = $('#snk-status');
  const dpad = $$('.d');

  const N = 20; let cell = c.width / N;
  function resize(){
    const w = Math.min(420, c.parentElement.clientWidth);
    c.width = c.height = Math.round(w);
    cell = c.width / N; draw();
  }
  window.addEventListener('resize', resize, {passive:true});

  let snake, dir, pending, food, score, tick, speed, paused, dead;

  function spawnFood(){
    while(true){
      const x = Math.floor(Math.random()*N), y = Math.floor(Math.random()*N);
      if(!snake.some(s=>s.x===x && s.y===y)) return {x,y};
    }
  }
  function setDir(x,y){
    if(dead) return;
    if(x===-dir.x && y===-dir.y) return;
    pending = {x,y};
  }

  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if(['arrowup','w'].includes(k)) setDir(0,-1);
    if(['arrowdown','s'].includes(k)) setDir(0,1);
    if(['arrowleft','a'].includes(k)) setDir(-1,0);
    if(['arrowright','d'].includes(k)) setDir(1,0);
    if(k===' ') togglePause();
  });
  dpad.forEach(b=>b.addEventListener('click', ()=>{
    const d=b.dataset.dir;
    if(d==='up') setDir(0,-1); if(d==='down') setDir(0,1);
    if(d==='left') setDir(-1,0); if(d==='right') setDir(1,0);
  }));

  function reset(){
    snake=[{x:8,y:10},{x:7,y:10},{x:6,y:10}];
    dir=pending={x:1,y:0};
    food=spawnFood(); score=0; speed=110; paused=false; dead=false;
    scoreEl.textContent='0'; bestEl.textContent=store.get('snk-best',0) || 0;
    statusEl.textContent=''; loop();
  }

  function step(){
    if(paused||dead) return;
    dir=pending;
    const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.x>=N||head.y<0||head.y>=N) return gameOver();
    if(snake.some(s=>s.x===head.x && s.y===head.y)) return gameOver();
    snake.unshift(head);
    if(head.x===food.x && head.y===food.y){
      score+=10; scoreEl.textContent=score;
      const best=Math.max(store.get('snk-best',0), score); store.set('snk-best',best); bestEl.textContent=best;
      food=spawnFood(); speed=Math.max(60, speed-2);
      clearInterval(tick); tick=setInterval(step, speed);
    }else snake.pop();
    draw();
  }
  function draw(){
    ctx.fillStyle='#0d0f0e'; ctx.fillRect(0,0,c.width,c.height);
    // grid
    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1;
    for(let i=1;i<N;i++){
      const p=Math.round(i*cell)+.5;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,c.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(c.width,p); ctx.stroke();
    }
    // food
    ctx.fillStyle='#4ca495'; ctx.beginPath();
    ctx.arc(food.x*cell+cell/2, food.y*cell+cell/2, cell*0.28, 0, Math.PI*2); ctx.fill();
    // snake
    ctx.fillStyle='#e7e7e5';
    snake.forEach(s=>{ ctx.fillRect(Math.round(s.x*cell)+2, Math.round(s.y*cell)+2, cell-4, cell-4); });
    if(paused||dead){
      ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle='#e7e7e5'; ctx.font='600 22px system-ui,sans-serif'; ctx.textAlign='center';
      ctx.fillText(dead?'Game Over':'Paused', c.width/2, c.height/2);
    }
  }
  function loop(){ clearInterval(tick); tick=setInterval(step, speed); draw(); }
  function gameOver(){ dead=true; clearInterval(tick); statusEl.textContent='Game over'; draw(); }
  function togglePause(){ if(dead) return; paused=!paused; $('#snk-pause').textContent=paused?'Resume':'Pause'; if(!paused) loop(); else draw(); }

  newBtn.addEventListener('click', reset);
  pauseBtn.addEventListener('click', togglePause);
  resize(); reset();
})();

/* ===================== MINESWEEPER (robust) ===================== */
(function(){
  const grid = $('#msw-grid'), newBtn=$('#msw-new'), sizeSel=$('#msw-size');
  const timeEl=$('#msw-time'), minesEl=$('#msw-mines'), statusEl=$('#msw-status');

  let W=9,H=9,M=10, board=[], open=[], flag=[], started=false, over=false, secs=0, timer=null;

  function setSize(w,m){ W=H=w; M=m; grid.style.gridTemplateColumns=`repeat(${W},1fr)`; }

  function build(){
    grid.innerHTML='';
    const frag=document.createDocumentFragment();
    for(let i=0;i<W*H;i++){
      const b=document.createElement('button');
      b.className='msw-cell'; b.dataset.i=i;
      frag.appendChild(b);
    }
    grid.appendChild(frag);
    board=Array(W*H).fill(0); open=Array(W*H).fill(false); flag=Array(W*H).fill(false);
    started=false; over=false; secs=0; timeEl.textContent='0'; statusEl.textContent='';
    minesEl.textContent=M;
  }

  function neighbors(i){
    const r=Math.floor(i/W), c=i%W, out=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc) continue;
      const rr=r+dr, cc=c+dc;
      if(rr>=0&&rr<H&&cc>=0&&cc<W) out.push(rr*W+cc);
    }
    return out;
  }

  function placeMines(safe){
    const avoid=new Set([safe,...neighbors(safe)]);
    let left=M;
    while(left>0){
      const i=Math.floor(Math.random()*W*H);
      if(board[i]===-1 || avoid.has(i)) continue;
      board[i]=-1; left--;
    }
    for(let i=0;i<board.length;i++){
      if(board[i]===-1) continue;
      board[i]=neighbors(i).filter(n=>board[n]===-1).length;
    }
  }

  function flood(i){
    const st=[i];
    while(st.length){
      const k=st.pop();
      if(open[k]||flag[k]) continue;
      open[k]=true;
      if(board[k]===0) neighbors(k).forEach(n=>{ if(!open[n]) st.push(n); });
    }
  }

  function reveal(i){
    if(over||flag[i]||open[i]) return;
    if(!started){ placeMines(i); timerStart(); started=true; }
    if(board[i]===-1){ open[i]=true; over=true; timerStop(); showAll(true); statusEl.textContent='Boom 💥'; render(); return; }
    flood(i); render(); checkWin();
  }

  function toggleFlag(i){
    if(over||open[i]) return;
    flag[i]=!flag[i]; render();
  }

  function render(){
    for(let i=0;i<board.length;i++){
      const el=grid.children[i];
      el.classList.toggle('open', open[i]);
      el.classList.toggle('flag', flag[i]);
      el.classList.toggle('disabled', over);
      el.textContent='';
      el.classList.remove('bomb');
      if(open[i]){
        if(board[i]>0){ el.textContent=board[i]; el.style.color=numColor(board[i]); }
        if(board[i]===-1){ el.classList.add('bomb'); }
      }
    }
    minesEl.textContent = M - flag.filter(Boolean).length;
  }

  function numColor(n){
    return ({1:'#9cd7cb',2:'#d8c78f',3:'#e99f9f',4:'#bda6e6',5:'#f2b177',6:'#a0d1f2',7:'#cccccc',8:'#aaaaaa'})[n] || '#e7e7e5';
  }

  function showAll(){
    for(let i=0;i<board.length;i++){
      if(board[i]===-1) grid.children[i].classList.add('bomb');
      open[i]=true;
    }
  }

  function checkWin(){
    const safe=W*H-M;
    if(open.filter(Boolean).length>=safe){
      over=true; timerStop(); statusEl.textContent='Cleared ✔︎'; showAll(); render();
    }
  }

  function timerStart(){ clearInterval(timer); timer=setInterval(()=>{ secs++; timeEl.textContent=secs; }, 1000); }
  function timerStop(){ clearInterval(timer); }

  // event delegation: click / contextmenu / long-press
  grid.addEventListener('click', e=>{
    const cell=e.target.closest('.msw-cell'); if(!cell) return;
    reveal(Number(cell.dataset.i));
  });
  grid.addEventListener('contextmenu', e=>{
    const cell=e.target.closest('.msw-cell'); if(!cell) return;
    e.preventDefault(); toggleFlag(Number(cell.dataset.i));
  });
  let pressTimer=null;
  grid.addEventListener('touchstart', e=>{
    const cell=e.target.closest('.msw-cell'); if(!cell) return;
    const i=Number(cell.dataset.i);
    pressTimer=setTimeout(()=>{ toggleFlag(i); }, 450);
  }, {passive:true});
  grid.addEventListener('touchend', e=>{ clearTimeout(pressTimer); }, {passive:true});

  newBtn.addEventListener('click', ()=>{ timerStop(); build(); render(); });
  sizeSel.addEventListener('change', ()=>{
    const [w,m]=sizeSel.value.split(',').map(Number); setSize(w,m); timerStop(); build(); render();
  });

  setSize(9,10); build(); render();
})();

/* ===================== BREAKOUT (stable) ===================== */
(function(){
  const c=$('#brk-canvas'), ctx=c.getContext('2d');
  const newBtn=$('#brk-new'), livesEl=$('#brk-lives'), levelEl=$('#brk-level'),
        scoreEl=$('#brk-score'), statusEl=$('#brk-status');

  let paddle, ball, bricks, cols, rows, running=false, lives=3, level=1, score=0, raf=null;

  function sizeCanvas(){
    const w = Math.min(520, c.parentElement.clientWidth);
    c.width = Math.round(w);
    c.height = Math.round(w*0.6);
  }
  window.addEventListener('resize', ()=>{ sizeCanvas(); layoutLevel(); draw(); }, {passive:true});

  function layoutLevel(){
    paddle = { w: Math.max(60, c.width*0.18 - level*6), h: 12, x: c.width/2, y: c.height-18, vx:0 };
    ball = { x:c.width/2, y:c.height/2, r:6, vx: 2.2 + level*0.3, vy: -2.6 - level*0.3 };
    cols = 9; rows = 4 + Math.min(level-1, 3);
    bricks=[];
    const pad=10, bw=(c.width - pad*(cols+1))/cols, bh=18;
    for(let r=0;r<rows;r++){
      for(let col=0; col<cols; col++){
        bricks.push({x: pad + col*(bw+pad), y: 50 + r*(bh+pad), w:bw, h:bh, alive:true});
      }
    }
    livesEl.textContent=lives; levelEl.textContent=level; scoreEl.textContent=score; statusEl.textContent='';
  }

  // input
  let mouseX=null;
  c.addEventListener('mousemove', e=>{ mouseX = e.offsetX; }, {passive:true});
  c.addEventListener('touchstart', e=>{ mouseX = e.touches[0].clientX - c.getBoundingClientRect().left; }, {passive:true});
  c.addEventListener('touchmove', e=>{ mouseX = e.touches[0].clientX - c.getBoundingClientRect().left; e.preventDefault(); }, {passive:false});
  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft' || e.key==='a' || e.key==='A') paddle.vx=-6;
    if(e.key==='ArrowRight'|| e.key==='d' || e.key==='D') paddle.vx=6;
  });
  window.addEventListener('keyup', e=>{
    if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)) paddle.vx=0;
  });

  function update(){
    // paddle
    if(mouseX!=null) paddle.x = mouseX;
    paddle.x += paddle.vx;
    paddle.x = Math.max(paddle.w/2, Math.min(c.width-paddle.w/2, paddle.x));

    // ball
    ball.x += ball.vx; ball.y += ball.vy;

    if(ball.x-ball.r<0 || ball.x+ball.r>c.width) ball.vx*=-1;
    if(ball.y-ball.r<0) ball.vy*=-1;

    // paddle collision
    if(ball.y+ball.r > paddle.y && ball.y+ball.r < paddle.y+paddle.h &&
       ball.x > paddle.x-paddle.w/2 && ball.x < paddle.x+paddle.w/2){
      ball.vy = -Math.abs(ball.vy);
      const off = (ball.x - paddle.x)/(paddle.w/2); // -1..1
      ball.vx = (2.4 + level*0.2) * off;
    }

    // bricks
    for(const b of bricks){
      if(!b.alive) continue;
      if(ball.x> b.x && ball.x < b.x+b.w && ball.y> b.y && ball.y < b.y+b.h){
        b.alive=false; score+=10; scoreEl.textContent=score;
        // reflect by smallest penetration side
        const dx = Math.min(Math.abs(ball.x-(b.x)), Math.abs(ball.x-(b.x+b.w)));
        const dy = Math.min(Math.abs(ball.y-(b.y)), Math.abs(ball.y-(b.y+b.h)));
        if(dx<dy) ball.vx*=-1; else ball.vy*=-1;
        break;
      }
    }

    // lose life?
    if(ball.y-ball.r>c.height){
      lives--; livesEl.textContent=lives;
      if(lives<=0){ stop(); statusEl.textContent='Game over'; return; }
      ball.x=c.width/2; ball.y=c.height/2; ball.vx=2.2+level*0.3; ball.vy=-2.6-level*0.3;
    }

    // level up?
    if(bricks.every(b=>!b.alive)){
      stop(); statusEl.textContent='Level up';
      setTimeout(()=>{ level++; layoutLevel(); play(); }, 600);
    }
  }

  function draw(){
    ctx.fillStyle='#0d0f0e'; ctx.fillRect(0,0,c.width,c.height);
    // bricks
    for(const b of bricks){
      if(!b.alive) continue;
      ctx.fillStyle='#1a1f1d'; ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.strokeStyle='#2a2e2b'; ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);
    }
    // paddle
    ctx.fillStyle='#e7e7e5';
    ctx.fillRect(paddle.x-paddle.w/2, paddle.y, paddle.w, paddle.h);
    // ball
    ctx.fillStyle='#4ca495';
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill();
  }

  function frame(){ update(); draw(); raf=requestAnimationFrame(frame); }
  function play(){ running=true; cancelAnimationFrame(raf); raf=requestAnimationFrame(frame); }
  function stop(){ running=false; cancelAnimationFrame(raf); }

  newBtn.addEventListener('click', ()=>{ stop(); lives=3; level=1; score=0; sizeCanvas(); layoutLevel(); play(); });

  // init
  sizeCanvas(); layoutLevel(); play();
})();
