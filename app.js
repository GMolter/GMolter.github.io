/* Utils */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

/* ===================== SNAKE ===================== */
(function(){
  const c = $('#snk-canvas');
  const ctx = c.getContext('2d');
  const newBtn = $('#snk-new');
  const pauseBtn = $('#snk-pause');
  const scoreEl = $('#snk-score');
  const bestEl = $('#snk-best');
  const statusEl = $('#snk-status');
  const dpad = $$('.d');

  const N = 20; // grid
  let grid = N;
  let cell = c.width / N;
  function resize(){
    // keep square and crisp
    const w = c.getBoundingClientRect().width;
    c.width = Math.round(w);
    c.height = Math.round(w);
    cell = c.width / N;
    draw();
  }
  window.addEventListener('resize', resize, {passive:true});

  let snake, dir, pendingDir, food, score, best, tick, speed, paused, dead;

  function reset(){
    snake = [{x:8,y:10},{x:7,y:10},{x:6,y:10}];
    dir = {x:1,y:0}; pendingDir = dir;
    food = spawnFood();
    score = 0; speed = 110; paused=false; dead=false;
    scoreEl.textContent = '0';
    best = store.get('snk-best', 0);
    bestEl.textContent = best;
    statusEl.textContent = '';
    loop();
  }

  function spawnFood(){
    while(true){
      const x = Math.floor(Math.random()*N), y = Math.floor(Math.random()*N);
      if(!snake.some(s=>s.x===x && s.y===y)) return {x,y};
    }
  }

  function setDir(nx,ny){
    // prevent reversing
    if(dead) return;
    if((nx===-dir.x && ny===0) || (ny===-dir.y && nx===0)) return;
    pendingDir = {x:nx, y:ny};
  }

  // input: keys
  window.addEventListener('keydown', e=>{
    const k = e.key.toLowerCase();
    if(['arrowup','w'].includes(k)) setDir(0,-1);
    if(['arrowdown','s'].includes(k)) setDir(0,1);
    if(['arrowleft','a'].includes(k)) setDir(-1,0);
    if(['arrowright','d'].includes(k)) setDir(1,0);
    if(k===' '){ togglePause(); }
  });
  // input: dpad
  dpad.forEach(b=> b.addEventListener('click', ()=> {
    const m = b.dataset.dir;
    if(m==='up') setDir(0,-1);
    if(m==='down') setDir(0,1);
    if(m==='left') setDir(-1,0);
    if(m==='right') setDir(1,0);
  }));

  function step(){
    if(paused || dead) return;
    dir = pendingDir;
    const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    // wall
    if(head.x<0||head.x>=N||head.y<0||head.y>=N){ gameOver(); return; }
    // self
    if(snake.some(s=>s.x===head.x && s.y===head.y)){ gameOver(); return; }
    snake.unshift(head);
    if(head.x===food.x && head.y===food.y){
      score += 10; scoreEl.textContent = score;
      if(score>store.get('snk-best',0)){ store.set('snk-best', score); bestEl.textContent = score; }
      food = spawnFood();
      speed = Math.max(60, speed-2);
    }else{
      snake.pop();
    }
    draw();
  }

  function draw(){
    // bg
    ctx.fillStyle = '#0d0f0e';
    ctx.fillRect(0,0,c.width,c.height);

    // grid subtle
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    for(let i=1;i<N;i++){
      const p = Math.round(i*cell)+.5;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,c.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(c.width,p); ctx.stroke();
    }

    // food
    ctx.fillStyle = '#4ca495';
    ctx.beginPath();
    const fx = food.x*cell + cell/2, fy = food.y*cell + cell/2;
    ctx.arc(fx,fy, cell*0.28, 0, Math.PI*2); ctx.fill();

    // snake
    ctx.fillStyle = '#e7e7e5';
    snake.forEach((s,i)=>{
      const x = Math.round(s.x*cell)+2, y=Math.round(s.y*cell)+2;
      const size = cell-4;
      ctx.fillRect(x,y,size,size);
    });

    if(paused || dead){
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle = '#e7e7e5';
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.textAlign='center';
      ctx.fillText(dead?'Game Over':'Paused', c.width/2, c.height/2);
    }
  }

  function loop(){
    clearInterval(tick);
    tick = setInterval(step, speed);
    draw();
  }

  function gameOver(){
    dead = true;
    clearInterval(tick);
    statusEl.textContent = 'Game over';
    draw();
  }

  function togglePause(){
    if(dead) return;
    paused = !paused;
    $('#snk-pause').textContent = paused ? 'Resume' : 'Pause';
    if(!paused) loop(); else draw();
  }

  newBtn.addEventListener('click', reset);
  pauseBtn.addEventListener('click', togglePause);

  resize();
  reset();
})();

/* ===================== MINESWEEPER ===================== */
(function(){
  const gridEl = $('#msw-grid');
  const newBtn = $('#msw-new');
  const sizeSel = $('#msw-size');
  const timeEl = $('#msw-time');
  const minesEl = $('#msw-mines');
  const statusEl = $('#msw-status');

  let W=9, H=9, M=10;
  let board=[], open=[], flag=[];
  let started=false, over=false, timer=null, secs=0;

  function setup(){
    gridEl.style.gridTemplateColumns = `repeat(${W},1fr)`;
    gridEl.innerHTML='';
    board = Array(W*H).fill(0);
    open  = Array(W*H).fill(false);
    flag  = Array(W*H).fill(false);
    secs=0; timeEl.textContent='0'; statusEl.textContent=''; over=false; started=false;
    minesEl.textContent = M;
    for(let i=0;i<W*H;i++){
      const b = document.createElement('button');
      b.className='msw-cell';
      b.setAttribute('aria-label','Hidden cell');
      // mouse
      b.addEventListener('click', e=> reveal(i));
      b.addEventListener('contextmenu', e=>{ e.preventDefault(); toggleFlag(i); });
      // long press to flag on touch
      let t=null;
      b.addEventListener('touchstart', e=>{ t=setTimeout(()=>{ toggleFlag(i); }, 450); }, {passive:true});
      b.addEventListener('touchend', e=>{ clearTimeout(t); }, {passive:true});
      gridEl.appendChild(b);
    }
  }

  function placeMines(safeIndex){
    // place avoiding the first clicked tile and its neighbors
    const avoid = new Set([safeIndex, ...neighbors(safeIndex)]);
    let left = M;
    while(left>0){
      const i = Math.floor(Math.random()*W*H);
      if(board[i]===-1 || avoid.has(i)) continue;
      board[i]=-1; left--;
    }
    // numbers
    for(let i=0;i<W*H;i++){
      if(board[i]===-1) continue;
      board[i] = neighbors(i).filter(n=>board[n]===-1).length;
    }
  }

  function neighbors(i){
    const r = Math.floor(i/W), c=i%W, list=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(dr===0&&dc===0) continue;
      const rr=r+dr, cc=c+dc;
      if(rr>=0&&rr<H&&cc>=0&&cc<W) list.push(rr*W+cc);
    }
    return list;
  }

  function reveal(i){
    if(over||flag[i]||open[i]) return;
    if(!started){ placeMines(i); startTimer(); started=true; }
    if(board[i]===-1){ // boom
      open[i]=true; over=true; stopTimer(); showAll(true); statusEl.textContent='Boom 💥';
      return;
    }
    flood(i);
    render();
    checkWin();
  }

  function flood(i){
    const stack=[i];
    while(stack.length){
      const k = stack.pop();
      if(open[k]||flag[k]) continue;
      open[k]=true;
      if(board[k]===0) neighbors(k).forEach(n=>{ if(!open[n]) stack.push(n); });
    }
  }

  function toggleFlag(i){
    if(over||open[i]) return;
    flag[i] = !flag[i];
    render();
  }

  function render(){
    for(let i=0;i<W*H;i++){
      const el = gridEl.children[i];
      el.classList.toggle('open', open[i]);
      el.classList.toggle('flag', flag[i]);
      el.classList.toggle('disabled', over);
      if(open[i]){
        el.textContent = board[i]>0 ? board[i] : '';
        el.style.color = numberColor(board[i]);
      }else{
        el.textContent = '';
      }
    }
    minesEl.textContent = M - flag.filter(Boolean).length;
  }

  function numberColor(n){
    return ({
      1:'#9cd7cb', 2:'#d8c78f', 3:'#e99f9f', 4:'#bda6e6',
      5:'#f2b177', 6:'#a0d1f2', 7:'#cccccc', 8:'#aaaaaa'
    })[n] || '#e7e7e5';
  }

  function showAll(hitBomb=false){
    for(let i=0;i<W*H;i++){
      if(board[i]===-1) gridEl.children[i].classList.add('bomb');
      open[i]=true;
    }
    render();
  }

  function checkWin(){
    const safe = W*H - M;
    const opened = open.filter(Boolean).length;
    if(opened>=safe){
      over=true; stopTimer(); statusEl.textContent='Cleared ✔︎';
      showAll();
    }
  }

  function startTimer(){
    clearInterval(timer);
    timer = setInterval(()=>{ secs++; timeEl.textContent = secs; }, 1000);
  }
  function stopTimer(){ clearInterval(timer); }

  newBtn.addEventListener('click', ()=>{ stopTimer(); setup(); });
  sizeSel.addEventListener('change', ()=>{
    const [w,m] = sizeSel.value.split(',').map(Number);
    W = H = w; M = m; stopTimer(); setup();
  });

  setup();
})();

/* ===================== BREAKOUT ===================== */
(function(){
  const c = $('#brk-canvas');
  const ctx = c.getContext('2d');
  const newBtn = $('#brk-new');
  const livesEl = $('#brk-lives');
  const levelEl = $('#brk-level');
  const scoreEl = $('#brk-score');
  const statusEl = $('#brk-status');

  let paddle, ball, bricks, cols, rows, running, lives, level, score, raf;

  function reset(levelUp=false){
    lives = levelUp ? lives : 3;
    level = levelUp ? level+1 : 1;
    score = levelUp ? score : 0;
    setupLevel();
    draw();
    play();
  }

  function setupLevel(){
    const w = c.getBoundingClientRect().width;
    c.width = Math.round(w);
    c.height = Math.round(w*0.62);
    paddle = { w: Math.max(50, c.width*0.16 - level*6), h: 12, x: c.width/2, y: c.height-18, vx:0 };
    ball = { x:c.width/2, y:c.height/2, r:6, vx: 2.4 + level*0.3, vy: -2.6 - level*0.3, speed: 1 };
    cols = 9; rows = 4 + Math.min(level-1, 3);
    bricks = [];
    const pad=10, bw=(c.width - pad*(cols+1))/cols, bh=18;
    for(let r=0;r<rows;r++){
      for(let col=0; col<cols; col++){
        bricks.push({x: pad + col*(bw+pad), y: 50 + r*(bh+pad), w:bw, h:bh, alive:true});
      }
    }
    livesEl.textContent = lives;
    levelEl.textContent = level;
    scoreEl.textContent = score;
    statusEl.textContent = '';
  }
  window.addEventListener('resize', ()=>{ setupLevel(); draw(); }, {passive:true});

  // input
  let mouseX = null, dragging=false;
  c.addEventListener('mousemove', e=>{
    const r = c.getBoundingClientRect();
    mouseX = e.clientX - r.left;
  }, {passive:true});
  c.addEventListener('touchstart', e=>{ dragging=true; }, {passive:true});
  c.addEventListener('touchmove', e=>{
    const r = c.getBoundingClientRect();
    mouseX = e.touches[0].clientX - r.left; e.preventDefault();
  }, {passive:false});
  c.addEventListener('touchend', ()=>{ dragging=false; }, {passive:true});
  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft' || e.key.toLowerCase()==='a') paddle.vx = -6;
    if(e.key==='ArrowRight' || e.key.toLowerCase()==='d') paddle.vx = 6;
  });
  window.addEventListener('keyup', e=>{
    if(['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key)) paddle.vx = 0;
  });

  function update(){
    // paddle follow
    if(mouseX!=null) paddle.x = mouseX;
    paddle.x += paddle.vx;
    paddle.x = Math.max(paddle.w/2, Math.min(c.width - paddle.w/2, paddle.x));

    // ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    if(ball.x-ball.r<0 || ball.x+ball.r>c.width) ball.vx *= -1;
    if(ball.y-ball.r<0) ball.vy *= -1;

    // paddle collision
    if(ball.y+ball.r > paddle.y && ball.y+ball.r < paddle.y+paddle.h &&
       ball.x > paddle.x-paddle.w/2 && ball.x < paddle.x+paddle.w/2){
      ball.vy = -Math.abs(ball.vy);
      const off = (ball.x - paddle.x)/(paddle.w/2);
      ball.vx = (2.8 + level*0.2) * off;
    }

    // bricks
    for(const b of bricks){
      if(!b.alive) continue;
      if(ball.x> b.x && ball.x < b.x+b.w && ball.y> b.y && ball.y < b.y+b.h){
        b.alive=false; score+=10; scoreEl.textContent=score;
        // reflect based on entry
        const left = Math.abs(ball.x - b.x);
        const right= Math.abs(ball.x - (b.x+b.w));
        const top  = Math.abs(ball.y - b.y);
        const bottom=Math.abs(ball.y - (b.y+b.h));
        const m = Math.min(left,right,top,bottom);
        if(m===left||m===right) ball.vx*=-1; else ball.vy*=-1;
        break;
      }
    }

    // lose life
    if(ball.y-ball.r>c.height){
      lives--; livesEl.textContent = lives;
      if(lives<=0){ statusEl.textContent='Game over'; stop(); return; }
      // reset ball
      ball.x=c.width/2; ball.y=c.height/2; ball.vx=2.4+level*0.3; ball.vy=-2.6-level*0.3;
    }

    // next level
    if(bricks.every(b=>!b.alive)){
      stop();
      statusEl.textContent='Level up';
      setTimeout(()=>{ reset(true); }, 600);
    }
  }

  function draw(){
    ctx.fillStyle = '#0d0f0e';
    ctx.fillRect(0,0,c.width,c.height);

    // bricks
    for(const b of bricks){
      if(!b.alive) continue;
      ctx.fillStyle = '#1a1f1d'; ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.strokeStyle = '#2a2e2b'; ctx.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);
    }

    // paddle
    ctx.fillStyle = '#e7e7e5';
    ctx.fillRect(paddle.x-paddle.w/2, paddle.y, paddle.w, paddle.h);

    // ball
    ctx.fillStyle = '#4ca495';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();
  }

  function frame(){
    update(); draw();
    raf = requestAnimationFrame(frame);
  }

  function play(){ running=true; cancelAnimationFrame(raf); raf=requestAnimationFrame(frame); }
  function stop(){ running=false; cancelAnimationFrame(raf); }

  newBtn.addEventListener('click', ()=>{ stop(); reset(false); });

  // init
  reset(false);
})();
