// Whack-a-Mole - Fast reaction game
class WhackAMole {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.score = 0;
        this.timeLeft = 60; // 60 seconds game

        // Game grid
        this.rows = 3;
        this.cols = 4;
        this.holes = [];

        this.holeRadius = 0;
        this.moleEmoji = '🦫'; // Beaver (крот)
        this.hammerEmoji = '🔨';

        this.spawnInterval = null;
        this.timerInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();

        this.activeHammers = []; // For visual feedback
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            this.handleHit(touch.x, touch.y, touch.id);
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            // Remove hammer
            this.activeHammers = this.activeHammers.filter(h => h.id !== touch.id);
        });
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.timeLeft = 60;
        this.activeHammers = [];

        this.calculateLayout();
        this.initializeHoles();

        this.gameHub.updateScore(this.score);

        // Spawn moles
        this.spawnInterval = setInterval(() => {
            this.spawnMole();
        }, 800);

        // Game timer
        this.timerInterval = setInterval(() => {
            this.timeLeft--;

            if (this.timeLeft <= 0) {
                this.gameOver();
            }
        }, 1000);

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    calculateLayout() {
        const gridWidth = this.canvas.width * 0.9;
        const gridHeight = this.canvas.height * 0.7;

        const cellWidth = gridWidth / this.cols;
        const cellHeight = gridHeight / this.rows;

        this.holeRadius = Math.min(cellWidth, cellHeight) / 3;
    }

    initializeHoles() {
        this.holes = [];

        const startX = this.canvas.width * 0.05;
        const startY = this.canvas.height * 0.15;

        const cellWidth = (this.canvas.width * 0.9) / this.cols;
        const cellHeight = (this.canvas.height * 0.7) / this.rows;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.holes.push({
                    x: startX + col * cellWidth + cellWidth / 2,
                    y: startY + row * cellHeight + cellHeight / 2,
                    moleActive: false,
                    moleProgress: 0, // 0 = hidden, 1 = fully visible
                    moleDirection: 0, // 1 = appearing, -1 = disappearing
                    moleType: 'normal' // 'normal' or 'golden'
                });
            }
        }
    }

    spawnMole() {
        // Find available holes
        const availableHoles = this.holes.filter(h => !h.moleActive);

        if (availableHoles.length === 0) return;

        // Spawn 1-3 moles
        const spawnCount = Math.min(
            Math.floor(Math.random() * 3) + 1,
            availableHoles.length
        );

        for (let i = 0; i < spawnCount; i++) {
            const hole = availableHoles[Math.floor(Math.random() * availableHoles.length)];

            hole.moleActive = true;
            hole.moleDirection = 1;
            hole.moleType = Math.random() < 0.15 ? 'golden' : 'normal';

            // Auto-hide after delay
            setTimeout(() => {
                if (hole.moleActive) {
                    hole.moleDirection = -1;
                }
            }, 1500);

            // Remove index from available
            availableHoles.splice(availableHoles.indexOf(hole), 1);
        }
    }

    handleHit(x, y, touchId) {
        // Add hammer visual
        this.activeHammers.push({
            id: touchId,
            x,
            y,
            rotation: Math.random() * Math.PI * 2,
            scale: 1
        });

        // Check if hit a mole
        let hitMole = false;

        this.holes.forEach(hole => {
            if (!hole.moleActive || hole.moleProgress < 0.5) return;

            const dx = x - hole.x;
            const dy = y - hole.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.holeRadius * 1.5) {
                // Hit!
                hitMole = true;
                hole.moleActive = false;
                hole.moleDirection = -1;

                const points = hole.moleType === 'golden' ? 50 : 10;
                this.score += points;
                this.gameHub.updateScore(this.score);

                // Visual feedback
                if (this.gameHub.particleSystem) {
                    const color = hole.moleType === 'golden' ? '#ffd700' : '#4ecdc4';
                    this.gameHub.particleSystem.createExplosion(hole.x, hole.y, color, 30);

                    this.gameHub.particleSystem.createComboText(
                        hole.x - 50,
                        hole.y - 100,
                        `+${points}`
                    );
                }

                this.gameHub.playSound('whack');

                if (navigator.vibrate && this.gameHub.settings.vibration) {
                    navigator.vibrate(30);
                }
            }
        });

        if (!hitMole) {
            // Missed - slight penalty
            this.gameHub.playSound('miss');
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update mole animations
        this.holes.forEach(hole => {
            if (hole.moleDirection !== 0) {
                hole.moleProgress += hole.moleDirection * 0.1;

                if (hole.moleProgress >= 1) {
                    hole.moleProgress = 1;
                    hole.moleDirection = 0;
                } else if (hole.moleProgress <= 0) {
                    hole.moleProgress = 0;
                    hole.moleDirection = 0;
                    hole.moleActive = false;
                }
            }
        });

        // Update hammer animations
        this.activeHammers.forEach(hammer => {
            hammer.scale = Math.max(0.5, hammer.scale - 0.05);
        });
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#2ecc71');
        gradient.addColorStop(1, '#27ae60');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grass pattern
        this.ctx.fillStyle = 'rgba(46, 125, 50, 0.3)';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.ctx.fillRect(x, y, 3, 20);
        }

        // Draw holes and moles
        this.holes.forEach(hole => {
            this.drawHole(hole);
        });

        // Draw hammers
        this.activeHammers.forEach(hammer => {
            this.ctx.save();
            this.ctx.translate(hammer.x, hammer.y);
            this.ctx.rotate(hammer.rotation);
            this.ctx.scale(hammer.scale, hammer.scale);

            // Draw hammer handle
            this.ctx.fillStyle = '#8B4513';
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-5, -40, 10, 80);
            this.ctx.strokeRect(-5, -40, 10, 80);

            // Draw hammer head
            this.ctx.fillStyle = '#888';
            this.ctx.strokeStyle = '#444';
            this.ctx.lineWidth = 3;
            this.ctx.fillRect(-30, -50, 60, 30);
            this.ctx.strokeRect(-30, -50, 60, 30);

            // Metal shine
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(-20, -45, 30, 10);

            this.ctx.restore();
        });

        // Draw HUD
        this.drawHUD();
    }

    drawHole(hole) {
        // Draw hole
        this.ctx.fillStyle = '#654321';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.ellipse(hole.x, hole.y + 20, this.holeRadius, this.holeRadius * 0.5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Draw mole (if active)
        if (hole.moleProgress > 0) {
            this.ctx.save();

            const moleY = hole.y + 20 - (hole.moleProgress * this.holeRadius * 1.5);
            this.ctx.translate(hole.x, moleY);

            // Glow for golden moles
            if (hole.moleType === 'golden') {
                this.ctx.shadowColor = '#ffd700';
                this.ctx.shadowBlur = 30;
            }

            // Draw mole body (brown circle)
            const moleColor = hole.moleType === 'golden' ? '#ffd700' : '#8B4513';
            this.ctx.fillStyle = moleColor;
            this.ctx.strokeStyle = hole.moleType === 'golden' ? '#ff8c00' : '#654321';
            this.ctx.lineWidth = 4;

            // Body
            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.holeRadius * 0.8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Eyes
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.arc(-this.holeRadius * 0.3, -this.holeRadius * 0.2, this.holeRadius * 0.2, 0, Math.PI * 2);
            this.ctx.arc(this.holeRadius * 0.3, -this.holeRadius * 0.2, this.holeRadius * 0.2, 0, Math.PI * 2);
            this.ctx.fill();

            // Pupils
            this.ctx.fillStyle = 'black';
            this.ctx.beginPath();
            this.ctx.arc(-this.holeRadius * 0.3, -this.holeRadius * 0.2, this.holeRadius * 0.1, 0, Math.PI * 2);
            this.ctx.arc(this.holeRadius * 0.3, -this.holeRadius * 0.2, this.holeRadius * 0.1, 0, Math.PI * 2);
            this.ctx.fill();

            // Nose
            this.ctx.fillStyle = hole.moleType === 'golden' ? '#ff6b6b' : '#ff69b4';
            this.ctx.beginPath();
            this.ctx.arc(0, this.holeRadius * 0.1, this.holeRadius * 0.15, 0, Math.PI * 2);
            this.ctx.fill();

            // Star for golden moles
            if (hole.moleType === 'golden') {
                this.ctx.fillStyle = '#ff8c00';
                this.ctx.strokeStyle = '#ffd700';
                this.ctx.lineWidth = 2;
                const starSize = this.holeRadius * 0.4;
                this.ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * starSize;
                    const y = Math.sin(angle) * starSize - this.holeRadius;
                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            }

            this.ctx.shadowBlur = 0;
            this.ctx.restore();
        }

        // Draw dirt mound
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.ellipse(hole.x, hole.y + 30, this.holeRadius * 1.2, this.holeRadius * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawHUD() {
        // Time bar
        const barWidth = this.canvas.width * 0.8;
        const barHeight = 40;
        const barX = (this.canvas.width - barWidth) / 2;
        const barY = 30;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Time remaining
        const timePercent = this.timeLeft / 60;
        const color = timePercent > 0.5 ? '#4ecdc4' : timePercent > 0.25 ? '#f39c12' : '#e74c3c';

        this.ctx.fillStyle = color;
        this.ctx.fillRect(barX, barY, barWidth * timePercent, barHeight);

        // Border
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Time text
        this.ctx.font = 'bold 48px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;

        const timeText = `⏱️ ${this.timeLeft}s`;
        this.ctx.strokeText(timeText, this.canvas.width / 2, barY + barHeight / 2);
        this.ctx.fillText(timeText, this.canvas.width / 2, barY + barHeight / 2);
    }

    gameOver() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.timerInterval) clearInterval(this.timerInterval);

        ScoreManager.saveScore('whack-a-mole', this.score);

        setTimeout(() => {
            if (confirm(`⏰ ВРЕМЯ ВЫШЛО!\n\nВаш счет: ${this.score}\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    resize() {
        this.calculateLayout();
        this.initializeHoles();
    }
}
