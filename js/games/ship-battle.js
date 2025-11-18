// Ship Battle - Naval battle with side control panels
class ShipBattle {
    constructor(canvas, gameHub, playerCount) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount;

        this.isRunning = false;
        this.ships = [];
        this.cannonballs = [];
        this.waves = [];
        this.islands = [];
        this.controlPanels = [];

        this.playerColors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'];

        this.battleTime = 0;
        this.battleStartTime = 0;
        this.battleDuration = 180000; // 3 minutes

        this.animationFrame = null;
        this.waveOffset = 0;

        this.createIslands();
        this.setupPlayers();
        this.createControlPanels();
    }

    createIslands() {
        // Create obstacles (islands)
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.islands.push(
            { x: w / 2 - 100, y: h / 2 - 100, radius: 80 },
            { x: w / 4, y: h / 4, radius: 60 },
            { x: w * 3 / 4, y: h / 4, radius: 60 },
            { x: w / 4, y: h * 3 / 4, radius: 60 },
            { x: w * 3 / 4, y: h * 3 / 4, radius: 60 }
        );
    }

    setupPlayers() {
        const positions = [
            { x: 200, y: 200 },
            { x: this.canvas.width - 200, y: 200 },
            { x: this.canvas.width - 200, y: this.canvas.height - 200 },
            { x: 200, y: this.canvas.height - 200 },
            { x: this.canvas.width / 2, y: 150 },
            { x: this.canvas.width / 2, y: this.canvas.height - 150 }
        ];

        for (let i = 0; i < this.playerCount; i++) {
            const ship = {
                id: i,
                x: positions[i].x,
                y: positions[i].y,
                angle: Math.PI / 4 * (i * 2),
                cannonAngle: 0,
                speed: 0,
                maxSpeed: 3.5,
                width: 60,
                height: 40,
                color: this.playerColors[i],
                hp: 100,
                maxHp: 100,
                score: 0,
                lastShot: 0,
                shootCooldown: 800,
                turnDirection: 0,
                shooting: false,
                sinkAnimation: 0
            };

            this.ships.push(ship);
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
            label.textContent = `Капитан ${i + 1}`;
            label.style.backgroundColor = this.playerColors[i];
            panel.appendChild(label);

            // Left button
            const leftBtn = document.createElement('button');
            leftBtn.className = 'control-btn left';
            leftBtn.innerHTML = '⬅';
            leftBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.ships[i].turnDirection = -1;
            });
            leftBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.ships[i].turnDirection = 0;
            });
            leftBtn.addEventListener('mousedown', () => this.ships[i].turnDirection = -1);
            leftBtn.addEventListener('mouseup', () => this.ships[i].turnDirection = 0);
            panel.appendChild(leftBtn);

            // Right button
            const rightBtn = document.createElement('button');
            rightBtn.className = 'control-btn right';
            rightBtn.innerHTML = '➡';
            rightBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.ships[i].turnDirection = 1;
            });
            rightBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.ships[i].turnDirection = 0;
            });
            rightBtn.addEventListener('mousedown', () => this.ships[i].turnDirection = 1);
            rightBtn.addEventListener('mouseup', () => this.ships[i].turnDirection = 0);
            panel.appendChild(rightBtn);

            // Shoot button
            const shootBtn = document.createElement('button');
            shootBtn.className = 'control-btn shoot';
            shootBtn.innerHTML = '💣';
            shootBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.ships[i].shooting = true;
            });
            shootBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.ships[i].shooting = false;
            });
            shootBtn.addEventListener('mousedown', () => this.ships[i].shooting = true);
            shootBtn.addEventListener('mouseup', () => this.ships[i].shooting = false);
            panel.appendChild(shootBtn);

            gameUI.appendChild(panel);
            this.controlPanels.push(panel);
        }
    }

    start() {
        this.isRunning = true;
        this.battleStartTime = Date.now();
        this.gameHub.updateScore('Морской бой!');
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
        this.waveOffset += 0.5;

        this.ships.forEach((ship, index) => {
            if (ship.hp <= 0) {
                ship.sinkAnimation += 0.02;
                if (ship.sinkAnimation >= 1) {
                    // Respawn
                    this.respawnShip(ship);
                }
                return;
            }

            // Apply turning
            ship.angle += ship.turnDirection * 0.04;

            // Auto move forward
            ship.speed = ship.maxSpeed;
            const newX = ship.x + Math.cos(ship.angle) * ship.speed;
            const newY = ship.y + Math.sin(ship.angle) * ship.speed;

            // Check collision with islands
            let collision = false;
            for (let island of this.islands) {
                const dx = newX - island.x;
                const dy = newY - island.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < island.radius + ship.width / 2) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                ship.x = newX;
                ship.y = newY;
            }

            // Keep on screen
            const margin = ship.width / 2;
            if (ship.x < margin) ship.x = margin;
            if (ship.x > this.canvas.width - margin) ship.x = this.canvas.width - margin;
            if (ship.y < margin) ship.y = margin;
            if (ship.y > this.canvas.height - margin) ship.y = this.canvas.height - margin;

            // Auto-aim at nearest enemy
            this.autoAim(ship);

            // Shooting
            if (ship.shooting && Date.now() - ship.lastShot > ship.shootCooldown) {
                this.shoot(ship);
                ship.lastShot = Date.now();
            }
        });

        // Update cannonballs
        for (let i = this.cannonballs.length - 1; i >= 0; i--) {
            const ball = this.cannonballs[i];

            ball.x += Math.cos(ball.angle) * ball.speed;
            ball.y += Math.sin(ball.angle) * ball.speed;
            ball.life--;

            // Remove if lifetime expired or off screen
            if (ball.life <= 0 ||
                ball.x < 0 || ball.x > this.canvas.width ||
                ball.y < 0 || ball.y > this.canvas.height) {
                this.cannonballs.splice(i, 1);
                continue;
            }

            // Check island collision
            for (let island of this.islands) {
                const dx = ball.x - island.x;
                const dy = ball.y - island.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < island.radius) {
                    this.cannonballs.splice(i, 1);
                    break;
                }
            }

            // Check ship collision
            for (let j = 0; j < this.ships.length; j++) {
                const ship = this.ships[j];
                if (ship.id === ball.owner || ship.hp <= 0) continue;

                const dx = ball.x - ship.x;
                const dy = ball.y - ship.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ship.width / 2) {
                    ship.hp -= 25;
                    this.cannonballs.splice(i, 1);

                    if (ship.hp <= 0) {
                        // Ship destroyed
                        const shooter = this.ships.find(s => s.id === ball.owner);
                        if (shooter) shooter.score++;

                        this.gameHub.playSound('hit');

                        if (this.gameHub.particleSystem) {
                            this.gameHub.particleSystem.createExplosion(
                                ship.x, ship.y, ship.color, 50
                            );
                        }
                    }

                    break;
                }
            }
        }

        this.updateScore();
    }

    autoAim(ship) {
        let nearestEnemy = null;
        let nearestDistance = Infinity;

        this.ships.forEach(other => {
            if (other.id === ship.id || other.hp <= 0) return;

            const dx = other.x - ship.x;
            const dy = other.y - ship.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = other;
            }
        });

        if (nearestEnemy) {
            const dx = nearestEnemy.x - ship.x;
            const dy = nearestEnemy.y - ship.y;
            ship.cannonAngle = Math.atan2(dy, dx);
        }
    }

    shoot(ship) {
        const ball = {
            x: ship.x + Math.cos(ship.cannonAngle) * 35,
            y: ship.y + Math.sin(ship.cannonAngle) * 35,
            angle: ship.cannonAngle,
            speed: 8,
            owner: ship.id,
            color: ship.color,
            life: 120
        };

        this.cannonballs.push(ball);
        this.gameHub.playSound('shoot');
    }

    respawnShip(ship) {
        ship.hp = ship.maxHp;
        ship.sinkAnimation = 0;

        // Random respawn position
        const positions = [
            { x: 200, y: 200 },
            { x: this.canvas.width - 200, y: 200 },
            { x: this.canvas.width - 200, y: this.canvas.height - 200 },
            { x: 200, y: this.canvas.height - 200 },
            { x: this.canvas.width / 2, y: 150 },
            { x: this.canvas.width / 2, y: this.canvas.height - 150 }
        ];

        const pos = positions[Math.floor(Math.random() * positions.length)];
        ship.x = pos.x;
        ship.y = pos.y;

        this.gameHub.playSound('powerup');
    }

    updateScore() {
        const totalSinks = this.ships.reduce((sum, s) => sum + s.score, 0);
        const timeLeft = Math.ceil((this.battleDuration - this.battleTime) / 1000);
        this.gameHub.updateScore(`${totalSinks} потоплено | Время: ${timeLeft}с`);
    }

    endBattle() {
        this.isRunning = false;

        // Find winner
        const winner = this.ships.reduce((best, ship) => {
            return ship.score > best.score ? ship : best;
        }, this.ships[0]);

        const score = winner.score;
        ScoreManager.saveScore('ship-battle', score);

        setTimeout(() => {
            if (confirm(`БИТВА ЗАВЕРШЕНА!\n\nПобедитель: Капитан ${winner.id + 1}\nПотоплено: ${score}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('ship-battle');
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ocean background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1e3a5f');
        gradient.addColorStop(1, '#2c5f8d');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw waves
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;

        for (let y = 0; y < this.canvas.height; y += 40) {
            this.ctx.beginPath();
            for (let x = 0; x < this.canvas.width; x += 20) {
                const waveY = y + Math.sin((x + this.waveOffset) / 30) * 10;
                if (x === 0) this.ctx.moveTo(x, waveY);
                else this.ctx.lineTo(x, waveY);
            }
            this.ctx.stroke();
        }

        // Draw islands
        this.islands.forEach(island => {
            // Island shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.ellipse(island.x + 5, island.y + 5, island.radius, island.radius * 0.6, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Island
            this.ctx.fillStyle = '#8d6e63';
            this.ctx.strokeStyle = '#5d4037';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(island.x, island.y, island.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Palm tree
            this.ctx.font = `${island.radius * 0.8}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🌴', island.x, island.y);
        });

        // Draw cannonballs
        this.cannonballs.forEach(ball => {
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.strokeStyle = ball.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });

        // Draw ships
        this.ships.forEach(ship => {
            this.drawShip(ship);
        });
    }

    drawShip(ship) {
        if (ship.hp <= 0) {
            // Sinking animation
            this.ctx.save();
            this.ctx.translate(ship.x, ship.y);
            this.ctx.rotate(ship.angle + ship.sinkAnimation * Math.PI);
            this.ctx.globalAlpha = 1 - ship.sinkAnimation;

            // Ship hull
            this.ctx.fillStyle = ship.color;
            this.ctx.fillRect(-ship.width / 2, -ship.height / 2, ship.width, ship.height);

            this.ctx.restore();
            return;
        }

        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.angle);

        // Ship shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(-ship.width / 2 + 3, -ship.height / 2 + 3, ship.width, ship.height);

        // Ship hull
        this.ctx.fillStyle = ship.color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(-ship.width / 2, -ship.height / 2, ship.width, ship.height);
        this.ctx.strokeRect(-ship.width / 2, -ship.height / 2, ship.width, ship.height);

        // Sail
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -ship.height / 2);
        this.ctx.lineTo(15, -ship.height / 2 + 10);
        this.ctx.lineTo(15, ship.height / 2 - 10);
        this.ctx.lineTo(0, ship.height / 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.restore();

        // Cannon direction indicator
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.cannonAngle);

        this.ctx.strokeStyle = ship.color;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(50, 0);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.restore();

        // HP bar
        const barWidth = 70;
        const barHeight = 8;
        const barX = ship.x - barWidth / 2;
        const barY = ship.y - ship.height / 2 - 20;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpPercent = ship.hp / ship.maxHp;
        this.ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        this.ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Player number
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'center';
        this.ctx.strokeText(`⚓${ship.id + 1}`, ship.x, ship.y);
        this.ctx.fillText(`⚓${ship.id + 1}`, ship.x, ship.y);

        // Score
        if (ship.score > 0) {
            this.ctx.font = 'bold 18px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(`⭐${ship.score}`, ship.x, ship.y + ship.height / 2 + 25);
            this.ctx.fillText(`⭐${ship.score}`, ship.x, ship.y + ship.height / 2 + 25);
        }
    }

    resize() {
        // Recreate islands on resize
        this.islands = [];
        this.createIslands();
    }
}
