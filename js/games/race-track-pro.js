// Race Track Pro - Racing with side control panels
class RaceTrackPro {
    constructor(canvas, gameHub, playerCount) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount;

        this.isRunning = false;
        this.cars = [];
        this.controlPanels = [];

        this.playerColors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'];
        this.trackCenterX = 0;
        this.trackCenterY = 0;
        this.trackRadius = 0;

        this.raceTime = 0;
        this.raceStartTime = 0;
        this.raceDuration = 120000; // 2 minutes
        this.raceStarted = false;
        this.countdown = 3;

        this.animationFrame = null;
        this.setupPlayers();
        this.createControlPanels();
    }

    setupPlayers() {
        const angleStep = (Math.PI * 2) / this.playerCount;

        for (let i = 0; i < this.playerCount; i++) {
            const angle = angleStep * i;
            const startRadius = 300;

            const car = {
                id: i,
                x: this.canvas.width / 2 + Math.cos(angle) * startRadius,
                y: this.canvas.height / 2 + Math.sin(angle) * startRadius,
                angle: angle + Math.PI / 2,
                speed: 0,
                maxSpeed: 6,
                acceleration: 0.2,
                turnSpeed: 0.08,
                color: this.playerColors[i],
                lap: 0,
                lastCheckpoint: -1,
                width: 40,
                height: 60,
                turnDirection: 0 // -1 left, 0 none, 1 right
            };

            this.cars.push(car);
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
                this.cars[i].turnDirection = -1;
            });
            leftBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.cars[i].turnDirection = 0;
            });
            leftBtn.addEventListener('mousedown', () => this.cars[i].turnDirection = -1);
            leftBtn.addEventListener('mouseup', () => this.cars[i].turnDirection = 0);
            panel.appendChild(leftBtn);

            // Right button
            const rightBtn = document.createElement('button');
            rightBtn.className = 'control-btn right';
            rightBtn.innerHTML = '→';
            rightBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.cars[i].turnDirection = 1;
            });
            rightBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.cars[i].turnDirection = 0;
            });
            rightBtn.addEventListener('mousedown', () => this.cars[i].turnDirection = 1);
            rightBtn.addEventListener('mouseup', () => this.cars[i].turnDirection = 0);
            panel.appendChild(rightBtn);

            gameUI.appendChild(panel);
            this.controlPanels.push(panel);
        }
    }

    start() {
        this.isRunning = true;
        this.raceStarted = false;
        this.countdown = 3;

        this.trackCenterX = this.canvas.width / 2;
        this.trackCenterY = this.canvas.height / 2;
        this.trackRadius = Math.min(this.canvas.width, this.canvas.height) * 0.35;

        // Start countdown
        this.startCountdown();
    }

    startCountdown() {
        const countdownInterval = setInterval(() => {
            this.countdown--;

            if (this.countdown === 0) {
                clearInterval(countdownInterval);
                this.raceStarted = true;
                this.raceStartTime = Date.now();
                this.gameHub.playSound('start');
            } else {
                this.gameHub.playSound('beep');
            }
        }, 1000);

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

        if (this.raceStarted) {
            this.raceTime = Date.now() - this.raceStartTime;

            // Check if race time is up
            if (this.raceTime >= this.raceDuration) {
                this.endRace();
                return;
            }

            this.update();
        }

        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.cars.forEach((car, index) => {
            // Auto accelerate
            car.speed = car.maxSpeed;

            // Apply turning
            car.angle += car.turnDirection * car.turnSpeed;

            // Move car
            car.x += Math.cos(car.angle) * car.speed;
            car.y += Math.sin(car.angle) * car.speed;

            // Keep car on screen (soft boundary)
            const margin = 50;
            if (car.x < margin) car.x = margin;
            if (car.x > this.canvas.width - margin) car.x = this.canvas.width - margin;
            if (car.y < margin) car.y = margin;
            if (car.y > this.canvas.height - margin) car.y = this.canvas.height - margin;

            // Check lap completion
            this.checkLapCompletion(car);
        });

        this.updateScore();
    }

    checkLapCompletion(car) {
        // Calculate angle from track center
        const dx = car.x - this.trackCenterX;
        const dy = car.y - this.trackCenterY;
        const currentAngle = Math.atan2(dy, dx);

        // Normalize angle to 0-2π
        let normalizedAngle = currentAngle < 0 ? currentAngle + Math.PI * 2 : currentAngle;

        // Divide track into 8 checkpoints
        const checkpointIndex = Math.floor(normalizedAngle / (Math.PI / 4));

        if (checkpointIndex !== car.lastCheckpoint) {
            const expectedNext = (car.lastCheckpoint + 1) % 8;

            if (checkpointIndex === expectedNext) {
                car.lastCheckpoint = checkpointIndex;

                // Complete lap when passing checkpoint 0
                if (checkpointIndex === 0 && car.lap > 0) {
                    car.lap++;
                    this.gameHub.playSound('powerup');
                } else if (checkpointIndex === 0) {
                    car.lap = 1;
                }
            }
        }
    }

    updateScore() {
        const leader = this.cars.reduce((best, car) => {
            return car.lap > best.lap ? car : best;
        }, this.cars[0]);

        const timeLeft = Math.ceil((this.raceDuration - this.raceTime) / 1000);
        this.gameHub.updateScore(`Лидер: Игрок ${leader.id + 1} (${leader.lap} кругов) | Время: ${timeLeft}с`);
    }

    endRace() {
        this.isRunning = false;

        // Find winner
        const winner = this.cars.reduce((best, car) => {
            return car.lap > best.lap ? car : best;
        }, this.cars[0]);

        const score = winner.lap;
        ScoreManager.saveScore('race-track-pro', score);

        setTimeout(() => {
            if (confirm(`ГОНКА ЗАВЕРШЕНА!\n\nПобедитель: Игрок ${winner.id + 1}\nКругов: ${score}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('race-track-pro');
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
            this.trackCenterX, this.trackCenterY, this.trackRadius * 2
        );
        gradient.addColorStop(0, '#7cb342');
        gradient.addColorStop(1, '#558b2f');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw track
        this.drawTrack();

        // Draw cars
        this.cars.forEach(car => {
            this.drawCar(car);
        });

        // Draw countdown
        if (!this.raceStarted && this.countdown > 0) {
            this.ctx.font = 'bold 200px Arial';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 8;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            const text = this.countdown.toString();
            this.ctx.strokeText(text, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        } else if (!this.raceStarted && this.countdown === 0) {
            this.ctx.font = 'bold 120px Arial';
            this.ctx.fillStyle = '#00ff00';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 6;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            this.ctx.strokeText('ПОЕХАЛИ!', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.fillText('ПОЕХАЛИ!', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawTrack() {
        // Draw track outline (outer)
        this.ctx.strokeStyle = '#424242';
        this.ctx.lineWidth = 200;
        this.ctx.beginPath();
        this.ctx.arc(this.trackCenterX, this.trackCenterY, this.trackRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw track surface
        this.ctx.strokeStyle = '#616161';
        this.ctx.lineWidth = 180;
        this.ctx.beginPath();
        this.ctx.arc(this.trackCenterX, this.trackCenterY, this.trackRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw center line
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([20, 20]);
        this.ctx.beginPath();
        this.ctx.arc(this.trackCenterX, this.trackCenterY, this.trackRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw start/finish line
        const startX = this.trackCenterX + this.trackRadius;
        const startY = this.trackCenterY;

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 8;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY - 90);
        this.ctx.lineTo(startX, startY + 90);
        this.ctx.stroke();

        // Checkered pattern
        for (let i = 0; i < 6; i++) {
            this.ctx.fillStyle = i % 2 === 0 ? 'white' : 'black';
            this.ctx.fillRect(startX - 4, startY - 90 + (i * 30), 8, 30);
        }
    }

    drawCar(car) {
        this.ctx.save();
        this.ctx.translate(car.x, car.y);
        this.ctx.rotate(car.angle);

        // Car shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(-car.width / 2 + 5, -car.height / 2 + 5, car.width, car.height);

        // Car body
        this.ctx.fillStyle = car.color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
        this.ctx.strokeRect(-car.width / 2, -car.height / 2, car.width, car.height);

        // Windshield
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fillRect(-car.width / 3, -car.height / 3, car.width * 2 / 3, car.height / 2);

        // Lap counter
        if (car.lap > 0) {
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(car.lap.toString(), 0, 0);
            this.ctx.fillText(car.lap.toString(), 0, 0);
        }

        this.ctx.restore();

        // Player number above car
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillStyle = car.color;
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.textAlign = 'center';
        const playerText = `Игрок ${car.id + 1}`;
        this.ctx.strokeText(playerText, car.x, car.y - 50);
        this.ctx.fillText(playerText, car.x, car.y - 50);
    }

    resize() {
        this.trackCenterX = this.canvas.width / 2;
        this.trackCenterY = this.canvas.height / 2;
        this.trackRadius = Math.min(this.canvas.width, this.canvas.height) * 0.35;
    }
}
