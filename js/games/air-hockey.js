// Air Hockey - 2 Player competitive game
class AirHockey {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;

        // Game objects
        this.puck = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: 0,
            vy: 0,
            radius: 25,
            maxSpeed: 25
        };

        this.paddles = [
            {
                id: 'player1',
                x: canvas.width / 2,
                y: canvas.height - 100,
                radius: 50,
                color: '#4ecdc4',
                touchId: null
            },
            {
                id: 'player2',
                x: canvas.width / 2,
                y: 100,
                radius: 50,
                color: '#ff6b6b',
                touchId: null
            }
        ];

        this.goals = [
            { y: 0, player: 2 },      // Top goal (player 2 scores)
            { y: canvas.height, player: 1 }  // Bottom goal (player 1 scores)
        ];

        this.scores = { player1: 0, player2: 0 };
        this.goalWidth = 300;
        this.friction = 0.99;
        this.bounceDamping = 0.9;
        this.gameTime = 60; // 60 seconds game time
        this.timerInterval = null;
        this.goalScored = false; // Prevent multiple goal counts

        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            // Assign touch based on field half
            const midpoint = this.canvas.height / 2;

            // Determine which half the touch is in
            if (touch.y > midpoint) {
                // Bottom half - Player 1
                if (this.paddles[0].touchId === null) {
                    this.paddles[0].touchId = touch.id;
                }
            } else {
                // Top half - Player 2
                if (this.paddles[1].touchId === null) {
                    this.paddles[1].touchId = touch.id;
                }
            }
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            this.paddles.forEach(paddle => {
                if (paddle.touchId === touch.id) {
                    // Move paddle to touch position with constraints
                    paddle.x = this.clamp(touch.x, paddle.radius, this.canvas.width - paddle.radius);

                    // Constrain to player's half of the field
                    if (paddle.id === 'player1') {
                        paddle.y = this.clamp(touch.y, this.canvas.height / 2, this.canvas.height - paddle.radius);
                    } else {
                        paddle.y = this.clamp(touch.y, paddle.radius, this.canvas.height / 2);
                    }
                }
            });
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            this.paddles.forEach(paddle => {
                if (paddle.touchId === touch.id) {
                    paddle.touchId = null;
                }
            });
        });
    }

    start() {
        this.isRunning = true;
        this.scores = { player1: 0, player2: 0 };
        this.gameTime = 60;
        this.resetPuck();
        this.gameLoop();
        this.updateScoreDisplay();

        // Start timer
        this.timerInterval = setInterval(() => {
            this.gameTime--;
            this.updateScoreDisplay();

            if (this.gameTime <= 0) {
                this.timeUp();
            }
        }, 1000);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.touchHandler.destroy();
    }

    resetPuck() {
        this.puck.x = this.canvas.width / 2;
        this.puck.y = this.canvas.height / 2;

        // Random initial velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = 8;
        this.puck.vx = Math.cos(angle) * speed;
        this.puck.vy = Math.sin(angle) * speed;

        // Reset goal scored flag
        this.goalScored = false;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update puck position
        this.puck.x += this.puck.vx;
        this.puck.y += this.puck.vy;

        // Apply friction
        this.puck.vx *= this.friction;
        this.puck.vy *= this.friction;

        // Wall collisions
        if (this.puck.x - this.puck.radius < 0 || this.puck.x + this.puck.radius > this.canvas.width) {
            this.puck.vx *= -this.bounceDamping;
            this.puck.x = this.clamp(this.puck.x, this.puck.radius, this.canvas.width - this.puck.radius);
            this.gameHub.playSound('wall-hit');
        }

        // Check for goals
        const goalCenter = this.canvas.width / 2;
        const goalLeft = goalCenter - this.goalWidth / 2;
        const goalRight = goalCenter + this.goalWidth / 2;

        if (this.puck.y - this.puck.radius < 0) {
            if (this.puck.x > goalLeft && this.puck.x < goalRight && !this.goalScored) {
                // Goal for player 1!
                this.goalScored = true;
                this.score('player1');
            } else if (this.puck.x < goalLeft || this.puck.x > goalRight) {
                this.puck.vy *= -this.bounceDamping;
                this.puck.y = this.puck.radius;
            }
        }

        if (this.puck.y + this.puck.radius > this.canvas.height) {
            if (this.puck.x > goalLeft && this.puck.x < goalRight && !this.goalScored) {
                // Goal for player 2!
                this.goalScored = true;
                this.score('player2');
            } else if (this.puck.x < goalLeft || this.puck.x > goalRight) {
                this.puck.vy *= -this.bounceDamping;
                this.puck.y = this.canvas.height - this.puck.radius;
            }
        }

        // Paddle collisions
        this.paddles.forEach(paddle => {
            const dx = this.puck.x - paddle.x;
            const dy = this.puck.y - paddle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.puck.radius + paddle.radius) {
                // Collision detected
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
                const hitStrength = Math.min(speed * 1.5, this.puck.maxSpeed);

                this.puck.vx = Math.cos(angle) * hitStrength;
                this.puck.vy = Math.sin(angle) * hitStrength;

                // Separate puck from paddle
                const overlap = this.puck.radius + paddle.radius - distance;
                this.puck.x += Math.cos(angle) * overlap;
                this.puck.y += Math.sin(angle) * overlap;

                this.gameHub.playSound('paddle-hit');

                // Visual feedback
                if (this.gameHub.particleSystem) {
                    this.gameHub.particleSystem.createExplosion(this.puck.x, this.puck.y, paddle.color, 10);
                }
            }
        });

        // Limit puck speed
        const speed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
        if (speed > this.puck.maxSpeed) {
            this.puck.vx = (this.puck.vx / speed) * this.puck.maxSpeed;
            this.puck.vy = (this.puck.vy / speed) * this.puck.maxSpeed;
        }
    }

    score(player) {
        this.scores[player]++;
        this.updateScoreDisplay();

        // Visual celebration
        const y = player === 'player1' ? 0 : this.canvas.height;
        if (this.gameHub.particleSystem) {
            for (let i = 0; i < 50; i++) {
                setTimeout(() => {
                    this.gameHub.particleSystem.createExplosion(
                        Math.random() * this.canvas.width,
                        y,
                        player === 'player1' ? '#4ecdc4' : '#ff6b6b',
                        20
                    );
                }, i * 50);
            }
        }

        this.gameHub.playSound('goal');

        // Reset for next round
        setTimeout(() => {
            if (this.isRunning) {
                this.resetPuck();
            }
        }, 2000);
    }

    updateScoreDisplay() {
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = this.gameTime % 60;
        const timeStr = `${seconds}s`;
        this.gameHub.updateScore(`${this.scores.player1} : ${this.scores.player2} | ⏱️ ${timeStr}`);
    }

    timeUp() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Determine winner
        let winner, winnerName;
        const finalScore = `${this.scores.player1} : ${this.scores.player2}`;

        if (this.scores.player1 > this.scores.player2) {
            winner = 'player1';
            winnerName = 'ИГРОК 1 (Синий)';
        } else if (this.scores.player2 > this.scores.player1) {
            winner = 'player2';
            winnerName = 'ИГРОК 2 (Красный)';
        } else {
            winnerName = 'НИЧЬЯ';
        }

        // Save score
        if (winner) {
            ScoreManager.saveScore('air-hockey', this.scores[winner]);
        }

        setTimeout(() => {
            const message = winner
                ? `🏆 ПОБЕДИЛ ${winnerName}!\n\nСчет: ${finalScore}\n\nСыграть еще раз?`
                : `⏱️ ВРЕМЯ ВЫШЛО!\n\n${winnerName}!\n\nСчет: ${finalScore}\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw rink background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1e3a5f');
        gradient.addColorStop(0.5, '#2a5a8a');
        gradient.addColorStop(1, '#1e3a5f');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw center line
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 5;
        this.ctx.setLineDash([20, 15]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw center circle
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, 100, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw goals
        const goalCenter = this.canvas.width / 2;
        const goalLeft = goalCenter - this.goalWidth / 2;
        const goalRight = goalCenter + this.goalWidth / 2;

        // Top goal (player 2)
        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(goalLeft, 0);
        this.ctx.lineTo(goalRight, 0);
        this.ctx.stroke();

        // Bottom goal (player 1)
        this.ctx.strokeStyle = '#4ecdc4';
        this.ctx.beginPath();
        this.ctx.moveTo(goalLeft, this.canvas.height);
        this.ctx.lineTo(goalRight, this.canvas.height);
        this.ctx.stroke();

        // Draw paddles
        this.paddles.forEach(paddle => {
            // Glow effect
            this.ctx.shadowColor = paddle.color;
            this.ctx.shadowBlur = 20;

            this.ctx.fillStyle = paddle.color;
            this.ctx.beginPath();
            this.ctx.arc(paddle.x, paddle.y, paddle.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner circle
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.arc(paddle.x, paddle.y, paddle.radius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;
        });

        // Draw puck
        this.ctx.shadowColor = '#ffffff';
        this.ctx.shadowBlur = 15;

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.puck.x, this.puck.y, this.puck.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Puck highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(this.puck.x - 5, this.puck.y - 5, this.puck.radius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.shadowBlur = 0;

        // Draw motion trail
        const speed = Math.sqrt(this.puck.vx ** 2 + this.puck.vy ** 2);
        if (speed > 5) {
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(speed / 20, 0.5)})`;
            this.ctx.lineWidth = this.puck.radius * 2;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(this.puck.x, this.puck.y);
            this.ctx.lineTo(this.puck.x - this.puck.vx * 2, this.puck.y - this.puck.vy * 2);
            this.ctx.stroke();
        }
    }

    resize() {
        // Reposition game elements on resize
        this.puck.x = this.canvas.width / 2;
        this.puck.y = this.canvas.height / 2;
        this.paddles[0].x = this.canvas.width / 2;
        this.paddles[1].x = this.canvas.width / 2;
    }
}
