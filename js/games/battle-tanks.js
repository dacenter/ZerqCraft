// Battle Tanks - Tank battle with side control panels
class BattleTanks {
    constructor(canvas, gameHub, playerCount) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount;

        this.isRunning = false;
        this.tanks = [];
        this.bullets = [];
        this.obstacles = [];
        this.controlPanels = [];

        this.playerColors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'];

        this.battleTime = 0;
        this.battleStartTime = 0;
        this.battleDuration = 180000; // 3 minutes

        this.animationFrame = null;
        this.createObstacles();
        this.setupPlayers();
        this.createControlPanels();
    }

    createObstacles() {
        // Create walls and obstacles
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Center obstacles
        this.obstacles.push(
            { x: w / 2 - 100, y: h / 2 - 100, width: 200, height: 40 },
            { x: w / 2 - 100, y: h / 2 + 60, width: 200, height: 40 },
            { x: w / 2 - 20, y: h / 2 - 60, width: 40, height: 120 },

            // Corner obstacles
            { x: 200, y: 200, width: 150, height: 30 },
            { x: w - 350, y: 200, width: 150, height: 30 },
            { x: 200, y: h - 230, width: 150, height: 30 },
            { x: w - 350, y: h - 230, width: 150, height: 30 }
        );
    }

    setupPlayers() {
        const positions = [
            { x: 150, y: 150 },
            { x: this.canvas.width - 150, y: 150 },
            { x: this.canvas.width - 150, y: this.canvas.height - 150 },
            { x: 150, y: this.canvas.height - 150 },
            { x: this.canvas.width / 2, y: 150 },
            { x: this.canvas.width / 2, y: this.canvas.height - 150 }
        ];

        for (let i = 0; i < this.playerCount; i++) {
            const tank = {
                id: i,
                x: positions[i].x,
                y: positions[i].y,
                angle: Math.PI / 4 * (i * 2),
                turretAngle: 0,
                speed: 0,
                maxSpeed: 3,
                width: 50,
                height: 50,
                color: this.playerColors[i],
                hp: 100,
                maxHp: 100,
                score: 0,
                lastShot: 0,
                shootCooldown: 500,
                turnDirection: 0, // -1 left, 0 none, 1 right
                shooting: false
            };

            this.tanks.push(tank);
        }
    }

    createControlPanels() {
        const gameUI = document.getElementById('game-ui');
        gameUI.innerHTML = '';

        const panelWidth = 120;
        const spacing = (this.canvas.width - panelWidth * this.playerCount) / (this.playerCount + 1);

        for (let i = 0; i < this.playerCount; i++) {
            const panel = document.createElement('div');
            panel.className = 'control-panel';
            panel.style.left = `${spacing + i * (panelWidth + spacing)}px`;
            panel.style.bottom = '20px';

            // Player label
            const label = document.createElement('div');
            label.className = 'player-label-tag';
            label.textContent = `Игрок ${i + 1}`;
            label.style.backgroundColor = this.playerColors[i];
            panel.appendChild(label);

            // Left button
            const leftBtn = document.createElement('button');
            leftBtn.className = 'control-btn left';
            leftBtn.innerHTML = '←';
            leftBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.tanks[i].turnDirection = -1;
            });
            leftBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.tanks[i].turnDirection = 0;
            });
            leftBtn.addEventListener('mousedown', () => this.tanks[i].turnDirection = -1);
            leftBtn.addEventListener('mouseup', () => this.tanks[i].turnDirection = 0);
            panel.appendChild(leftBtn);

            // Right button
            const rightBtn = document.createElement('button');
            rightBtn.className = 'control-btn right';
            rightBtn.innerHTML = '→';
            rightBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.tanks[i].turnDirection = 1;
            });
            rightBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.tanks[i].turnDirection = 0;
            });
            rightBtn.addEventListener('mousedown', () => this.tanks[i].turnDirection = 1);
            rightBtn.addEventListener('mouseup', () => this.tanks[i].turnDirection = 0);
            panel.appendChild(rightBtn);

            // Shoot button
            const shootBtn = document.createElement('button');
            shootBtn.className = 'control-btn shoot';
            shootBtn.innerHTML = '💥';
            shootBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.tanks[i].shooting = true;
            });
            shootBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.tanks[i].shooting = false;
            });
            shootBtn.addEventListener('mousedown', () => this.tanks[i].shooting = true);
            shootBtn.addEventListener('mouseup', () => this.tanks[i].shooting = false);
            panel.appendChild(shootBtn);

            gameUI.appendChild(panel);
            this.controlPanels.push(panel);
        }
    }

    start() {
        this.isRunning = true;
        this.battleStartTime = Date.now();
        this.gameHub.updateScore('0 убийств');
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

        // Clean up control panels
        const gameUI = document.getElementById('game-ui');
        gameUI.innerHTML = '';
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.battleTime = Date.now() - this.battleStartTime;

        // Check if battle time is up
        if (this.battleTime >= this.battleDuration) {
            this.endBattle();
            return;
        }

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.tanks.forEach((tank, index) => {
            if (tank.hp <= 0) return;

            // Apply turning
            tank.angle += tank.turnDirection * 0.05;

            // Auto move forward
            tank.speed = tank.maxSpeed;
            const newX = tank.x + Math.cos(tank.angle) * tank.speed;
            const newY = tank.y + Math.sin(tank.angle) * tank.speed;

            // Check collision with obstacles
            if (!this.checkObstacleCollision(newX, newY, tank.width, tank.height)) {
                tank.x = newX;
                tank.y = newY;
            }

            // Keep on screen
            const margin = tank.width / 2;
            if (tank.x < margin) tank.x = margin;
            if (tank.x > this.canvas.width - margin) tank.x = this.canvas.width - margin;
            if (tank.y < margin) tank.y = margin;
            if (tank.y > this.canvas.height - margin) tank.y = this.canvas.height - margin;

            // Auto-aim at nearest enemy
            this.autoAim(tank);

            // Shooting
            if (tank.shooting && Date.now() - tank.lastShot > tank.shootCooldown) {
                this.shoot(tank);
                tank.lastShot = Date.now();
            }
        });

        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            bullet.x += Math.cos(bullet.angle) * bullet.speed;
            bullet.y += Math.sin(bullet.angle) * bullet.speed;

            // Remove if off screen
            if (bullet.x < 0 || bullet.x > this.canvas.width ||
                bullet.y < 0 || bullet.y > this.canvas.height) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Check obstacle collision
            if (this.checkObstacleCollision(bullet.x, bullet.y, 10, 10)) {
                this.bullets.splice(i, 1);
                continue;
            }

            // Check tank collision
            for (let j = 0; j < this.tanks.length; j++) {
                const tank = this.tanks[j];
                if (tank.id === bullet.owner || tank.hp <= 0) continue;

                const dx = bullet.x - tank.x;
                const dy = bullet.y - tank.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < tank.width / 2) {
                    tank.hp -= 20;
                    this.bullets.splice(i, 1);

                    if (tank.hp <= 0) {
                        // Tank destroyed
                        const shooter = this.tanks.find(t => t.id === bullet.owner);
                        if (shooter) shooter.score++;

                        this.gameHub.playSound('hit');

                        if (this.gameHub.particleSystem) {
                            this.gameHub.particleSystem.createExplosion(
                                tank.x, tank.y, tank.color, 50
                            );
                        }

                        // Respawn after delay
                        setTimeout(() => {
                            this.respawnTank(tank);
                        }, 3000);
                    }

                    break;
                }
            }
        }

        this.updateScore();
    }

    autoAim(tank) {
        let nearestEnemy = null;
        let nearestDistance = Infinity;

        this.tanks.forEach(other => {
            if (other.id === tank.id || other.hp <= 0) return;

            const dx = other.x - tank.x;
            const dy = other.y - tank.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = other;
            }
        });

        if (nearestEnemy) {
            const dx = nearestEnemy.x - tank.x;
            const dy = nearestEnemy.y - tank.y;
            tank.turretAngle = Math.atan2(dy, dx);
        }
    }

    shoot(tank) {
        const bullet = {
            x: tank.x + Math.cos(tank.turretAngle) * 30,
            y: tank.y + Math.sin(tank.turretAngle) * 30,
            angle: tank.turretAngle,
            speed: 10,
            owner: tank.id,
            color: tank.color
        };

        this.bullets.push(bullet);
        this.gameHub.playSound('shoot');
    }

    checkObstacleCollision(x, y, width, height) {
        for (let obstacle of this.obstacles) {
            if (x - width / 2 < obstacle.x + obstacle.width &&
                x + width / 2 > obstacle.x &&
                y - height / 2 < obstacle.y + obstacle.height &&
                y + height / 2 > obstacle.y) {
                return true;
            }
        }
        return false;
    }

    respawnTank(tank) {
        tank.hp = tank.maxHp;

        // Random respawn position
        const positions = [
            { x: 150, y: 150 },
            { x: this.canvas.width - 150, y: 150 },
            { x: this.canvas.width - 150, y: this.canvas.height - 150 },
            { x: 150, y: this.canvas.height - 150 },
            { x: this.canvas.width / 2, y: 150 },
            { x: this.canvas.width / 2, y: this.canvas.height - 150 }
        ];

        const pos = positions[Math.floor(Math.random() * positions.length)];
        tank.x = pos.x;
        tank.y = pos.y;

        this.gameHub.playSound('powerup');
    }

    updateScore() {
        const totalKills = this.tanks.reduce((sum, t) => sum + t.score, 0);
        const timeLeft = Math.ceil((this.battleDuration - this.battleTime) / 1000);
        this.gameHub.updateScore(`${totalKills} убийств | Время: ${timeLeft}с`);
    }

    endBattle() {
        this.isRunning = false;

        // Find winner
        const winner = this.tanks.reduce((best, tank) => {
            return tank.score > best.score ? tank : best;
        }, this.tanks[0]);

        const score = winner.score;
        ScoreManager.saveScore('battle-tanks', score);

        setTimeout(() => {
            if (confirm(`БИТВА ЗАВЕРШЕНА!\n\nПобедитель: Игрок ${winner.id + 1}\nУбийств: ${score}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('battle-tanks');
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#8b7355');
        gradient.addColorStop(1, '#6d5a3d');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw obstacles
        this.ctx.fillStyle = '#3e2723';
        this.ctx.strokeStyle = '#5d4037';
        this.ctx.lineWidth = 3;
        this.obstacles.forEach(obs => {
            this.ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            this.ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        });

        // Draw bullets
        this.bullets.forEach(bullet => {
            this.ctx.fillStyle = bullet.color;
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });

        // Draw tanks
        this.tanks.forEach(tank => {
            if (tank.hp > 0) {
                this.drawTank(tank);
            }
        });
    }

    drawTank(tank) {
        this.ctx.save();
        this.ctx.translate(tank.x, tank.y);

        // Tank body
        this.ctx.rotate(tank.angle);
        this.ctx.fillStyle = tank.color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(-tank.width / 2, -tank.height / 2, tank.width, tank.height);
        this.ctx.strokeRect(-tank.width / 2, -tank.height / 2, tank.width, tank.height);

        this.ctx.restore();

        // Turret
        this.ctx.save();
        this.ctx.translate(tank.x, tank.y);
        this.ctx.rotate(tank.turretAngle);

        this.ctx.fillStyle = tank.color;
        this.ctx.fillRect(0, -8, 30, 16);

        this.ctx.restore();

        // HP bar
        const barWidth = 60;
        const barHeight = 8;
        const barX = tank.x - barWidth / 2;
        const barY = tank.y - tank.height / 2 - 20;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpPercent = tank.hp / tank.maxHp;
        this.ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        this.ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Player number
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'center';
        this.ctx.strokeText(`P${tank.id + 1}`, tank.x, tank.y);
        this.ctx.fillText(`P${tank.id + 1}`, tank.x, tank.y);

        // Score
        if (tank.score > 0) {
            this.ctx.font = 'bold 18px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(`⭐${tank.score}`, tank.x, tank.y + tank.height / 2 + 25);
            this.ctx.fillText(`⭐${tank.score}`, tank.x, tank.y + tank.height / 2 + 25);
        }
    }

    resize() {
        // Recreate obstacles on resize
        this.obstacles = [];
        this.createObstacles();
    }
}
