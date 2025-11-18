// Food Fight - Chaotic food throwing battle!
class FoodFight {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.players = [];
        this.projectiles = [];
        this.splatters = [];

        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#1abc9c', '#e74c3c'];
        this.foodEmojis = ['🍕', '🍔', '🌭', '🥖', '🥐', '🍩', '🎂', '🍰', '🧁', '🥧', '🍪', '🥪'];

        this.gameTime = 0;
        this.gameStartTime = 0;
        this.gameDuration = 90000; // 1.5 minutes

        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            // Find or create player
            let player = this.players.find(p => p.id === touch.id);

            if (!player) {
                // Create new player
                player = {
                    id: touch.id,
                    x: touch.x,
                    y: touch.y,
                    radius: 35,
                    color: this.playerColors[this.players.length % this.playerColors.length],
                    score: 0,
                    hits: 0,
                    lastShot: 0,
                    stunTime: 0,
                    targetX: touch.x,
                    targetY: touch.y
                };
                this.players.push(player);
                this.updateScore();
            }

            player.targetX = touch.x;
            player.targetY = touch.y;
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            const player = this.players.find(p => p.id === touch.id);
            if (player) {
                // Update position smoothly
                player.targetX = touch.x;
                player.targetY = touch.y;

                // Auto throw food while moving
                if (Date.now() - player.lastShot > 300 && player.stunTime <= 0) {
                    this.throwFood(player);
                    player.lastShot = Date.now();
                }
            }
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            const index = this.players.findIndex(p => p.id === touch.id);
            if (index !== -1) {
                this.players.splice(index, 1);
                this.updateScore();
            }
        });
    }

    start() {
        this.isRunning = true;
        this.players = [];
        this.projectiles = [];
        this.splatters = [];
        this.gameStartTime = Date.now();
        this.gameTime = 0;

        this.gameHub.updateScore('0 попаданий');
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    throwFood(player) {
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

            const projectile = {
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * 12,
                vy: Math.sin(angle) * 12,
                radius: 25,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3,
                emoji: this.foodEmojis[Math.floor(Math.random() * this.foodEmojis.length)],
                owner: player.id,
                color: player.color
            };

            this.projectiles.push(projectile);
            this.gameHub.playSound('shoot');
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.gameTime = Date.now() - this.gameStartTime;

        // Check if game time is up
        if (this.gameTime >= this.gameDuration) {
            this.endGame();
            return;
        }

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update players (smooth movement)
        this.players.forEach(player => {
            if (player.stunTime > 0) {
                player.stunTime -= 16;
                return;
            }

            // Smooth movement towards target
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            player.x += dx * 0.15;
            player.y += dy * 0.15;

            // Keep on screen
            const margin = player.radius;
            if (player.x < margin) player.x = margin;
            if (player.x > this.canvas.width - margin) player.x = this.canvas.width - margin;
            if (player.y < margin) player.y = margin;
            if (player.y > this.canvas.height - margin) player.y = this.canvas.height - margin;
        });

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            proj.x += proj.vx;
            proj.y += proj.vy;
            proj.rotation += proj.rotationSpeed;

            // Add slight gravity
            proj.vy += 0.2;

            // Remove if off screen
            if (proj.x < -50 || proj.x > this.canvas.width + 50 ||
                proj.y < -50 || proj.y > this.canvas.height + 50) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Check collision with players
            for (let j = 0; j < this.players.length; j++) {
                const player = this.players[j];
                if (player.id === proj.owner) continue;

                const dx = proj.x - player.x;
                const dy = proj.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < proj.radius + player.radius) {
                    // Hit!
                    player.hits++;
                    player.stunTime = 400;

                    // Award point to thrower
                    const thrower = this.players.find(p => p.id === proj.owner);
                    if (thrower) {
                        thrower.score++;
                    }

                    this.createSplatter(proj.x, proj.y, proj.emoji, proj.color);
                    this.projectiles.splice(i, 1);
                    this.updateScore();

                    this.gameHub.playSound('hit');

                    if (navigator.vibrate && this.gameHub.settings.vibration) {
                        navigator.vibrate(30);
                    }

                    break;
                }
            }
        }

        // Fade splatters
        this.splatters = this.splatters.filter(splatter => {
            splatter.alpha -= 0.005;
            splatter.scale += 0.01;
            return splatter.alpha > 0;
        });
    }

    createSplatter(x, y, emoji, color) {
        this.splatters.push({
            x, y,
            emoji,
            color,
            alpha: 1,
            scale: 1,
            rotation: Math.random() * Math.PI * 2
        });

        // Particle explosion
        if (this.gameHub.particleSystem) {
            this.gameHub.particleSystem.createExplosion(x, y, color, 30);
        }
    }

    updateScore() {
        const totalHits = this.players.reduce((sum, p) => sum + p.score, 0);
        const timeLeft = Math.ceil((this.gameDuration - this.gameTime) / 1000);
        this.gameHub.updateScore(`${totalHits} попаданий | Время: ${timeLeft}с | Игроков: ${this.players.length}`);
    }

    endGame() {
        this.isRunning = false;

        // Find winner
        const winner = this.players.reduce((best, player) => {
            if (!best || player.score > best.score) return player;
            return best;
        }, null);

        const score = winner ? winner.score : 0;
        ScoreManager.saveScore('food-fight', score);

        setTimeout(() => {
            if (confirm(`БИТВА ЗАВЕРШЕНА!\n\nПобедитель: ${score} попаданий\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    draw() {
        // Clear with slight fade for trails
        this.ctx.fillStyle = 'rgba(255, 243, 224, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#fff3e0');
        gradient.addColorStop(1, '#ffe0b2');
        this.ctx.globalCompositeOperation = 'destination-over';
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'source-over';

        // Draw splatters
        this.splatters.forEach(splatter => {
            this.ctx.save();
            this.ctx.translate(splatter.x, splatter.y);
            this.ctx.rotate(splatter.rotation);
            this.ctx.globalAlpha = splatter.alpha;

            // Splatter background
            this.ctx.fillStyle = splatter.color;
            this.ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8;
                const distance = 30 * splatter.scale * (0.8 + Math.random() * 0.4);
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.closePath();
            this.ctx.fill();

            // Food emoji
            this.ctx.font = `${60 * splatter.scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(splatter.emoji, 0, 0);

            this.ctx.restore();
        });

        this.ctx.globalAlpha = 1;

        // Draw projectiles
        this.projectiles.forEach(proj => {
            this.ctx.save();
            this.ctx.translate(proj.x, proj.y);
            this.ctx.rotate(proj.rotation);

            this.ctx.shadowColor = proj.color;
            this.ctx.shadowBlur = 10;

            this.ctx.font = `${proj.radius * 2}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(proj.emoji, 0, 0);

            this.ctx.shadowBlur = 0;
            this.ctx.restore();
        });

        // Draw players
        this.players.forEach(player => {
            this.drawPlayer(player);
        });

        // Draw timer
        const timeLeft = Math.ceil((this.gameDuration - this.gameTime) / 1000);
        this.ctx.font = 'bold 48px Arial';
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 4;
        this.ctx.strokeText(`⏱️ ${timeLeft}`, this.canvas.width / 2, 60);
        this.ctx.fillText(`⏱️ ${timeLeft}`, this.canvas.width / 2, 60);

        // Draw instructions
        if (this.players.length === 0) {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = '#d84315';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 4;

            const text = '👆 КОСНИТЕСЬ И ДВИГАЙТЕ ДЛЯ БИТВЫ ЕДОЙ 👆';
            this.ctx.strokeText(text, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawPlayer(player) {
        this.ctx.save();

        // Stun effect
        if (player.stunTime > 0) {
            this.ctx.globalAlpha = 0.6;

            // Shake effect
            const shakeX = (Math.random() - 0.5) * 10;
            const shakeY = (Math.random() - 0.5) * 10;
            this.ctx.translate(shakeX, shakeY);
        }

        // Player shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(player.x, player.y + player.radius + 5, player.radius * 0.8, player.radius * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();

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

        // Player face
        this.ctx.font = `${player.radius * 1.2}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (player.stunTime > 0) {
            this.ctx.fillText('😵', player.x, player.y);
        } else {
            this.ctx.fillText('😄', player.x, player.y);
        }

        // Score badge
        if (player.score > 0) {
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.textAlign = 'center';

            const badgeY = player.y - player.radius - 15;
            this.ctx.strokeText(player.score.toString(), player.x, badgeY);
            this.ctx.fillText(player.score.toString(), player.x, badgeY);
        }

        // Hits indicator
        if (player.hits > 0) {
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = '#ff0000';
            this.ctx.textAlign = 'center';

            const hitsY = player.y + player.radius + 25;
            this.ctx.fillText(`×${player.hits}`, player.x, hitsY);
        }

        this.ctx.restore();
    }

    resize() {
        // Nothing special needed
    }
}
