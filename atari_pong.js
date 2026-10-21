// Pong clássico estilo Atari
// Um único arquivo para ser rodado diretamente no navegador ou integrado ao HTML

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;
document.body.appendChild(canvas);

// Estilização simples para centrar o canvas e aplicar fundo preto
document.body.style.background = '#111';
document.body.style.display = 'flex';
document.body.style.justifyContent = 'center';
document.body.style.alignItems = 'center';
document.body.style.height = '100vh';
document.body.style.margin = '0';
canvas.style.border = '4px solid #fff';
canvas.style.boxShadow = '0 0 20px rgba(255,255,255,0.5)';

// Sons usando Web Audio API (Estilo Atari 8-bit)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, duration, type = 'square') {
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // AudioContext pode precisar de interação do usuário primeiro
    }
}

// Estado do Jogo
const paddleWidth = 15;
const paddleHeight = 80;

const player = {
    x: 30,
    y: canvas.height / 2 - paddleHeight / 2,
    score: 0,
    speed: 8
};

const ai = {
    x: canvas.width - 30 - paddleWidth,
    y: canvas.height / 2 - paddleHeight / 2,
    score: 0,
    speed: 4.5 // Velocidade ligeiramente menor para ser vencível
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 8,
    speedX: 5,
    speedY: 3,
    baseSpeed: 6
};

// Controles
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

function resetBall(winner) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    // Lança a bola em direção ao vencedor
    ball.speedX = winner === 'player' ? ball.baseSpeed : -ball.baseSpeed;
    ball.speedY = (Math.random() - 0.5) * ball.baseSpeed;
    playSound(150, 0.3, 'sawtooth');
}

function update() {
    // Movimento do Jogador (Setas ou W/S)
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        player.y -= player.speed;
    }
    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        player.y += player.speed;
    }

    // Limites do Jogador
    if (player.y < 0) player.y = 0;
    if (player.y > canvas.height - paddleHeight) player.y = canvas.height - paddleHeight;

    // IA Simples (Segue a bola com atraso/velocidade máxima)
    const aiTarget = ball.y - paddleHeight / 2;
    if (ai.y < aiTarget) {
        ai.y += Math.min(ai.speed, aiTarget - ai.y);
    } else if (ai.y > aiTarget) {
        ai.y -= Math.min(ai.speed, ai.y - aiTarget);
    }

    // Limites da IA
    if (ai.y < 0) ai.y = 0;
    if (ai.y > canvas.height - paddleHeight) ai.y = canvas.height - paddleHeight;

    // Movimento da Bola
    ball.x += ball.speedX;
    ball.y += ball.speedY;

    // Colisão com as paredes superior/inferior
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.speedY = -ball.speedY;
        playSound(300, 0.05);
    }
    if (ball.y + ball.radius > canvas.height) {
        ball.y = canvas.height - ball.radius;
        ball.speedY = -ball.speedY;
        playSound(300, 0.05);
    }

    // Colisão com as Raquetes
    // Jogador
    if (ball.speedX < 0 && ball.x - ball.radius < player.x + paddleWidth && ball.x + ball.radius > player.x) {
        if (ball.y > player.y && ball.y < player.y + paddleHeight) {
            let collidePoint = (ball.y - (player.y + paddleHeight / 2)) / (paddleHeight / 2);
            let angleRad = (Math.PI / 4) * collidePoint;
            let direction = 1;
            
            // Aumenta velocidade gradualmente a cada rebatida
            let currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY) + 0.5;
            ball.speedX = direction * currentSpeed * Math.cos(angleRad);
            ball.speedY = currentSpeed * Math.sin(angleRad);
            
            playSound(450, 0.08);
        }
    }

    // IA
    if (ball.speedX > 0 && ball.x + ball.radius > ai.x && ball.x - ball.radius < ai.x + paddleWidth) {
        if (ball.y > ai.y && ball.y < ai.y + paddleHeight) {
            let collidePoint = (ball.y - (ai.y + paddleHeight / 2)) / (paddleHeight / 2);
            let angleRad = (Math.PI / 4) * collidePoint;
            let direction = -1;
            
            let currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY) + 0.5;
            ball.speedX = direction * currentSpeed * Math.cos(angleRad);
            ball.speedY = currentSpeed * Math.sin(angleRad);
            
            playSound(450, 0.08);
        }
    }

    // Pontuação
    if (ball.x - ball.radius < 0) {
        ai.score++;
        resetBall('player');
    } else if (ball.x + ball.radius > canvas.width) {
        player.score++;
        resetBall('ai');
    }
}

function draw() {
    // Limpa a tela (Fundo Atari)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Linha pontilhada central
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]); // Reseta

    // Desenha as Raquetes
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x, player.y, paddleWidth, paddleHeight);
    ctx.fillRect(ai.x, ai.y, paddleWidth, paddleHeight);

    // Desenha a Bola Quadrada (Estilo Atari Retrô)
    ctx.fillRect(ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);

    // Placar usando fonte monoespaçada retro
    ctx.font = '60px "Courier New", Courier, monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(player.score, canvas.width / 4, 80);
    ctx.fillText(ai.score, (3 * canvas.width) / 4, 80);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Inicia o jogo
loop();
