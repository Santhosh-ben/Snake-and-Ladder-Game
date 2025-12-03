/* --- CONFIGURATION --- */
const boardSize = 10;
let players = [];
let currentPlayerIndex = 0;
let isAnimating = false;
let activeSnakes = []; 
let audioCtx = null; // Initialize later to prevent crash

// Game Maps
const snakes = { 98: 28, 95: 56, 92: 51, 83: 19, 73: 1, 69: 33, 64: 36, 59: 17, 55: 7, 52: 11, 48: 9, 46: 5 };
const ladders = { 2: 23, 8: 29, 22: 41, 28: 77, 30: 32, 44: 58, 54: 68, 70: 90, 80: 99, 87: 93 };
const colors = ['#00FFFF', '#FF0055', '#39FF14', '#FFFF00'];

// Initialize Audio Context Safely
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Generic Tone Generator
function playTone(freq, type, dur, slideTo = null, vol = 0.1) {
    if (!audioCtx) initAudio();
    const osc = audioCtx.createOscillator();
    const gn = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if(slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
    
    gn.gain.setValueAtTime(vol, audioCtx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    
    osc.connect(gn); gn.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + dur);
}

// 1. Realistic Hiss (Procedural Noise)
function sfxHiss() {
    if (!audioCtx) initAudio();
    const bufferSize = audioCtx.sampleRate * 1.5; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

// 2. Swallow Gulp Sound
function sfxGulp() {
    playTone(200, 'sine', 0.4, 50, 0.8);
}

// 3. Dice Rattle
function sfxRoll() { 
    if (!audioCtx) initAudio();
    const dur = 0.8;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*dur, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.value = 0.3;
    src.connect(g); g.connect(audioCtx.destination);
    src.start();
}

function sfxStep() { playTone(300, 'sine', 0.1); }
function sfxLadder() { playTone(150, 'triangle', 0.6, 400, 0.2); }
function sfxScare() { playTone(100, 'sawtooth', 0.8, 50, 0.5); playTone(150, 'square', 0.8, 80, 0.5); }
function sfxWin() { [400, 500, 600, 800].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.3), i*200)); }

/* --- GAME INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listener safely after DOM loads
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
});

function startGame() {
    // Initialize Audio on Click
    initAudio();

    const countInput = document.getElementById('player-count');
    const count = parseInt(countInput.value) || 2; // Default to 2 if empty

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('winner-overlay').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    createBoardGrid();
    
    players = [];
    currentPlayerIndex = 0;
    
    for(let i=0; i<count; i++) {
        players.push({ id: i, name: `Player ${i+1}`, pos: 1, color: colors[i], element: createPlayerToken(i, colors[i]) });
        moveTokenVisual(players[i], 1);
    }
    
    drawGraphics();
    updateUI();
    
    // Start Loops
    requestAnimationFrame(animateSnakes);
    startAmbientSounds();
}

function startAmbientSounds() {
    setInterval(() => {
        if(Math.random() > 0.7 && !isAnimating) {
            sfxHiss(); 
        }
    }, 6000);
}

function createBoardGrid() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for(let r=0; r<10; r++) {
        for(let c=0; c<10; c++) {
            let num = (r % 2 === 0) ? (10-r)*10 - c : (10-r-1)*10 + c + 1;
            const t = document.createElement('div');
            t.className = 'tile';
            t.innerText = num;
            t.id = `tile-${num}`;
            board.appendChild(t);
        }
    }
}

function createPlayerToken(id, color) {
    const t = document.createElement('div');
    t.className = 'player-token';
    t.style.backgroundColor = color;
    t.innerText = `P${id+1}`;
    document.getElementById('board').appendChild(t);
    return t;
}

/* --- GAME LOGIC --- */
async function rollDice() {
    if(isAnimating) return;
    isAnimating = true;
    document.getElementById('roll-btn').disabled = true;
    
    const dice = document.getElementById('dice');
    sfxRoll();
    dice.classList.add('rolling');
    
    const roll = Math.floor(Math.random() * 6) + 1;
    await new Promise(r => setTimeout(r, 800));
    
    dice.classList.remove('rolling');
    
    const rot = { 
        1: [0, 0], 
        2: [-90, 0], 
        3: [0, 90], 
        4: [0, -90], 
        5: [90, 0], 
        6: [180, 0] 
    };
    dice.style.transform = `translate3d(0,0,0) rotateX(${rot[roll][0]}deg) rotateY(${rot[roll][1]}deg)`;
    
    document.getElementById('message-text').innerText = `${players[currentPlayerIndex].name} rolled a ${roll}!`;
    await movePlayer(roll);
}

async function movePlayer(steps) {
    const p = players[currentPlayerIndex];
    let current = p.pos;
    let path = [];
    
    for(let i=1; i<=steps; i++) {
        if(current < 100) current++; else current--;
        path.push(current);
    }
    
    for(const tile of path) {
        p.pos = tile;
        moveTokenVisual(p, tile);
        sfxStep();
        await new Promise(r => setTimeout(r, 300));
    }
    
    if(p.pos === 100) { victory(p); return; }
    await checkEntity(p);
    isAnimating = false;
    document.getElementById('roll-btn').disabled = false;
    nextTurn();
}

async function checkEntity(p) {
    if(snakes[p.pos]) {
        document.getElementById('message-text').innerText = "OH NO! SWALLOWED!";
        
        sfxScare(); 
        sfxHiss();  

        // Visuals
        const ov = document.getElementById('scare-overlay');
        ov.style.display = 'flex';
        await new Promise(r => setTimeout(r, 1200));
        ov.style.display = 'none';
        
        // Swallow
        sfxGulp(); 
        const targetTile = snakes[p.pos];
        const snakeData = activeSnakes.find(s => s.id == p.pos);
        
        if(snakeData) {
            await animateSwallow(p, snakeData);
        } else {
            p.pos = targetTile;
            moveTokenVisual(p, p.pos);
        }
        p.pos = targetTile;
        
    } else if(ladders[p.pos]) {
        document.getElementById('message-text').innerText = "LADDER!";
        sfxLadder();
        p.pos = ladders[p.pos];
        moveTokenVisual(p, p.pos);
        await new Promise(r => setTimeout(r, 600));
    }
}

// BEZIER PATH ANIMATION
function animateSwallow(player, snakeData) {
    return new Promise(resolve => {
        const start = Date.now();
        const duration = 1500;
        const token = player.element;
        token.classList.add('swallowed');
        
        function frame() {
            const now = Date.now();
            const pct = Math.min(1, (now - start) / duration);
            const t = pct;
            const invT = 1 - t;
            
            const x = (invT * invT * snakeData.p1.x) + (2 * invT * t * snakeData.baseCx) + (t * t * snakeData.p2.x);
            const y = (invT * invT * snakeData.p1.y) + (2 * invT * t * snakeData.baseCy) + (t * t * snakeData.p2.y);
            
            token.style.left = `${x - 17.5}px`;
            token.style.top = `${y - 17.5}px`;
            
            if (pct < 1) {
                requestAnimationFrame(frame);
            } else {
                token.classList.remove('swallowed');
                moveTokenVisual(player, snakes[snakeData.id]);
                resolve();
            }
        }
        requestAnimationFrame(frame);
    });
}

function nextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateUI();
}

function updateUI() {
    const p = players[currentPlayerIndex];
    document.getElementById('current-player-name').innerText = p.name;
    document.getElementById('current-player-name').style.color = p.color;
    document.getElementById('turn-token-preview').style.backgroundColor = p.color;
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(pl => {
        const li = document.createElement('li');
        li.innerHTML = `<span style="color:${pl.color}">●</span> ${pl.name}: Tile ${pl.pos}`;
        list.appendChild(li);
    });
}

function moveTokenVisual(p, tileNum) {
    const tile = document.getElementById(`tile-${tileNum}`);
    if(!tile) return;
    const token = p.element;
    const br = document.getElementById('board').getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    token.style.left = `${tr.left - br.left + (tr.width - 35)/2}px`;
    token.style.top = `${tr.top - br.top + (tr.height - 35)/2}px`;
}

function victory(p) {
    document.getElementById('winner-overlay').style.display = 'flex';
    document.getElementById('winner-name').innerText = p.name;
    document.getElementById('winner-token-large').style.backgroundColor = p.color;
    sfxWin();
    const c = document.getElementById('confetti-canvas');
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    const pieces = Array.from({length:150}, () => ({
        x: Math.random()*c.width, y: Math.random()*c.height - c.height,
        c: colors[Math.floor(Math.random()*colors.length)], s: Math.random()*8+4, v: Math.random()*5+2
    }));
    function loop() {
        ctx.clearRect(0,0,c.width, c.height);
        pieces.forEach(k => {
            k.y += k.v; if(k.y > c.height) k.y = -10;
            ctx.fillStyle = k.c; ctx.fillRect(k.x, k.y, k.s, k.s);
        });
        requestAnimationFrame(loop);
    }
    loop();
}

/* --- GRAPHICS --- */
function getCenter(id) {
    const tile = document.getElementById(`tile-${id}`);
    if(!tile) return {x:0, y:0};
    const r = tile.getBoundingClientRect();
    const b = document.getElementById('board').getBoundingClientRect();
    return { x: r.left - b.left + r.width/2, y: r.top - b.top + r.height/2 };
}

function drawGraphics() {
    const svg = document.getElementById('board-graphics');
    const board = document.getElementById('board');
    svg.setAttribute('width', board.clientWidth);
    svg.setAttribute('height', board.clientHeight);
    svg.innerHTML = '';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="snakeSkin" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#2e7d32"/>
            <stop offset="50%" stop-color="#66bb6a"/>
            <stop offset="100%" stop-color="#1b5e20"/>
        </linearGradient>`;
    svg.appendChild(defs);

    // LADDERS
    for(const [s, e] of Object.entries(ladders)) {
        const p1 = getCenter(s), p2 = getCenter(e);
        const g = document.createElementNS('http://www.w3.org/2000/svg','g');
        const mkLine = (x1,y1,x2,y2,w,c) => {
            const l = document.createElementNS('http://www.w3.org/2000/svg','line');
            l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
            l.setAttribute('stroke',c); l.setAttribute('stroke-width',w); return l;
        };
        g.append(mkLine(p1.x-8, p1.y, p2.x-8, p2.y, 5, '#5d4037'));
        g.append(mkLine(p1.x+8, p1.y, p2.x+8, p2.y, 5, '#5d4037'));
        for(let i=0; i<=6; i++) {
            const lx = p1.x + (p2.x-p1.x)*(i/6), ly = p1.y + (p2.y-p1.y)*(i/6);
            g.append(mkLine(lx-8, ly, lx+8, ly, 3, '#3e2723'));
        }
        svg.appendChild(g);
    }

    // SNAKES
    activeSnakes = []; 
    for(const [s, e] of Object.entries(snakes)) {
        const p1 = getCenter(s), p2 = getCenter(e);
        const cx = (p1.x+p2.x)/2 + (Math.random() > 0.5 ? 40 : -40);
        const cy = (p1.y+p2.y)/2;
        
        const snakeObj = { id: s, p1: p1, p2: p2, baseCx: cx, baseCy: cy, pathEl: null, angle: Math.atan2(p2.y-p1.y, p2.x-p1.x) };

        const body = document.createElementNS('http://www.w3.org/2000/svg','path');
        body.setAttribute('stroke', 'url(#snakeSkin)');
        body.setAttribute('fill', 'none');
        body.setAttribute('stroke-width', 16);
        body.setAttribute('stroke-linecap', 'round');
        snakeObj.pathEl = body;
        svg.appendChild(body);
        activeSnakes.push(snakeObj);

        // HEAD
        const g = document.createElementNS('http://www.w3.org/2000/svg','g');
        const deg = Math.atan2(p2.y-p1.y, p2.x-p1.x) * 180 / Math.PI;
        g.setAttribute('transform', `translate(${p1.x}, ${p1.y}) rotate(${deg})`);
        
        const head = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
        head.setAttribute('cx', 0); head.setAttribute('cy', 0);
        head.setAttribute('rx', 12); head.setAttribute('ry', 9);
        head.setAttribute('fill', '#1b5e20');
        
        const eye1 = document.createElementNS('http://www.w3.org/2000/svg','circle');
        eye1.setAttribute('cx', 5); eye1.setAttribute('cy', -4);
        eye1.setAttribute('class', 'snake-eyes');
        const eye2 = document.createElementNS('http://www.w3.org/2000/svg','circle');
        eye2.setAttribute('cx', 5); eye2.setAttribute('cy', 4);
        eye2.setAttribute('class', 'snake-eyes');

        const tongue = document.createElementNS('http://www.w3.org/2000/svg','path');
        tongue.setAttribute('d', 'M 10 0 L 25 0 L 30 -4 M 25 0 L 30 4');
        tongue.setAttribute('stroke', '#ff0000');
        tongue.setAttribute('stroke-width', 2);
        tongue.setAttribute('fill', 'none');
        tongue.setAttribute('class', 'snake-tongue');

        g.append(head, eye1, eye2, tongue);
        svg.appendChild(g);
    }
}

function animateSnakes() {
    const time = Date.now() * 0.003; 
    activeSnakes.forEach((snake, index) => {
        const sway = Math.sin(time + index) * 20; 
        const perp = snake.angle + Math.PI/2;
        const curCx = snake.baseCx + Math.cos(perp) * sway;
        const curCy = snake.baseCy + Math.sin(perp) * sway;
        snake.pathEl.setAttribute('d', `M ${snake.p1.x} ${snake.p1.y} Q ${curCx} ${curCy} ${snake.p2.x} ${snake.p2.y}`);
    });
    requestAnimationFrame(animateSnakes);
}

window.onresize = drawGraphics;