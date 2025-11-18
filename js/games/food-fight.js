// Food Fight - Competitive food catching game
class FoodFight {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;

        this.isRunning = false;
        this.players = [];
        this.foods = [];

        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6'];
        this.laneWidth = 0;

        // Food types with different values
        this.goodFoods = [
            { emoji: '🍎', points: 10, color: '#ff0000' },
            { emoji: '🍌', points: 10, color: '#ffeb3b' },
            { emoji: '🍇', points: 15, color: '#9c27b0' },
            { emoji: '🍓', points: 15, color: '#f44336' },
            { emoji: '🍊', points: 10, color: '#ff9800' },
            { emoji: '🥕', points: 20, color: '#ff5722' },
            { emoji: '🍆', points: 20, color: '#673ab7' },
            { emoji: '🌽', points: 15, color: '#ffc107' }
        ];

        this.badFoods = [
            { emoji: '💩', points: -20, color: '#8b4513' },
            { emoji: '🦴', points: -15, color: '#e0e0e0' },
            { emoji: '🧊', points: -10, color: '#00bcd4' },
            { emoji: '🧱', points: -25, color: '#795548' }
        ];

        this.gameTime = 0;
        this.gameStartTime = 0;
        this.gameDuration = 60000; // 1 minute

        this.spawnInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupPlayers();
        this.setupTouchHandlers();
    }

    setupPlayers() {
        this.players = [];
        this.laneWidth = this.canvas.width / this.playerCount;

        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i,
                name: `Игрок ${i + 1}`,
                lane: i,
                x: this.laneWidth * i + this.laneWidth / 2,
                y: this.canvas.height - 100,
                targetX: this.laneWidth * i + this.laneWidth / 2,
                touchId: null,
                radius: 40,
                color: this.playerColors[i],
                score: 0,
                catchCombo: 0
            });
        }
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            // Assign touch to player based on lane
            const laneIndex = Math.floor(touch.x / this.laneWidth);
            const player = this.players[laneIndex];

            if (player && player.touchId === null) {
                player.touchId = touch.id;
                player.targetX = touch.x;
            }
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            const player = this.players.find(p => p.touchId === touch.id);
            if (player) {
                // Constrain to player's lane
                const laneLeft = player.lane * this.laneWidth;
                const laneRight = laneLeft + this.laneWidth;
                player.targetX = Math.max(laneLeft + player.radius, Math.min(laneRight - player.radius, touch.x));
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
        this.setupPlayers();
        this.foods = [];
        this.gameStartTime = Date.now();
        this.gameTime = 0;

        this.updateScore();

        // Spawn food items
        this.spawnInterval = setInterval(() => {
            this.spawnFood();
        }, 800);

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    spawnFood() {
        if (!this.isRunning) return;

        // Pick random lane
        const lane = Math.floor(Math.random() * this.playerCount);

        // 75% chance good food, 25% chance bad food
        const isGood = Math.random() < 0.75;
        const foodTypes = isGood ? this.goodFoods : this.badFoods;
        const foodType = foodTypes[Math.floor(Math.random() * foodTypes.length)];

        const laneLeft = lane * this.laneWidth;
        const laneRight = laneLeft + this.laneWidth;

        this.foods.push({
            lane: lane,
            x: laneLeft + Math.random() * (laneRight - laneLeft),
            y: -50,
            vx: 0,
            vy: 5 + Math.random() * 2,
            radius: 30,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            emoji: foodType.emoji,
            points: foodType.points,
            color: foodType.color,
            isGood: isGood
        });
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.gameTime = Date.now() - this.gameStartTime;

        // Check if game time is up
        if (this.gameTime >= this.gameDuration) {
            this.endGame();
            return;
        }

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update players (smooth movement)
        this.players.forEach(player => {
            const dx = player.targetX - player.x;
            player.x += dx * 0.2;
        });

        // Update food
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const food = this.foods[i];

            food.x += food.vx;
            food.y += food.vy;
            food.rotation += food.rotationSpeed;

            // Remove if off screen
            if (food.y > this.canvas.height + 50) {
                this.foods.splice(i, 1);

                // Miss penalty - break combo
                const player = this.players[food.lane];
                if (player && food.isGood) {
                    player.catchCombo = 0;
                }
                continue;
            }

            // Check collision with player in this lane
            const player = this.players[food.lane];
            if (player) {
                const dx = food.x - player.x;
                const dy = food.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < food.radius + player.radius) {
                    // Caught!
                    player.score += food.points;

                    if (food.isGood) {
                        player.catchCombo++;
                        // Combo bonus
                        if (player.catchCombo >= 5) {
                            player.score += 5;
                        }
                        this.gameHub.playSound('powerup');
                    } else {
                        player.catchCombo = 0;
                        this.gameHub.playSound('hit');
                    }

                    // Visual feedback
                    if (this.gameHub.particleSystem) {
                        this.gameHub.particleSystem.createExplosion(food.x, food.y, food.color, 20);
                    }

                    if (navigator.vibrate && this.gameHub.settings.vibration) {
                        navigator.vibrate(food.isGood ? 10 : 30);
                    }

                    this.foods.splice(i, 1);
                    this.updateScore();
                }
            }
        }
    }

    updateScore() {
        const timeLeft = Math.ceil((this.gameDuration - this.gameTime) / 1000);
        const scores = this.players
            .map(p => `П${p.id + 1}: ${p.score}`)
            .join(' | ');

        this.gameHub.updateScore(`${scores} | ⏱️ ${timeLeft}с`);
    }

    endGame() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);

        // Find winner
        const winner = this.players.reduce((best, player) => {
            if (!best || player.score > best.score) return player;
            return best;
        }, null);

        if (winner) {
            ScoreManager.saveScore('food-fight', winner.score);
        }

        setTimeout(() => {
            const scoreStr = this.players
                .map(p => `${p.name}: ${p.score}`)
                .join('\n');

            const message = `🍕 БИТВА ЗАВЕРШЕНА!\n\nПобедитель: ${winner ? winner.name : 'Никто'}\n\n${scoreStr}\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.gameHub.showPlayerSelection('food-fight');
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#fff3e0');
        gradient.addColorStop(1, '#ffe0b2');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw lane dividers
        this.ctx.strokeStyle = 'rgba(139, 69, 19, 0.2)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([15, 10]);

        for (let i = 1; i < this.playerCount; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.laneWidth, 0);
            this.ctx.lineTo(i * this.laneWidth, this.canvas.height);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([]);

        // Draw lane headers
        this.players.forEach(player => {
            const laneX = player.lane * this.laneWidth + this.laneWidth / 2;

            // Player label
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = player.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`П${player.id + 1}`, laneX, 40);

            // Score
            this.ctx.font = 'bold 36px Arial';
            this.ctx.fillStyle = player.score >= 0 ? '#4caf50' : '#f44336';
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText(player.score.toString(), laneX, 80);
            this.ctx.fillText(player.score.toString(), laneX, 80);

            // Combo indicator
            if (player.catchCombo >= 3) {
                this.ctx.font = 'bold 24px Arial';
                this.ctx.fillStyle = '#ffd700';
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 2;
                this.ctx.strokeText(`x${player.catchCombo} COMBO!`, laneX, 115);
                this.ctx.fillText(`x${player.catchCombo} COMBO!`, laneX, 115);
            }

            // Touch prompt if no touch
            if (player.touchId === null) {
                this.ctx.font = 'bold 20px Arial';
                this.ctx.fillStyle = player.color;
                this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 300) * 0.3;
                this.ctx.fillText('👆 КОСНИТЕСЬ', laneX, this.canvas.height - 150);
                this.ctx.globalAlpha = 1;
            }
        });

        // Draw falling food
        this.foods.forEach(food => {
            this.ctx.save();
            this.ctx.translate(food.x, food.y);
            this.ctx.rotate(food.rotation);

            // Food shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.beginPath();
            this.ctx.ellipse(5, 5, food.radius * 0.8, food.radius * 0.6, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Food glow
            if (!food.isGood) {
                this.ctx.shadowColor = '#ff0000';
                this.ctx.shadowBlur = 15;
            }

            // Food emoji
            this.ctx.font = `${food.radius * 2}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(food.emoji, 0, 0);

            this.ctx.shadowBlur = 0;

            // Points indicator
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillStyle = food.points > 0 ? '#4caf50' : '#f44336';
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            const pointsText = food.points > 0 ? `+${food.points}` : food.points.toString();
            this.ctx.strokeText(pointsText, 0, food.radius + 15);
            this.ctx.fillText(pointsText, 0, food.radius + 15);

            this.ctx.restore();
        });

        // Draw players
        this.players.forEach(player => {
            this.ctx.save();

            // Player shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.ctx.beginPath();
            this.ctx.ellipse(player.x, player.y + player.radius + 5, player.radius * 0.8, player.radius * 0.3, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Player body (chef)
            this.ctx.fillStyle = player.color;
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = player.color;
            this.ctx.shadowBlur = 15;

            this.ctx.beginPath();
            this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.shadowBlur = 0;

            // Chef hat
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = player.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.ellipse(player.x, player.y - player.radius * 0.7, player.radius * 0.6, player.radius * 0.3, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Chef face
            this.ctx.font = `${player.radius}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('😊', player.x, player.y);

            // Player number
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(`${player.id + 1}`, player.x, player.y + player.radius + 30);
            this.ctx.fillText(`${player.id + 1}`, player.x, player.y + player.radius + 30);

            this.ctx.restore();
        });

        // Draw timer
        const timeLeft = Math.ceil((this.gameDuration - this.gameTime) / 1000);
        this.ctx.font = 'bold 56px Arial';
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 5;

        const timerX = this.canvas.width / 2;
        const timerY = this.canvas.height - 50;

        this.ctx.strokeText(`⏱️ ${timeLeft}`, timerX, timerY);
        this.ctx.fillText(`⏱️ ${timeLeft}`, timerX, timerY);
    }

    resize() {
        this.laneWidth = this.canvas.width / this.playerCount;
        this.setupPlayers();
    }
}
