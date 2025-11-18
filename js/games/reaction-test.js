// Reaction Test - Fast reaction game for 2-6 players
class ReactionTest {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;
        this.isRunning = false;
        this.players = [];
        this.targetActive = false;
        this.targetX = 0;
        this.targetY = 0;
        this.targetRadius = 80;
        this.roundsTotal = 15;
        this.currentRound = 0;
        this.waitTime = 0;
        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#2ecc71', '#e67e22'];
        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupPlayers();
        this.setupTouchHandlers();
    }
    setupPlayers() {
        this.players = [];
        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i, name: `Игрок ${i + 1}`, color: this.playerColors[i],
                score: 0, reactionTimes: [], avgReaction: 0
            });
        }
    }
    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning || !this.targetActive) return;
            const dx = touch.x - this.targetX;
            const dy = touch.y - this.targetY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= this.targetRadius) {
                const reactionTime = Date.now() - this.targetStartTime;
                const fastestPlayer = this.players.reduce((best, p) =>
                    (best && best.lastReaction < reactionTime) ? best : p
                );
                fastestPlayer.reactionTimes.push(reactionTime);
                fastestPlayer.score += Math.max(100, 500 - reactionTime);
                fastestPlayer.lastReaction = reactionTime;
                this.gameHub.playSound('powerup');
                this.targetActive = false;
                setTimeout(() => this.nextRound(), 1000);
            }
        });
    }
    start() {
        this.isRunning = true;
        this.currentRound = 0;
        this.setupPlayers();
        this.nextRound();
        this.gameLoop();
    }
    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }
    nextRound() {
        if (this.currentRound >= this.roundsTotal) {
            this.endGame();
            return;
        }
        this.currentRound++;
        this.targetActive = false;
        this.waitTime = 1000 + Math.random() * 2000;
        this.updateScore();
        setTimeout(() => {
            this.targetX = Math.random() * (this.canvas.width - 200) + 100;
            this.targetY = Math.random() * (this.canvas.height - 300) + 150;
            this.targetActive = true;
            this.targetStartTime = Date.now();
        }, this.waitTime);
    }
    updateScore() {
        const scores = this.players.map(p => `П${p.id + 1}: ${p.score}`).join(' | ');
        this.gameHub.updateScore(`Раунд ${this.currentRound}/${this.roundsTotal} | ${scores}`);
    }
    endGame() {
        this.isRunning = false;
        this.players.forEach(p => {
            p.avgReaction = p.reactionTimes.length > 0 ?
                p.reactionTimes.reduce((a, b) => a + b, 0) / p.reactionTimes.length : 0;
        });
        const winner = this.players.reduce((b, p) => !b || p.score > b.score ? p : b, null);
        if (winner) ScoreManager.saveScore('reaction-test', winner.score);
        setTimeout(() => {
            const scoreStr = this.players.map(p =>
                `${p.name}: ${p.score} (${Math.round(p.avgReaction)}мс)`
            ).join('\n');
            if (confirm(`⚡ ТЕСТ РЕАКЦИИ ЗАВЕРШЁН!\n\nПобедитель: ${winner.name}\n\n${scoreStr}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('reaction-test');
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }
    gameLoop() {
        if (!this.isRunning) return;
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#000000'); gradient.addColorStop(1, '#1a1a1a');
        this.ctx.fillStyle = gradient; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = 'bold 36px Arial'; this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Раунд ${this.currentRound}/${this.roundsTotal}`, this.canvas.width / 2, 60);

        if (this.targetActive) {
            const gradient = this.ctx.createRadialGradient(
                this.targetX, this.targetY, 0,
                this.targetX, this.targetY, this.targetRadius
            );
            gradient.addColorStop(0, '#ff0000');
            gradient.addColorStop(1, '#ff6666');
            this.ctx.fillStyle = gradient;
            this.ctx.shadowColor = '#ff0000';
            this.ctx.shadowBlur = 30;
            this.ctx.beginPath();
            this.ctx.arc(this.targetX, this.targetY, this.targetRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillText('👆', this.targetX, this.targetY + 15);
        } else {
            this.ctx.font = 'bold 48px Arial';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fillText('Ждите...', this.canvas.width / 2, this.canvas.height / 2);
        }

        // Player scores
        const scoreY = this.canvas.height - 100;
        this.players.forEach((player, i) => {
            const x = (this.canvas.width / this.playerCount) * i + (this.canvas.width / this.playerCount) / 2;
            this.ctx.fillStyle = player.color;
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillText(player.name, x, scoreY);
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillText(player.score.toString(), x, scoreY + 35);
        });
    }
    resize() { this.setupPlayers(); }
}
