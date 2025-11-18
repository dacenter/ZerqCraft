// Air Hockey - 2 or 4 Player competitive game
class AirHockey {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;

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

        this.playerColors = ['#4ecdc4', '#ff6b6b', '#ffd700', '#9b59b6'];
        this.paddles = [];
        this.scores = {};

        this.goalWidth = 300;
        this.friction = 0.99;
        this.bounceDamping = 0.9;
        this.gameTime = 60; // 60 seconds game time
        this.timerInterval = null;
        this.goalScored = false; // Prevent multiple goal counts

        this.animationFrame = null;

        this.setupPlayers();

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupPlayers() {
        this.paddles = [];
        this.scores = {};

        if (this.playerCount === 2) {
            // 2-player setup (top vs bottom)
            this.paddles = [
                {
                    id: 0,
                    name: 'Игрок 1',
                    x: this.canvas.width / 2,
                    y: this.canvas.height - 100,
                    radius: 50,
                    color: this.playerColors[0],
                    touchId: null,
                    side: 'bottom'
                },
                {
                    id: 1,
                    name: 'Игрок 2',
                    x: this.canvas.width / 2,
                    y: 100,
                    radius: 50,
                    color: this.playerColors[1],
                    touchId: null,
                    side: 'top'
                }
            ];

            this.scores = { 0: 0, 1: 0 };
        } else if (this.playerCount === 4) {
            // 4-player setup (all 4 sides)
            this.paddles = [
                {
                    id: 0,
                    name: 'Игрок 1',
                    x: this.canvas.width / 2,
                    y: this.canvas.height - 100,
                    radius: 50,
                    color: this.playerColors[0],
                    touchId: null,
                    side: 'bottom'
                },
                {
                    id: 1,
                    name: 'Игрок 2',
                    x: this.canvas.width - 100,
                    y: this.canvas.height / 2,
                    radius: 50,
                    color: this.playerColors[1],
                    touchId: null,
                    side: 'right'
                },
                {
                    id: 2,
                    name: 'Игрок 3',
                    x: this.canvas.width / 2,
                    y: 100,
                    radius: 50,
                    color: this.playerColors[2],
                    touchId: null,
                    side: 'top'
                },
                {
                    id: 3,
                    name: 'Игрок 4',
                    x: 100,
                    y: this.canvas.height / 2,
                    radius: 50,
                    color: this.playerColors[3],
                    touchId: null,
                    side: 'left'
                }
            ];

            this.scores = { 0: 0, 1: 0, 2: 0, 3: 0 };
        }
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            // Assign touch based on field position
            let assignedPaddle = null;

            if (this.playerCount === 2) {
                const midpoint = this.canvas.height / 2;
                if (touch.y > midpoint) {
                    assignedPaddle = this.paddles[0]; // Bottom - Player 1
                } else {
                    assignedPaddle = this.paddles[1]; // Top - Player 2
                }
            } else if (this.playerCount === 4) {
                // Assign based on quadrant
                const midX = this.canvas.width / 2;
                const midY = this.canvas.height / 2;

                if (touch.y > midY && touch.x < midX) {
                    assignedPaddle = this.paddles[0]; // Bottom-left -> Player 1 (bottom)
                } else if (touch.y > midY && touch.x >= midX) {
                    assignedPaddle = this.paddles[0]; // Bottom-right -> Player 1 (bottom)
                } else if (touch.y <= midY && touch.x >= midX) {
                    assignedPaddle = this.paddles[1]; // Top-right -> Player 2 (right)
                } else if (touch.y <= midY && touch.x < midX && touch.x > this.canvas.width * 0.25) {
                    assignedPaddle = this.paddles[2]; // Top-center -> Player 3 (top)
                } else {
                    assignedPaddle = this.paddles[3]; // Left -> Player 4 (left)
                }

                // Better quadrant assignment
                const distToBottom = Math.abs(touch.y - this.canvas.height);
                const distToTop = Math.abs(touch.y);
                const distToRight = Math.abs(touch.x - this.canvas.width);
                const distToLeft = Math.abs(touch.x);

                const minDist = Math.min(distToBottom, distToTop, distToRight, distToLeft);

                if (minDist === distToBottom) assignedPaddle = this.paddles[0];
                else if (minDist === distToRight) assignedPaddle = this.paddles[1];
                else if (minDist === distToTop) assignedPaddle = this.paddles[2];
                else if (minDist === distToLeft) assignedPaddle = this.paddles[3];
            }

            if (assignedPaddle && assignedPaddle.touchId === null) {
                assignedPaddle.touchId = touch.id;
            }
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            this.paddles.forEach(paddle => {
                if (paddle.touchId === touch.id) {
                    // Move paddle to touch position with constraints based on side
                    if (paddle.side === 'bottom') {
                        paddle.x = this.clamp(touch.x, paddle.radius, this.canvas.width - paddle.radius);
                        paddle.y = this.clamp(touch.y, this.canvas.height / 2, this.canvas.height - paddle.radius);
                    } else if (paddle.side === 'top') {
                        paddle.x = this.clamp(touch.x, paddle.radius, this.canvas.width - paddle.radius);
                        paddle.y = this.clamp(touch.y, paddle.radius, this.canvas.height / 2);
                    } else if (paddle.side === 'left') {
                        paddle.x = this.clamp(touch.x, paddle.radius, this.canvas.width / 2);
                        paddle.y = this.clamp(touch.y, paddle.radius, this.canvas.height - paddle.radius);
                    } else if (paddle.side === 'right') {
                        paddle.x = this.clamp(touch.x, this.canvas.width / 2, this.canvas.width - paddle.radius);
                        paddle.y = this.clamp(touch.y, paddle.radius, this.canvas.height - paddle.radius);
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

        // Reset scores
        this.paddles.forEach(paddle => {
            this.scores[paddle.id] = 0;
        });

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

        // Check for goals and wall collisions
        this.checkGoalsAndWalls();

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

    checkGoalsAndWalls() {
        const goalCenter = this.canvas.width / 2;
        const goalLeft = goalCenter - this.goalWidth / 2;
        const goalRight = goalCenter + this.goalWidth / 2;

        if (this.playerCount === 2) {
            // Top goal (player 0 scores on player 1)
            if (this.puck.y - this.puck.radius < 0) {
                if (this.puck.x > goalLeft && this.puck.x < goalRight && !this.goalScored) {
                    this.goalScored = true;
                    this.score(0); // Player 1 scores
                } else if (this.puck.x < goalLeft || this.puck.x > goalRight) {
                    this.puck.vy *= -this.bounceDamping;
                    this.puck.y = this.puck.radius;
                }
            }

            // Bottom goal (player 1 scores on player 0)
            if (this.puck.y + this.puck.radius > this.canvas.height) {
                if (this.puck.x > goalLeft && this.puck.x < goalRight && !this.goalScored) {
                    this.goalScored = true;
                    this.score(1); // Player 2 scores
                } else if (this.puck.x < goalLeft || this.puck.x > goalRight) {
                    this.puck.vy *= -this.bounceDamping;
                    this.puck.y = this.canvas.height - this.puck.radius;
                }
            }
        } else if (this.playerCount === 4) {
            const goalCenterY = this.canvas.height / 2;
            const goalTopY = goalCenterY - this.goalWidth / 2;
            const goalBottomY = goalCenterY + this.goalWidth / 2;

            // Bottom goal (players 1,2,3 score on player 0)
            if (this.puck.y + this.puck.radius > this.canvas.height) {
                if (this.puck.x > goalLeft && this.puck.x < goalRight && !this.goalScored) {
                    this.goalScored = true;
                    // Award point to whoever didn't defend this goal
                    // In 4-player, goal goes to last toucher or random opponent
                    const scorers = [1, 2, 3];
                    const scorer = scorers[Math.floor(Math.random() * scorers.length)];
                    this.score(scorer);
                } else if (this.puck.x < goalLeft || this.puck.x > goalRight) {
                    this.puck.vy *= -this.bounceDamping;
                    this.puck.y = this.canvas.height - this.puck.radius;
                }
            }

            // Top goal (players 0,1,3 score on player 2)
            if (this.puck.y - this.puck.radius < 0) {
                if (this.puck.x > goalLeft && this.puck.x < goalRight && !this.goalScored) {
                    this.goalScored = true;
                    const scorers = [0, 1, 3];
                    const scorer = scorers[Math.floor(Math.random() * scorers.length)];
                    this.score(scorer);
                } else if (this.puck.x < goalLeft || this.puck.x > goalRight) {
                    this.puck.vy *= -this.bounceDamping;
                    this.puck.y = this.puck.radius;
                }
            }

            // Right goal (players 0,2,3 score on player 1)
            if (this.puck.x + this.puck.radius > this.canvas.width) {
                if (this.puck.y > goalTopY && this.puck.y < goalBottomY && !this.goalScored) {
                    this.goalScored = true;
                    const scorers = [0, 2, 3];
                    const scorer = scorers[Math.floor(Math.random() * scorers.length)];
                    this.score(scorer);
                } else if (this.puck.y < goalTopY || this.puck.y > goalBottomY) {
                    this.puck.vx *= -this.bounceDamping;
                    this.puck.x = this.canvas.width - this.puck.radius;
                }
            }

            // Left goal (players 0,1,2 score on player 3)
            if (this.puck.x - this.puck.radius < 0) {
                if (this.puck.y > goalTopY && this.puck.y < goalBottomY && !this.goalScored) {
                    this.goalScored = true;
                    const scorers = [0, 1, 2];
                    const scorer = scorers[Math.floor(Math.random() * scorers.length)];
                    this.score(scorer);
                } else if (this.puck.y < goalTopY || this.puck.y > goalBottomY) {
                    this.puck.vx *= -this.bounceDamping;
                    this.puck.x = this.puck.radius;
                }
            }
        }
    }

    score(playerId) {
        this.scores[playerId]++;
        this.updateScoreDisplay();

        // Visual celebration
        const paddle = this.paddles[playerId];
        if (this.gameHub.particleSystem && paddle) {
            for (let i = 0; i < 50; i++) {
                setTimeout(() => {
                    let x, y;
                    if (paddle.side === 'bottom') {
                        x = Math.random() * this.canvas.width;
                        y = this.canvas.height;
                    } else if (paddle.side === 'top') {
                        x = Math.random() * this.canvas.width;
                        y = 0;
                    } else if (paddle.side === 'left') {
                        x = 0;
                        y = Math.random() * this.canvas.height;
                    } else if (paddle.side === 'right') {
                        x = this.canvas.width;
                        y = Math.random() * this.canvas.height;
                    }

                    this.gameHub.particleSystem.createExplosion(x, y, paddle.color, 20);
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

        if (this.playerCount === 2) {
            this.gameHub.updateScore(`${this.scores[0]} : ${this.scores[1]} | ⏱️ ${timeStr}`);
        } else if (this.playerCount === 4) {
            const scoreStr = `П1:${this.scores[0]} | П2:${this.scores[1]} | П3:${this.scores[2]} | П4:${this.scores[3]}`;
            this.gameHub.updateScore(`${scoreStr} | ⏱️ ${timeStr}`);
        }
    }

    timeUp() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Determine winner
        let winnerId = 0;
        let maxScore = this.scores[0];

        this.paddles.forEach(paddle => {
            if (this.scores[paddle.id] > maxScore) {
                maxScore = this.scores[paddle.id];
                winnerId = paddle.id;
            }
        });

        // Check for tie
        const winners = this.paddles.filter(p => this.scores[p.id] === maxScore);
        const isTie = winners.length > 1;

        const winnerName = isTie ? 'НИЧЬЯ' : this.paddles[winnerId].name;

        // Save score
        if (!isTie) {
            ScoreManager.saveScore('air-hockey', maxScore);
        }

        let scoreStr;
        if (this.playerCount === 2) {
            scoreStr = `${this.scores[0]} : ${this.scores[1]}`;
        } else {
            scoreStr = `П1:${this.scores[0]} | П2:${this.scores[1]} | П3:${this.scores[2]} | П4:${this.scores[3]}`;
        }

        setTimeout(() => {
            const message = isTie
                ? `⏱️ ВРЕМЯ ВЫШЛО!\n\n${winnerName}!\n\nСчет: ${scoreStr}\n\nСыграть еще раз?`
                : `🏆 ПОБЕДИЛ ${winnerName}!\n\nСчет: ${scoreStr}\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.gameHub.showPlayerSelection('air-hockey');
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

        if (this.playerCount === 2) {
            this.draw2Player();
        } else if (this.playerCount === 4) {
            this.draw4Player();
        }

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

            // Player number
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = 'black';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${paddle.id + 1}`, paddle.x, paddle.y);

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

    draw2Player() {
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

        // Top goal
        this.ctx.strokeStyle = this.playerColors[1];
        this.ctx.lineWidth = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(goalLeft, 0);
        this.ctx.lineTo(goalRight, 0);
        this.ctx.stroke();

        // Bottom goal
        this.ctx.strokeStyle = this.playerColors[0];
        this.ctx.beginPath();
        this.ctx.moveTo(goalLeft, this.canvas.height);
        this.ctx.lineTo(goalRight, this.canvas.height);
        this.ctx.stroke();
    }

    draw4Player() {
        // Draw center lines
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 5;
        this.ctx.setLineDash([20, 15]);

        // Horizontal center line
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();

        // Vertical center line
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Draw center circle
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, 80, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw goals
        const goalCenter = this.canvas.width / 2;
        const goalLeft = goalCenter - this.goalWidth / 2;
        const goalRight = goalCenter + this.goalWidth / 2;

        const goalCenterY = this.canvas.height / 2;
        const goalTop = goalCenterY - this.goalWidth / 2;
        const goalBottom = goalCenterY + this.goalWidth / 2;

        this.ctx.lineWidth = 15;

        // Bottom goal (Player 1)
        this.ctx.strokeStyle = this.playerColors[0];
        this.ctx.beginPath();
        this.ctx.moveTo(goalLeft, this.canvas.height);
        this.ctx.lineTo(goalRight, this.canvas.height);
        this.ctx.stroke();

        // Right goal (Player 2)
        this.ctx.strokeStyle = this.playerColors[1];
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width, goalTop);
        this.ctx.lineTo(this.canvas.width, goalBottom);
        this.ctx.stroke();

        // Top goal (Player 3)
        this.ctx.strokeStyle = this.playerColors[2];
        this.ctx.beginPath();
        this.ctx.moveTo(goalLeft, 0);
        this.ctx.lineTo(goalRight, 0);
        this.ctx.stroke();

        // Left goal (Player 4)
        this.ctx.strokeStyle = this.playerColors[3];
        this.ctx.beginPath();
        this.ctx.moveTo(0, goalTop);
        this.ctx.lineTo(0, goalBottom);
        this.ctx.stroke();
    }

    resize() {
        // Reposition game elements on resize
        this.puck.x = this.canvas.width / 2;
        this.puck.y = this.canvas.height / 2;

        this.setupPlayers();
    }
}
