// Piano Hero - Multiplayer musical lanes game
class PianoHero {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.players = [];
        this.tiles = [];

        this.maxLanes = 6;
        this.laneWidth = 0;
        this.hitZoneY = 0;
        this.hitZoneHeight = 100;

        this.playerColors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'];

        this.baseSpeed = 3;
        this.speedIncrease = 0.05; // Speed increase over time
        this.currentSpeed = this.baseSpeed;

        this.spawnInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            const lane = this.getTouchLane(touch.x);
            if (lane !== -1 && lane < this.players.length) {
                this.hitLane(lane);
            }
        });
    }

    getTouchLane(x) {
        const lane = Math.floor(x / this.laneWidth);
        return lane >= 0 && lane < this.maxLanes ? lane : -1;
    }

    start() {
        this.isRunning = true;
        this.tiles = [];
        this.currentSpeed = this.baseSpeed;

        // Detect number of players by touch
        this.waitingForPlayers = true;
        this.detectedTouches = new Set();

        this.gameHub.updateScore('Коснитесь своих полос!');

        // Show player detection screen
        this.playerDetectionTimeout = setTimeout(() => {
            this.startGame();
        }, 3000);

        this.gameLoop();
    }

    startGame() {
        if (this.detectedTouches.size === 0) {
            // Default to 4 players if no touches detected
            this.initPlayers(4);
        } else {
            this.initPlayers(this.detectedTouches.size);
        }

        this.waitingForPlayers = false;
        this.laneWidth = this.canvas.width / this.players.length;
        this.hitZoneY = this.canvas.height - 150;

        // Start spawning tiles
        this.spawnInterval = setInterval(() => {
            this.spawnTile();
        }, 800);

        this.gameHub.updateScore(`Игроков: ${this.players.length}`);
    }

    initPlayers(count) {
        this.players = [];
        for (let i = 0; i < count; i++) {
            this.players.push({
                lane: i,
                score: 0,
                missedNotes: 0,
                alive: true,
                color: this.playerColors[i % this.playerColors.length]
            });
        }
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.playerDetectionTimeout) clearTimeout(this.playerDetectionTimeout);
        this.touchHandler.destroy();
    }

    spawnTile() {
        if (!this.isRunning || this.waitingForPlayers) return;

        // Spawn tile for random alive player
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length === 0) return;

        const player = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

        this.tiles.push({
            lane: player.lane,
            y: -100,
            height: 80,
            color: player.color,
            hit: false,
            missed: false
        });
    }

    hitLane(lane) {
        if (!this.players[lane] || !this.players[lane].alive) return;

        // Find tile in hit zone
        let hitTile = null;
        let bestDistance = Infinity;

        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];

            if (tile.lane === lane && !tile.hit && !tile.missed) {
                const tileCenter = tile.y + tile.height / 2;
                const hitCenter = this.hitZoneY + this.hitZoneHeight / 2;
                const distance = Math.abs(tileCenter - hitCenter);

                if (distance < this.hitZoneHeight && distance < bestDistance) {
                    hitTile = tile;
                    bestDistance = distance;
                }
            }
        }

        if (hitTile) {
            hitTile.hit = true;
            this.players[lane].score += 10;
            this.gameHub.playSound('hit');

            // Visual feedback
            if (this.gameHub.particleSystem) {
                const x = lane * this.laneWidth + this.laneWidth / 2;
                this.gameHub.particleSystem.createExplosion(
                    x,
                    this.hitZoneY + this.hitZoneHeight / 2,
                    this.players[lane].color,
                    20
                );
            }

            if (navigator.vibrate && this.gameHub.settings.vibration) {
                navigator.vibrate(10);
            }

            this.updateScore();
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.waitingForPlayers) return;

        // Increase speed over time
        this.currentSpeed += this.speedIncrease * 0.01;

        // Update tiles
        for (let i = this.tiles.length - 1; i >= 0; i--) {
            const tile = this.tiles[i];

            tile.y += this.currentSpeed;

            // Check if tile passed hit zone (missed)
            if (tile.y > this.hitZoneY + this.hitZoneHeight && !tile.hit && !tile.missed) {
                tile.missed = true;

                const player = this.players[tile.lane];
                if (player && player.alive) {
                    player.missedNotes++;

                    // Check if player is eliminated
                    if (player.missedNotes >= 3) {
                        player.alive = false;
                        this.gameHub.playSound('hit');

                        // Check game over
                        this.checkGameOver();
                    }
                }
            }

            // Remove tiles that are off screen
            if (tile.y > this.canvas.height + 100) {
                this.tiles.splice(i, 1);
            }
        }

        this.updateScore();
    }

    checkGameOver() {
        const alivePlayers = this.players.filter(p => p.alive);

        if (alivePlayers.length <= 1) {
            this.endGame();
        }
    }

    endGame() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);

        // Find winner
        const winner = this.players.reduce((best, player) => {
            if (!best) return player;
            if (player.alive && !best.alive) return player;
            if (player.score > best.score) return player;
            return best;
        }, null);

        const score = winner ? winner.score : 0;
        ScoreManager.saveScore('piano-hero', score);

        setTimeout(() => {
            const winnerLane = winner ? winner.lane + 1 : 0;
            if (confirm(`ИГРА ЗАВЕРШЕНА!\n\nПобедитель: Полоса ${winnerLane}\nОчков: ${score}\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    updateScore() {
        const aliveCount = this.players.filter(p => p.alive).length;
        const scores = this.players
            .map((p, i) => `П${i + 1}: ${p.score}${p.alive ? '' : ' 💀'}`)
            .join(' | ');

        this.gameHub.updateScore(`${scores} | Живых: ${aliveCount}`);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f3460');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.waitingForPlayers) {
            this.drawPlayerDetection();
            return;
        }

        // Draw lane dividers
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;

        for (let i = 1; i < this.players.length; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.laneWidth, 0);
            this.ctx.lineTo(i * this.laneWidth, this.canvas.height);
            this.ctx.stroke();
        }

        // Draw player lanes
        this.players.forEach((player, i) => {
            const x = i * this.laneWidth;

            // Lane background for dead players
            if (!player.alive) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(x, 0, this.laneWidth, this.canvas.height);

                // X mark
                this.ctx.strokeStyle = '#ff0000';
                this.ctx.lineWidth = 10;
                this.ctx.beginPath();
                this.ctx.moveTo(x + 50, this.canvas.height / 2 - 50);
                this.ctx.lineTo(x + this.laneWidth - 50, this.canvas.height / 2 + 50);
                this.ctx.moveTo(x + this.laneWidth - 50, this.canvas.height / 2 - 50);
                this.ctx.lineTo(x + 50, this.canvas.height / 2 + 50);
                this.ctx.stroke();
            }

            // Player number at top
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = player.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`П${i + 1}`, x + this.laneWidth / 2, 40);

            // Score
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(player.score, x + this.laneWidth / 2, 70);

            // Missed notes indicator
            for (let m = 0; m < 3; m++) {
                this.ctx.fillStyle = m < player.missedNotes ? '#ff0000' : 'rgba(255, 255, 255, 0.2)';
                this.ctx.beginPath();
                this.ctx.arc(
                    x + this.laneWidth / 2 - 20 + m * 20,
                    100,
                    8,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }
        });

        // Draw hit zone
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(0, this.hitZoneY, this.canvas.width, this.hitZoneHeight);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(0, this.hitZoneY, this.canvas.width, this.hitZoneHeight);

        // Draw tiles
        this.tiles.forEach(tile => {
            if (tile.hit) return; // Don't draw hit tiles

            const x = tile.lane * this.laneWidth;

            this.ctx.fillStyle = tile.color;
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;

            this.ctx.fillRect(x + 10, tile.y, this.laneWidth - 20, tile.height);
            this.ctx.strokeRect(x + 10, tile.y, this.laneWidth - 20, tile.height);

            // Musical note symbol
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('♪', x + this.laneWidth / 2, tile.y + tile.height / 2);
        });
    }

    drawPlayerDetection() {
        this.ctx.font = 'bold 56px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 4;

        const text = '👆 КОСНИТЕСЬ СВОИХ ПОЛОС 👆';
        this.ctx.strokeText(text, this.canvas.width / 2, this.canvas.height / 2 - 50);
        this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2 - 50);

        // Draw lane preview
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;

        const previewLaneWidth = this.canvas.width / this.maxLanes;
        for (let i = 1; i < this.maxLanes; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * previewLaneWidth, 0);
            this.ctx.lineTo(i * previewLaneWidth, this.canvas.height);
            this.ctx.stroke();
        }

        // Show detected touches
        this.detectedTouches.forEach(lane => {
            const x = lane * previewLaneWidth;
            this.ctx.fillStyle = this.playerColors[lane % this.playerColors.length] + '40';
            this.ctx.fillRect(x, 0, previewLaneWidth, this.canvas.height);

            this.ctx.fillStyle = this.playerColors[lane % this.playerColors.length];
            this.ctx.font = 'bold 64px Arial';
            this.ctx.fillText('✓', x + previewLaneWidth / 2, this.canvas.height / 2 + 100);
        });

        // Countdown
        const timeLeft = Math.ceil(3 - (Date.now() - this.startTime) / 1000);
        if (timeLeft > 0) {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.fillText(`Старт через ${timeLeft}...`, this.canvas.width / 2, this.canvas.height - 100);
        }
    }

    resize() {
        if (this.players.length > 0) {
            this.laneWidth = this.canvas.width / this.players.length;
        }
    }
}
