// Tower Battle - Multiplayer tower defense battle
class TowerBattle {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.towers = [];
        this.projectiles = [];
        this.explosions = [];
        this.activePlayers = 0;

        // Tower positions (corners of screen)
        this.towerPositions = [
            { x: 100, y: 100, angle: 45, color: '#4ecdc4', name: 'Игрок 1', corner: 'top-left' },
            { x: canvas.width - 100, y: 100, angle: 135, color: '#ff6b6b', name: 'Игрок 2', corner: 'top-right' },
            { x: canvas.width - 100, y: canvas.height - 100, angle: 225, color: '#f39c12', name: 'Игрок 3', corner: 'bottom-right' },
            { x: 100, y: canvas.height - 100, angle: 315, color: '#9b59b6', name: 'Игрок 4', corner: 'bottom-left' }
        ];

        this.animationFrame = null;
        this.shootInterval = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            // Determine which tower this touch belongs to
            const towerIndex = this.getTowerByPosition(touch.x, touch.y);

            if (towerIndex !== -1 && !this.towers[towerIndex].active) {
                this.towers[towerIndex].active = true;
                this.towers[towerIndex].touchId = touch.id;
                this.activePlayers++;
            }
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            // Update tower aim
            this.towers.forEach(tower => {
                if (tower.touchId === touch.id && tower.active && tower.hp > 0) {
                    const dx = touch.x - tower.x;
                    const dy = touch.y - tower.y;
                    tower.targetAngle = Math.atan2(dy, dx);
                }
            });
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            this.towers.forEach(tower => {
                if (tower.touchId === touch.id) {
                    tower.touchId = null;
                }
            });
        });
    }

    getTowerByPosition(x, y) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const midX = w / 2;
        const midY = h / 2;

        // Top-left quadrant
        if (x < midX && y < midY) return 0;
        // Top-right quadrant
        if (x >= midX && y < midY) return 1;
        // Bottom-right quadrant
        if (x >= midX && y >= midY) return 2;
        // Bottom-left quadrant
        if (x < midX && y >= midY) return 3;

        return -1;
    }

    start() {
        this.isRunning = true;
        this.activePlayers = 0;
        this.projectiles = [];
        this.explosions = [];

        // Initialize towers
        this.towers = this.towerPositions.map(pos => ({
            ...pos,
            hp: 100,
            maxHp: 100,
            active: false,
            touchId: null,
            currentAngle: pos.angle * Math.PI / 180,
            targetAngle: pos.angle * Math.PI / 180,
            radius: 50,
            lastShot: 0,
            fireRate: 500 // ms between shots
        }));

        this.gameHub.updateScore('Ждем игроков...');

        this.gameLoop();

        // Auto shoot
        this.shootInterval = setInterval(() => {
            this.towers.forEach((tower, index) => {
                if (tower.active && tower.hp > 0) {
                    this.shootProjectile(index);
                }
            });
        }, 500);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.shootInterval) clearInterval(this.shootInterval);
        this.touchHandler.destroy();
    }

    shootProjectile(towerIndex) {
        const tower = this.towers[towerIndex];

        const projectile = {
            x: tower.x + Math.cos(tower.currentAngle) * tower.radius,
            y: tower.y + Math.sin(tower.currentAngle) * tower.radius,
            vx: Math.cos(tower.currentAngle) * 8,
            vy: Math.sin(tower.currentAngle) * 8,
            radius: 8,
            color: tower.color,
            owner: towerIndex,
            damage: 10
        };

        this.projectiles.push(projectile);
        this.gameHub.playSound('shoot');
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update tower angles (smooth rotation towards target)
        this.towers.forEach(tower => {
            if (tower.active && tower.hp > 0) {
                const diff = tower.targetAngle - tower.currentAngle;
                const normalized = Math.atan2(Math.sin(diff), Math.cos(diff));
                tower.currentAngle += normalized * 0.1;
            }
        });

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            proj.x += proj.vx;
            proj.y += proj.vy;

            // Remove if off screen
            if (proj.x < 0 || proj.x > this.canvas.width ||
                proj.y < 0 || proj.y > this.canvas.height) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Check collision with towers
            for (let j = 0; j < this.towers.length; j++) {
                if (j === proj.owner) continue; // Can't hit own tower

                const tower = this.towers[j];
                if (tower.hp <= 0) continue;

                const dx = proj.x - tower.x;
                const dy = proj.y - tower.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < proj.radius + tower.radius) {
                    // Hit!
                    tower.hp -= proj.damage;
                    this.createExplosion(proj.x, proj.y, proj.color);
                    this.projectiles.splice(i, 1);

                    if (tower.hp <= 0) {
                        this.createExplosion(tower.x, tower.y, tower.color);
                        this.checkGameOver();
                    }

                    this.gameHub.playSound('explosion');
                    break;
                }
            }
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].progress += 0.05;
            if (this.explosions[i].progress >= 1) {
                this.explosions.splice(i, 1);
            }
        }

        // Update score display
        const aliveTowers = this.towers.filter(t => t.hp > 0).length;
        this.gameHub.updateScore(`Башен: ${aliveTowers} | Игроков: ${this.activePlayers}`);
    }

    createExplosion(x, y, color) {
        this.explosions.push({
            x, y,
            color,
            progress: 0,
            maxRadius: 40
        });

        if (this.gameHub.particleSystem) {
            this.gameHub.particleSystem.createExplosion(x, y, color, 30);
        }
    }

    checkGameOver() {
        const aliveTowers = this.towers.filter(t => t.hp > 0);

        if (aliveTowers.length === 1) {
            // Winner!
            this.gameOver(aliveTowers[0]);
        } else if (aliveTowers.length === 0) {
            // Draw (unlikely but possible)
            this.gameOver(null);
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw battlefield background
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width / 2
        );
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw quadrant lines
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);

        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();

        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Draw projectiles
        this.projectiles.forEach(proj => {
            this.ctx.fillStyle = proj.color;
            this.ctx.shadowColor = proj.color;
            this.ctx.shadowBlur = 15;

            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;
        });

        // Draw explosions
        this.explosions.forEach(exp => {
            const radius = exp.maxRadius * exp.progress;
            const alpha = 1 - exp.progress;

            this.ctx.globalAlpha = alpha;
            this.ctx.strokeStyle = exp.color;
            this.ctx.lineWidth = 6;

            this.ctx.beginPath();
            this.ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.globalAlpha = 1;
        });

        // Draw towers
        this.towers.forEach(tower => {
            this.drawTower(tower);
        });

        // Draw instructions
        if (this.activePlayers === 0) {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 4;

            const text = '👆 КОСНИТЕСЬ УГЛОВ ЭКРАНА ДЛЯ ИГРЫ 👆';
            this.ctx.strokeText(text, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawTower(tower) {
        if (tower.hp <= 0) return; // Don't draw destroyed towers

        // Tower base
        this.ctx.fillStyle = tower.active ? tower.color : 'rgba(100, 100, 100, 0.5)';
        this.ctx.strokeStyle = tower.active ? 'white' : 'rgba(150, 150, 150, 0.5)';
        this.ctx.lineWidth = 4;

        this.ctx.beginPath();
        this.ctx.arc(tower.x, tower.y, tower.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Tower cannon
        if (tower.active) {
            const cannonLength = tower.radius * 1.5;
            const cannonEndX = tower.x + Math.cos(tower.currentAngle) * cannonLength;
            const cannonEndY = tower.y + Math.sin(tower.currentAngle) * cannonLength;

            this.ctx.strokeStyle = tower.color;
            this.ctx.lineWidth = 12;
            this.ctx.lineCap = 'round';

            this.ctx.beginPath();
            this.ctx.moveTo(tower.x, tower.y);
            this.ctx.lineTo(cannonEndX, cannonEndY);
            this.ctx.stroke();
        }

        // HP bar
        const barWidth = tower.radius * 2;
        const barHeight = 10;
        const barX = tower.x - barWidth / 2;
        const barY = tower.y - tower.radius - 20;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // HP
        const hpPercent = tower.hp / tower.maxHp;
        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffaa00' : '#ff0000';
        this.ctx.fillStyle = hpColor;
        this.ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        // Border
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Tower name
        if (tower.active) {
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = tower.color;
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;

            this.ctx.strokeText(tower.name, tower.x, barY - 10);
            this.ctx.fillText(tower.name, tower.x, barY - 10);
        }
    }

    gameOver(winner) {
        this.isRunning = false;
        if (this.shootInterval) clearInterval(this.shootInterval);

        setTimeout(() => {
            const message = winner
                ? `🏆 ПОБЕДИЛ ${winner.name.toUpperCase()}!\n\nСыграть еще раз?`
                : `🎮 НИЧЬЯ!\n\nВсе башни уничтожены!\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    resize() {
        // Update tower positions for new canvas size
        this.towerPositions = [
            { ...this.towerPositions[0], x: 100, y: 100 },
            { ...this.towerPositions[1], x: this.canvas.width - 100, y: 100 },
            { ...this.towerPositions[2], x: this.canvas.width - 100, y: this.canvas.height - 100 },
            { ...this.towerPositions[3], x: 100, y: this.canvas.height - 100 }
        ];
    }
}
