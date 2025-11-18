// Space Defender - Cooperative space shooter
class SpaceDefender {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.score = 0;
        this.wave = 1;
        this.lives = 10; // More lives for easier gameplay

        this.ships = []; // Player ships (one per touch)
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.stars = [];

        this.spawnInterval = null;
        this.shootInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();

        this.createStarfield();
    }

    createStarfield() {
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

            // Create or assign ship to touch
            const ship = {
                touchId: touch.id,
                x: touch.x,
                y: touch.y,
                radius: 30,
                color: this.getShipColor(this.ships.length),
                lastShot: 0
            };

            this.ships.push(ship);
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            const ship = this.ships.find(s => s.touchId === touch.id);
            if (ship) {
                ship.x = touch.x;
                ship.y = touch.y;
            }
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            const index = this.ships.findIndex(s => s.touchId === touch.id);
            if (index !== -1) {
                this.ships.splice(index, 1);
            }
        });
    }

    getShipColor(index) {
        const colors = ['#4ecdc4', '#ff6b6b', '#f39c12', '#9b59b6'];
        return colors[index % colors.length];
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.wave = 1;
        this.lives = 10; // Start with more lives
        this.ships = [];
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];

        this.gameHub.updateScore(this.score);

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
            this.ships.forEach(ship => {
                this.shootBullet(ship);
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
        const enemyCount = 3 + this.wave; // Fewer enemies per wave

        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                this.spawnEnemy();
            }, i * 500); // Longer delay between spawns
        }
    }

    spawnEnemy() {
        const types = ['basic', 'fast', 'tank'];
        const type = types[Math.floor(Math.random() * Math.min(types.length, Math.floor(this.wave / 2) + 1))];

        let enemy = {
            x: Math.random() * this.canvas.width,
            y: -50,
            type: type,
            hp: 1,
            speed: 1.5, // Slower base speed
            radius: 25,
            emoji: '👾'
        };

        switch (type) {
            case 'fast':
                enemy.speed = 3; // Slower fast enemies
                enemy.emoji = '🛸';
                enemy.radius = 20;
                break;
            case 'tank':
                enemy.hp = 3;
                enemy.speed = 1;
                enemy.emoji = '💀';
                enemy.radius = 35;
                break;
        }

        this.enemies.push(enemy);
    }

    shootBullet(ship) {
        this.bullets.push({
            x: ship.x,
            y: ship.y,
            vx: 0,
            vy: -15,
            radius: 5,
            color: ship.color
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
                        this.createExplosion(enemy.x, enemy.y);
                        this.enemies.splice(j, 1);

                        const points = enemy.type === 'tank' ? 30 : enemy.type === 'fast' ? 20 : 10;
                        this.score += points;
                        this.gameHub.updateScore(this.score);

                        this.gameHub.playSound('explosion');
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
                this.lives--;

                if (this.lives <= 0) {
                    this.gameOver();
                }
                continue;
            }

            // Check collision with ships
            this.ships.forEach(ship => {
                const dx = ship.x - enemy.x;
                const dy = ship.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ship.radius + enemy.radius) {
                    // Ship hit enemy - destroy enemy
                    this.createExplosion(enemy.x, enemy.y);
                    this.enemies.splice(i, 1);

                    const points = enemy.type === 'tank' ? 30 : enemy.type === 'fast' ? 20 : 10;
                    this.score += points;
                    this.gameHub.updateScore(this.score);
                }
            });
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].progress += 0.05;
            if (this.explosions[i].progress >= 1) {
                this.explosions.splice(i, 1);
            }
        }
    }

    createExplosion(x, y) {
        this.explosions.push({
            x,
            y,
            progress: 0,
            maxRadius: 60
        });

        if (this.gameHub.particleSystem) {
            this.gameHub.particleSystem.createExplosion(x, y, '#ff6b6b', 40);
        }

        if (navigator.vibrate && this.gameHub.settings.vibration) {
            navigator.vibrate(20);
        }
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
            this.ctx.shadowColor = '#ff0000';
            this.ctx.shadowBlur = 20;

            this.ctx.font = `${enemy.radius * 2}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(enemy.emoji, 0, 0);

            // HP bar for tanks
            if (enemy.type === 'tank') {
                const barWidth = enemy.radius * 2;
                const barHeight = 5;

                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                this.ctx.fillRect(-barWidth / 2, enemy.radius + 10, barWidth, barHeight);

                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(-barWidth / 2, enemy.radius + 10, barWidth * (enemy.hp / 3), barHeight);
            }

            this.ctx.restore();
        });

        // Draw explosions
        this.explosions.forEach(exp => {
            const radius = exp.maxRadius * exp.progress;
            const alpha = 1 - exp.progress;

            this.ctx.globalAlpha = alpha;

            // Outer ring
            this.ctx.strokeStyle = '#ff6b6b';
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
        this.ships.forEach(ship => {
            this.ctx.save();
            this.ctx.translate(ship.x, ship.y);

            // Glow
            this.ctx.shadowColor = ship.color;
            this.ctx.shadowBlur = 20;

            // Ship body
            this.ctx.fillStyle = ship.color;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -ship.radius);
            this.ctx.lineTo(ship.radius * 0.7, ship.radius);
            this.ctx.lineTo(-ship.radius * 0.7, ship.radius);
            this.ctx.closePath();
            this.ctx.fill();

            // Cockpit
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, ship.radius * 0.3, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;
            this.ctx.restore();
        });

        // Draw HUD
        this.drawHUD();
    }

    drawHUD() {
        // Lives
        this.ctx.font = '48px Arial';
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.textAlign = 'left';

        for (let i = 0; i < this.lives; i++) {
            this.ctx.fillText('❤️', 30 + i * 60, 50);
        }

        // Wave
        this.ctx.font = 'bold 56px Arial';
        this.ctx.fillStyle = '#4ecdc4';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;
        this.ctx.textAlign = 'right';

        const waveText = `WAVE ${this.wave}`;
        this.ctx.strokeText(waveText, this.canvas.width - 30, 60);
        this.ctx.fillText(waveText, this.canvas.width - 30, 60);

        // Instructions (if no ships)
        if (this.ships.length === 0) {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 300) * 0.3;

            this.ctx.fillText('👆 КОСНИТЕСЬ ЭКРАНА ДЛЯ ИГРЫ 👆', this.canvas.width / 2, this.canvas.height / 2);

            this.ctx.globalAlpha = 1;
        }
    }

    gameOver() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.shootInterval) clearInterval(this.shootInterval);

        ScoreManager.saveScore('space-defender', this.score);

        setTimeout(() => {
            if (confirm(`💥 GAME OVER!\n\nВолна: ${this.wave}\nСчет: ${this.score}\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    resize() {
        this.createStarfield();
    }
}
