// Paintball Arena - Multiplayer paintball battle
class PaintballArena {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.players = [];
        this.paintballs = [];
        this.splatters = [];

        this.playerColors = ['#4ecdc4', '#ff6b6b', '#f39c12', '#9b59b6', '#1abc9c', '#e74c3c'];

        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            // Create new player for this touch
            const player = {
                id: touch.id,
                x: touch.x,
                y: touch.y,
                radius: 30,
                color: this.playerColors[this.players.length % this.playerColors.length],
                hits: 0,
                score: 0,
                lastShot: Date.now()
            };

            this.players.push(player);
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            const player = this.players.find(p => p.id === touch.id);
            if (player) {
                player.x = touch.x;
                player.y = touch.y;

                // Auto shoot while moving
                if (Date.now() - player.lastShot > 200) {
                    this.shootPaintball(player);
                    player.lastShot = Date.now();
                }
            }
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            const index = this.players.findIndex(p => p.id === touch.id);
            if (index !== -1) {
                this.players.splice(index, 1);
            }
        });
    }

    start() {
        this.isRunning = true;
        this.players = [];
        this.paintballs = [];
        this.splatters = [];

        this.gameHub.updateScore('0 попаданий');

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    shootPaintball(player) {
        // Find nearest target
        let nearestTarget = null;
        let nearestDistance = Infinity;

        this.players.forEach(other => {
            if (other.id === player.id) return;

            const dx = other.x - player.x;
            const dy = other.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestTarget = other;
            }
        });

        if (nearestTarget) {
            const dx = nearestTarget.x - player.x;
            const dy = nearestTarget.y - player.y;
            const angle = Math.atan2(dy, dx);

            const paintball = {
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * 10,
                vy: Math.sin(angle) * 10,
                radius: 6,
                color: player.color,
                owner: player.id
            };

            this.paintballs.push(paintball);
            this.gameHub.playSound('shoot');
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update paintballs
        for (let i = this.paintballs.length - 1; i >= 0; i--) {
            const ball = this.paintballs[i];

            ball.x += ball.vx;
            ball.y += ball.vy;

            // Remove if off screen
            if (ball.x < 0 || ball.x > this.canvas.width ||
                ball.y < 0 || ball.y > this.canvas.height) {
                this.paintballs.splice(i, 1);
                continue;
            }

            // Check collision with players
            for (let j = 0; j < this.players.length; j++) {
                const player = this.players[j];
                if (player.id === ball.owner) continue;

                const dx = ball.x - player.x;
                const dy = ball.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball.radius + player.radius) {
                    // Hit!
                    player.hits++;
                    this.createSplatter(ball.x, ball.y, ball.color);

                    // Award point to shooter
                    const shooter = this.players.find(p => p.id === ball.owner);
                    if (shooter) {
                        shooter.score++;
                    }

                    this.paintballs.splice(i, 1);
                    this.updateScore();

                    this.gameHub.playSound('hit');

                    if (navigator.vibrate && this.gameHub.settings.vibration) {
                        navigator.vibrate(20);
                    }

                    break;
                }
            }
        }

        // Fade old splatters
        this.splatters = this.splatters.filter(splatter => {
            splatter.alpha -= 0.01;
            return splatter.alpha > 0;
        });
    }

    createSplatter(x, y, color) {
        this.splatters.push({
            x, y,
            color,
            alpha: 0.8,
            radius: 20 + Math.random() * 20
        });

        if (this.gameHub.particleSystem) {
            this.gameHub.particleSystem.createExplosion(x, y, color, 20);
        }
    }

    updateScore() {
        const totalHits = this.players.reduce((sum, p) => sum + p.score, 0);
        this.gameHub.updateScore(`${totalHits} попаданий | Игроков: ${this.players.length}`);
    }

    draw() {
        // Clear with slight fade for trail effect
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw arena background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#ecf0f1');
        gradient.addColorStop(1, '#bdc3c7');
        this.ctx.globalCompositeOperation = 'destination-over';
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'source-over';

        // Draw splatters
        this.splatters.forEach(splatter => {
            this.ctx.globalAlpha = splatter.alpha;
            this.ctx.fillStyle = splatter.color;

            this.ctx.beginPath();
            this.ctx.arc(splatter.x, splatter.y, splatter.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Drips
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = splatter.radius * 0.5;
                this.ctx.beginPath();
                this.ctx.arc(
                    splatter.x + Math.cos(angle) * distance,
                    splatter.y + Math.sin(angle) * distance,
                    splatter.radius * 0.3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }
        });

        this.ctx.globalAlpha = 1;

        // Draw paintballs
        this.paintballs.forEach(ball => {
            this.ctx.fillStyle = ball.color;
            this.ctx.shadowColor = ball.color;
            this.ctx.shadowBlur = 10;

            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;
        });

        // Draw players
        this.players.forEach(player => {
            this.drawPlayer(player);
        });

        // Draw instructions
        if (this.players.length === 0) {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 4;

            const text = '👆 КОСНИТЕСЬ И ДВИГАЙТЕ ПАЛЬЦЫ ДЛЯ ИГРЫ 👆';
            this.ctx.strokeText(text, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawPlayer(player) {
        // Player body
        this.ctx.fillStyle = player.color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 4;

        this.ctx.shadowColor = player.color;
        this.ctx.shadowBlur = 15;

        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;

        // Player score
        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;

        this.ctx.strokeText(player.score.toString(), player.x, player.y);
        this.ctx.fillText(player.score.toString(), player.x, player.y);

        // Hit indicator
        if (player.hits > 0) {
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = '#ff0000';
            this.ctx.textAlign = 'center';

            this.ctx.fillText(`×${player.hits}`, player.x, player.y - player.radius - 10);
        }
    }

    resize() {
        // Nothing special needed
    }
}
