// Racing Madness - Multiplayer top-down racing
class RacingMadness {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.cars = [];
        this.checkpoints = [];
        this.obstacles = [];
        this.powerups = [];

        this.carColors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00'];
        this.trackPath = [];

        this.raceTime = 0;
        this.raceStartTime = 0;
        this.raceDuration = 120000; // 2 minutes

        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
        this.createTrack();
    }

    createTrack() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Create oval racing track
        this.trackCenterX = w / 2;
        this.trackCenterY = h / 2;
        this.trackRadiusX = w * 0.35;
        this.trackRadiusY = h * 0.35;
        this.trackWidth = 200;

        // Create checkpoints around the track
        const numCheckpoints = 8;
        for (let i = 0; i < numCheckpoints; i++) {
            const angle = (Math.PI * 2 * i) / numCheckpoints;
            this.checkpoints.push({
                angle: angle,
                x: this.trackCenterX + Math.cos(angle) * this.trackRadiusX,
                y: this.trackCenterY + Math.sin(angle) * this.trackRadiusY,
                width: this.trackWidth,
                passed: []
            });
        }

        // Create obstacles
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = this.trackRadiusX * 0.8;
            this.obstacles.push({
                x: this.trackCenterX + Math.cos(angle) * distance,
                y: this.trackCenterY + Math.sin(angle) * distance,
                radius: 15
            });
        }

        // Create speed boost positions
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
            const distance = this.trackRadiusX * 0.9;
            this.powerups.push({
                x: this.trackCenterX + Math.cos(angle) * distance,
                y: this.trackCenterY + Math.sin(angle) * distance,
                type: 'boost',
                radius: 20,
                active: true,
                respawnTime: 0
            });
        }
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            // Create new car for this touch
            const car = {
                id: touch.id,
                x: this.trackCenterX,
                y: this.trackCenterY - this.trackRadiusY + 50,
                targetX: touch.x,
                targetY: touch.y,
                vx: 0,
                vy: 0,
                speed: 0,
                maxSpeed: 8,
                angle: Math.PI / 2,
                width: 40,
                height: 60,
                color: this.carColors[this.cars.length % this.carColors.length],
                lap: 0,
                lastCheckpoint: -1,
                boostTime: 0,
                stunTime: 0
            };

            this.cars.push(car);
            this.updateScore();
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            const car = this.cars.find(c => c.id === touch.id);
            if (car) {
                car.targetX = touch.x;
                car.targetY = touch.y;
            }
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            const index = this.cars.findIndex(c => c.id === touch.id);
            if (index !== -1) {
                this.cars.splice(index, 1);
                this.updateScore();
            }
        });
    }

    start() {
        this.isRunning = true;
        this.cars = [];
        this.raceStartTime = Date.now();
        this.raceTime = 0;

        // Reset checkpoints
        this.checkpoints.forEach(cp => cp.passed = []);

        this.gameHub.updateScore('0 кругов');
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.raceTime = Date.now() - this.raceStartTime;

        // Check if race time is up
        if (this.raceTime >= this.raceDuration) {
            this.endRace();
            return;
        }

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.cars.forEach(car => {
            // Update stun and boost timers
            if (car.stunTime > 0) {
                car.stunTime -= 16;
                return; // Skip movement if stunned
            }

            if (car.boostTime > 0) {
                car.boostTime -= 16;
            }

            // Calculate direction to target
            const dx = car.targetX - car.x;
            const dy = car.targetY - car.y;
            const targetAngle = Math.atan2(dy, dx);

            // Smooth angle transition
            let angleDiff = targetAngle - car.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            car.angle += angleDiff * 0.1;

            // Auto-accelerate
            const baseSpeed = car.boostTime > 0 ? car.maxSpeed * 1.5 : car.maxSpeed;
            car.speed = baseSpeed * 0.9; // Always moving

            // Apply velocity
            car.vx = Math.cos(car.angle) * car.speed;
            car.vy = Math.sin(car.angle) * car.speed;

            car.x += car.vx;
            car.y += car.vy;

            // Keep car on screen (soft boundary)
            const margin = 50;
            if (car.x < margin) car.x = margin;
            if (car.x > this.canvas.width - margin) car.x = this.canvas.width - margin;
            if (car.y < margin) car.y = margin;
            if (car.y > this.canvas.height - margin) car.y = this.canvas.height - margin;

            // Check checkpoint collision
            this.checkCheckpointCollision(car);

            // Check obstacle collision
            this.checkObstacleCollision(car);

            // Check powerup collision
            this.checkPowerupCollision(car);
        });

        // Respawn powerups
        this.powerups.forEach(powerup => {
            if (!powerup.active) {
                powerup.respawnTime -= 16;
                if (powerup.respawnTime <= 0) {
                    powerup.active = true;
                }
            }
        });
    }

    checkCheckpointCollision(car) {
        this.checkpoints.forEach((checkpoint, index) => {
            const dx = car.x - checkpoint.x;
            const dy = car.y - checkpoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < checkpoint.width / 2) {
                // Check if this is the next checkpoint in sequence
                const expectedNext = (car.lastCheckpoint + 1) % this.checkpoints.length;

                if (index === expectedNext) {
                    car.lastCheckpoint = index;

                    // Check if completed a lap
                    if (index === 0 && car.lap > 0) {
                        car.lap++;
                        this.gameHub.playSound('powerup');
                        this.updateScore();
                    } else if (index === 0) {
                        car.lap = 1;
                    }
                }
            }
        });
    }

    checkObstacleCollision(car) {
        this.obstacles.forEach(obstacle => {
            const dx = car.x - obstacle.x;
            const dy = car.y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < obstacle.radius + car.width / 2) {
                // Collision - stun the car
                car.stunTime = 500;
                car.speed = 0;

                // Push away from obstacle
                const pushAngle = Math.atan2(dy, dx);
                car.x += Math.cos(pushAngle) * 10;
                car.y += Math.sin(pushAngle) * 10;

                this.gameHub.playSound('hit');

                if (navigator.vibrate && this.gameHub.settings.vibration) {
                    navigator.vibrate(50);
                }
            }
        });
    }

    checkPowerupCollision(car) {
        this.powerups.forEach(powerup => {
            if (!powerup.active) return;

            const dx = car.x - powerup.x;
            const dy = car.y - powerup.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < powerup.radius + car.width / 2) {
                // Collect powerup
                powerup.active = false;
                powerup.respawnTime = 5000;

                if (powerup.type === 'boost') {
                    car.boostTime = 2000;
                    this.gameHub.playSound('powerup');

                    if (this.gameHub.particleSystem) {
                        this.gameHub.particleSystem.createExplosion(
                            powerup.x,
                            powerup.y,
                            '#ffd700',
                            30
                        );
                    }
                }
            }
        });
    }

    updateScore() {
        const maxLaps = Math.max(...this.cars.map(c => c.lap), 0);
        const timeLeft = Math.ceil((this.raceDuration - this.raceTime) / 1000);
        this.gameHub.updateScore(`Лучший: ${maxLaps} кругов | Время: ${timeLeft}с | Гонщиков: ${this.cars.length}`);
    }

    endRace() {
        this.isRunning = false;

        // Find winner
        const winner = this.cars.reduce((best, car) => {
            if (!best || car.lap > best.lap) return car;
            return best;
        }, null);

        const score = winner ? winner.lap : 0;
        ScoreManager.saveScore('racing-madness', score);

        setTimeout(() => {
            if (confirm(`ГОНКА ЗАВЕРШЕНА!\n\nПобедитель: ${score} кругов\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grass background
        const gradient = this.ctx.createRadialGradient(
            this.trackCenterX, this.trackCenterY, 0,
            this.trackCenterX, this.trackCenterY, this.trackRadiusX * 1.5
        );
        gradient.addColorStop(0, '#7cb342');
        gradient.addColorStop(1, '#558b2f');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw track
        this.drawTrack();

        // Draw obstacles
        this.obstacles.forEach(obstacle => {
            this.ctx.fillStyle = '#795548';
            this.ctx.strokeStyle = '#5d4037';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });

        // Draw powerups
        this.powerups.forEach(powerup => {
            if (powerup.active) {
                this.ctx.save();
                this.ctx.translate(powerup.x, powerup.y);
                this.ctx.rotate(Date.now() / 200);

                this.ctx.fillStyle = '#ffd700';
                this.ctx.strokeStyle = '#ff6f00';
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = '#ffd700';
                this.ctx.shadowBlur = 20;

                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * powerup.radius;
                    const y = Math.sin(angle) * powerup.radius;
                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();

                this.ctx.shadowBlur = 0;
                this.ctx.restore();
            }
        });

        // Draw cars
        this.cars.forEach(car => {
            this.drawCar(car);
        });

        // Draw checkpoints (debug)
        this.checkpoints.forEach((checkpoint, index) => {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(checkpoint.x, checkpoint.y, checkpoint.width / 2, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        });

        // Draw instructions
        if (this.cars.length === 0) {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 4;

            const text = '👆 КОСНИТЕСЬ И ДВИГАЙТЕ ПАЛЬЦЫ ДЛЯ ГОНКИ 👆';
            this.ctx.strokeText(text, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawTrack() {
        // Draw track outline (outer)
        this.ctx.strokeStyle = '#424242';
        this.ctx.lineWidth = this.trackWidth + 20;
        this.ctx.beginPath();
        this.ctx.ellipse(
            this.trackCenterX,
            this.trackCenterY,
            this.trackRadiusX,
            this.trackRadiusY,
            0, 0, Math.PI * 2
        );
        this.ctx.stroke();

        // Draw track surface
        this.ctx.strokeStyle = '#616161';
        this.ctx.lineWidth = this.trackWidth;
        this.ctx.beginPath();
        this.ctx.ellipse(
            this.trackCenterX,
            this.trackCenterY,
            this.trackRadiusX,
            this.trackRadiusY,
            0, 0, Math.PI * 2
        );
        this.ctx.stroke();

        // Draw center line
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([20, 20]);
        this.ctx.beginPath();
        this.ctx.ellipse(
            this.trackCenterX,
            this.trackCenterY,
            this.trackRadiusX,
            this.trackRadiusY,
            0, 0, Math.PI * 2
        );
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw start/finish line
        const startAngle = -Math.PI / 2;
        const startX = this.trackCenterX + Math.cos(startAngle) * this.trackRadiusX;
        const startY = this.trackCenterY + Math.sin(startAngle) * this.trackRadiusY;

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(startX - this.trackWidth / 2, startY);
        this.ctx.lineTo(startX + this.trackWidth / 2, startY);
        this.ctx.stroke();

        // Checkered pattern
        for (let i = 0; i < 6; i++) {
            this.ctx.fillStyle = i % 2 === 0 ? 'white' : 'black';
            this.ctx.fillRect(
                startX - this.trackWidth / 2 + (i * this.trackWidth / 6),
                startY - 4,
                this.trackWidth / 6,
                8
            );
        }
    }

    drawCar(car) {
        this.ctx.save();
        this.ctx.translate(car.x, car.y);
        this.ctx.rotate(car.angle);

        // Stun effect
        if (car.stunTime > 0) {
            this.ctx.globalAlpha = 0.5;
        }

        // Boost effect
        if (car.boostTime > 0) {
            this.ctx.shadowColor = car.color;
            this.ctx.shadowBlur = 20;

            // Boost trail
            for (let i = 0; i < 3; i++) {
                this.ctx.fillStyle = car.color;
                this.ctx.globalAlpha = 0.3 - i * 0.1;
                this.ctx.fillRect(-car.width / 2, -car.height / 2 - i * 15, car.width, car.height);
            }
            this.ctx.globalAlpha = 1;
        }

        // Car body
        this.ctx.fillStyle = car.color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;

        // Main body
        this.ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
        this.ctx.strokeRect(-car.width / 2, -car.height / 2, car.width, car.height);

        // Windshield
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillRect(-car.width / 3, -car.height / 4, car.width * 2 / 3, car.height / 3);

        this.ctx.shadowBlur = 0;

        // Lap counter
        if (car.lap > 0) {
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(car.lap.toString(), 0, 0);
            this.ctx.fillText(car.lap.toString(), 0, 0);
        }

        this.ctx.restore();
    }

    resize() {
        // Recreate track on resize
        this.createTrack();
    }
}
