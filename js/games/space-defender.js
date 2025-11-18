// Space Defender - Competitive multiplayer space shooter
class SpaceDefender {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;

        this.isRunning = false;
        this.wave = 1;

        this.players = [];
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.stars = [];

        this.playerColors = ['#4ecdc4', '#ff6b6b', '#ffd700', '#9b59b6'];
        this.sectorWidth = 0;

        this.spawnInterval = null;
        this.shootInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupPlayers();
        this.setupTouchHandlers();
        this.createStarfield();
    }

    setupPlayers() {
        this.players = [];
        this.sectorWidth = this.canvas.width / this.playerCount;

        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i,
                name: `Игрок ${i + 1}`,
                sector: i,
                x: this.sectorWidth * i + this.sectorWidth / 2,
                y: this.canvas.height - 80,
                touchId: null,
                radius: 30,
                color: this.playerColors[i],
                score: 0,
                lives: 5,
                alive: true
            });
        }
    }

    createStarfield() {
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 2 + 1
            });
        }
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            // Assign touch to player based on sector
            const sectorIndex = Math.floor(touch.x / this.sectorWidth);
            const player = this.players[sectorIndex];

            if (player && player.alive && player.touchId === null) {
                player.touchId = touch.id;
            }
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            const player = this.players.find(p => p.touchId === touch.id);
            if (player && player.alive) {
                // Constrain to player's sector
                const sectorLeft = player.sector * this.sectorWidth;
                const sectorRight = sectorLeft + this.sectorWidth;

                player.x = Math.max(sectorLeft + player.radius, Math.min(sectorRight - player.radius, touch.x));
                player.y = Math.max(this.canvas.height / 2, Math.min(this.canvas.height - player.radius, touch.y));
            }
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            const player = this.players.find(p => p.touchId === touch.id);
            if (player) {
                player.touchId = null;
            }
        });
    }

    start() {
        this.isRunning = true;
        this.wave = 1;

        this.setupPlayers();
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];

        this.updateScore();

        // Spawn enemies
        this.spawnWave();
        this.spawnInterval = setInterval(() => {
            if (this.enemies.length === 0) {
                this.wave++;
                this.spawnWave();
            }
        }, 1000);

        // Auto-shoot
        this.shootInterval = setInterval(() => {
            this.players.forEach(player => {
                if (player.alive && player.touchId !== null) {
                    this.shootBullet(player);
                }
            });
        }, 200);

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.shootInterval) clearInterval(this.shootInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    spawnWave() {
        const enemyCount = 3 + this.wave;

        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                this.spawnEnemy();
            }, i * 800);
        }
    }

    spawnEnemy() {
        // Pick random sector with alive player
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length === 0) return;

        const targetPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        const sector = targetPlayer.sector;

        const types = ['basic', 'fast', 'tank'];
        const type = types[Math.floor(Math.random() * Math.min(types.length, Math.floor(this.wave / 2) + 1))];

        // Spawn in sector
        const sectorLeft = sector * this.sectorWidth;
        const sectorRight = sectorLeft + this.sectorWidth;

        let enemy = {
            sector: sector,
            x: sectorLeft + Math.random() * (sectorRight - sectorLeft),
            y: -50,
            type: type,
            hp: 1,
            speed: 2,
            radius: 25,
            color: '#ff0000'
        };

        switch (type) {
            case 'fast':
                enemy.speed = 4;
                enemy.radius = 20;
                enemy.color = '#ff9900';
                break;
            case 'tank':
                enemy.hp = 3;
                enemy.speed = 1.5;
                enemy.radius = 35;
                enemy.color = '#990000';
                break;
        }

        this.enemies.push(enemy);
    }

    shootBullet(player) {
        this.bullets.push({
            playerId: player.id,
            x: player.x,
            y: player.y - player.radius,
            vx: 0,
            vy: -15,
            radius: 5,
            color: player.color
        });

        this.gameHub.playSound('shoot');
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update stars
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            bullet.x += bullet.vx;
            bullet.y += bullet.vy;

            // Remove if off screen
            if (bullet.y < 0 || bullet.y > this.canvas.height) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Check collision with enemies
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                const dx = bullet.x - enemy.x;
                const dy = bullet.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < bullet.radius + enemy.radius) {
                    // Hit!
                    enemy.hp--;

                    if (enemy.hp <= 0) {
                        // Enemy destroyed
                        this.createExplosion(enemy.x, enemy.y, bullet.color);
                        this.enemies.splice(j, 1);

                        // Award points to shooter
                        const player = this.players[bullet.playerId];
                        if (player && player.alive) {
                            const points = enemy.type === 'tank' ? 30 : enemy.type === 'fast' ? 20 : 10;
                            player.score += points;
                        }

                        this.gameHub.playSound('explosion');
                        this.updateScore();
                    }

                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.y += enemy.speed;

            // Check if reached bottom
            if (enemy.y > this.canvas.height + 50) {
                this.enemies.splice(i, 1);

                // Player loses life
                const player = this.players[enemy.sector];
                if (player && player.alive) {
                    player.lives--;

                    if (player.lives <= 0) {
                        player.alive = false;
                        this.gameHub.playSound('hit');
                        this.checkGameOver();
                    }

                    this.updateScore();
                }
                continue;
            }
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].progress += 0.05;
            if (this.explosions[i].progress >= 1) {
                this.explosions.splice(i, 1);
            }
        }
    }

    createExplosion(x, y, color) {
        this.explosions.push({
            x,
            y,
            progress: 0,
            maxRadius: 60,
            color: color || '#ff6b6b'
        });

        if (this.gameHub.particleSystem) {
            this.gameHub.particleSystem.createExplosion(x, y, color || '#ff6b6b', 30);
        }

        if (navigator.vibrate && this.gameHub.settings.vibration) {
            navigator.vibrate(20);
        }
    }

    checkGameOver() {
        const alivePlayers = this.players.filter(p => p.alive);

        if (alivePlayers.length <= 1) {
            this.endGame();
        }
    }

    endGame() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.shootInterval) clearInterval(this.shootInterval);

        // Find winner (highest score among alive, or highest score if all dead)
        const winner = this.players.reduce((best, player) => {
            if (!best) return player;
            if (player.alive && !best.alive) return player;
            if (player.score > best.score) return player;
            return best;
        }, null);

        if (winner) {
            ScoreManager.saveScore('space-defender', winner.score);
        }

        setTimeout(() => {
            const scoreStr = this.players
                .map(p => `${p.name}: ${p.score}`)
                .join('\n');

            const message = `🚀 ИГРА ЗАВЕРШЕНА!\n\nПобедитель: ${winner ? winner.name : 'Никто'}\nВолна: ${this.wave}\n\n${scoreStr}\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.gameHub.showPlayerSelection('space-defender');
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    updateScore() {
        const aliveCount = this.players.filter(p => p.alive).length;
        const scores = this.players
            .map(p => `П${p.id + 1}: ${p.score}❤️${p.lives}${p.alive ? '' : '💀'}`)
            .join(' | ');

        this.gameHub.updateScore(`${scores} | WAVE ${this.wave}`);
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stars
        this.ctx.fillStyle = 'white';
        this.stars.forEach(star => {
            this.ctx.globalAlpha = Math.random() * 0.5 + 0.5;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Draw sector dividers
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);

        for (let i = 1; i < this.playerCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.sectorWidth, 0);
            this.ctx.lineTo(i * this.sectorWidth, this.canvas.height);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);

        // Draw sector labels
        this.players.forEach(player => {
            const sectorX = player.sector * this.sectorWidth + this.sectorWidth / 2;

            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = player.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`П${player.id + 1}`, sectorX, 40);

            // Score and lives
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(`${player.score}`, sectorX, 70);

            // Lives
            for (let i = 0; i < player.lives; i++) {
                this.ctx.fillText('❤️', sectorX - 30 + i * 20, 100);
            }

            // Dead indicator
            if (!player.alive) {
                this.ctx.globalAlpha = 0.3;
                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(player.sector * this.sectorWidth, 0, this.sectorWidth, this.canvas.height);

                this.ctx.globalAlpha = 1;
                this.ctx.font = 'bold 64px Arial';
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillText('💀', sectorX, this.canvas.height / 2);
            }
        });

        this.ctx.globalAlpha = 1;

        // Draw bullets
        this.bullets.forEach(bullet => {
            this.ctx.fillStyle = bullet.color;
            this.ctx.shadowColor = bullet.color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw enemies
        this.enemies.forEach(enemy => {
            this.ctx.save();
            this.ctx.translate(enemy.x, enemy.y);

            // Glow effect
            this.ctx.shadowColor = enemy.color;
            this.ctx.shadowBlur = 20;

            // Enemy body (alien ship shape)
            this.ctx.fillStyle = enemy.color;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Eyes
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = 'black';
            this.ctx.beginPath();
            this.ctx.arc(-enemy.radius * 0.3, -enemy.radius * 0.2, enemy.radius * 0.15, 0, Math.PI * 2);
            this.ctx.arc(enemy.radius * 0.3, -enemy.radius * 0.2, enemy.radius * 0.15, 0, Math.PI * 2);
            this.ctx.fill();

            // Tentacles
            this.ctx.strokeStyle = enemy.color;
            this.ctx.lineWidth = 3;
            for (let i = -1; i <= 1; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(i * enemy.radius * 0.3, enemy.radius);
                this.ctx.lineTo(i * enemy.radius * 0.4, enemy.radius * 1.5);
                this.ctx.stroke();
            }

            // HP bar for tanks
            if (enemy.type === 'tank') {
                const barWidth = enemy.radius * 2;
                const barHeight = 5;

                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                this.ctx.fillRect(-barWidth / 2, enemy.radius + 20, barWidth, barHeight);

                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(-barWidth / 2, enemy.radius + 20, barWidth * (enemy.hp / 3), barHeight);
            }

            this.ctx.restore();
        });

        // Draw explosions
        this.explosions.forEach(exp => {
            const radius = exp.maxRadius * exp.progress;
            const alpha = 1 - exp.progress;

            this.ctx.globalAlpha = alpha;

            // Outer ring
            this.ctx.strokeStyle = exp.color;
            this.ctx.lineWidth = 8;
            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inner ring
            this.ctx.strokeStyle = '#ffd700';
            this.ctx.lineWidth = 5;
            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, radius * 0.7, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.globalAlpha = 1;
        });

        // Draw ships
        this.players.forEach(player => {
            if (!player.alive) return;

            this.ctx.save();
            this.ctx.translate(player.x, player.y);

            // Glow
            this.ctx.shadowColor = player.color;
            this.ctx.shadowBlur = 20;

            // Ship body
            this.ctx.fillStyle = player.color;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -player.radius);
            this.ctx.lineTo(player.radius * 0.7, player.radius);
            this.ctx.lineTo(-player.radius * 0.7, player.radius);
            this.ctx.closePath();
            this.ctx.fill();

            // Wings
            this.ctx.fillStyle = player.color;
            this.ctx.globalAlpha = 0.7;
            this.ctx.beginPath();
            this.ctx.moveTo(-player.radius * 0.7, player.radius * 0.3);
            this.ctx.lineTo(-player.radius * 1.2, player.radius * 0.8);
            this.ctx.lineTo(-player.radius * 0.7, player.radius);
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.moveTo(player.radius * 0.7, player.radius * 0.3);
            this.ctx.lineTo(player.radius * 1.2, player.radius * 0.8);
            this.ctx.lineTo(player.radius * 0.7, player.radius);
            this.ctx.fill();

            this.ctx.globalAlpha = 1;

            // Cockpit
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, player.radius * 0.3, 0, Math.PI * 2);
            this.ctx.fill();

            // Player number
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = 'black';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${player.id + 1}`, 0, 0);

            this.ctx.shadowBlur = 0;
            this.ctx.restore();

            // Touch prompt if no touch
            if (player.touchId === null) {
                this.ctx.font = 'bold 24px Arial';
                this.ctx.fillStyle = player.color;
                this.ctx.textAlign = 'center';
                this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 300) * 0.3;
                this.ctx.fillText('👆 КОСНИТЕСЬ', player.x, player.y - 50);
                this.ctx.globalAlpha = 1;
            }
        });
    }

    resize() {
        this.sectorWidth = this.canvas.width / this.playerCount;
        this.setupPlayers();
        this.createStarfield();
    }
}
