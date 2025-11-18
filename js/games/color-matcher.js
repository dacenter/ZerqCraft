// Color Matcher - Fast color matching game for 2-6 players
class ColorMatcher {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;
        this.isRunning = false;
        this.players = [];
        this.targetColor = null;
        this.roundTime = 3000;
        this.roundsTotal = 20;
        this.currentRound = 0;
        this.colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff'];
        this.colorNames = ['Красный', 'Зелёный', 'Синий', 'Жёлтый', 'Пурпурный', 'Голубой', 'Оранжевый', 'Фиолетовый'];
        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#2ecc71', '#e67e22'];
        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupPlayers();
        this.setupTouchHandlers();
    }
    setupPlayers() {
        this.players = [];
        const buttonHeight = (this.canvas.height - 300) / this.playerCount;
        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i, name: `Игрок ${i + 1}`, color: this.playerColors[i],
                score: 0, buttonY: 250 + buttonHeight * i, buttonHeight: buttonHeight - 10,
                answered: false, correct: false, touchId: null
            });
        }
    }
    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning || !this.targetColor) return;
            this.players.forEach(player => {
                if (!player.answered && touch.y >= player.buttonY && touch.y <= player.buttonY + player.buttonHeight) {
                    this.playerAnswered(player);
                }
            });
        });
    }
    playerAnswered(player) {
        player.answered = true;
        player.correct = true;
        player.score += 100;
        this.gameHub.playSound('powerup');
        if (navigator.vibrate) navigator.vibrate(30);
        if (this.players.every(p => p.answered)) this.nextRound();
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
        this.targetColor = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.players.forEach(p => { p.answered = false; p.correct = false; });
        this.updateScore();
        setTimeout(() => this.nextRound(), this.roundTime);
    }
    updateScore() {
        const scores = this.players.map(p => `П${p.id + 1}: ${p.score}`).join(' | ');
        this.gameHub.updateScore(`Раунд ${this.currentRound}/${this.roundsTotal} | ${scores}`);
    }
    endGame() {
        this.isRunning = false;
        const winner = this.players.reduce((best, p) => !best || p.score > best.score ? p : best, null);
        if (winner) ScoreManager.saveScore('color-matcher', winner.score);
        setTimeout(() => {
            const scoreStr = this.players.map(p => `${p.name}: ${p.score}`).join('\n');
            if (confirm(`🎨 ИГРА ЗАВЕРШЕНА!\n\nПобедитель: ${winner.name}\n\n${scoreStr}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('color-matcher');
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
        gradient.addColorStop(0, '#1a1a2e'); gradient.addColorStop(1, '#0f3460');
        this.ctx.fillStyle = gradient; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.targetColor) {
            this.ctx.fillStyle = this.targetColor;
            this.ctx.fillRect(this.canvas.width / 2 - 150, 50, 300, 150);
            this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = 5;
            this.ctx.strokeRect(this.canvas.width / 2 - 150, 50, 300, 150);

            this.ctx.font = 'bold 32px Arial'; this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = 'black'; this.ctx.lineWidth = 3;
            const colorName = this.colorNames[this.colors.indexOf(this.targetColor)] || 'Цвет';
            this.ctx.strokeText(`Найди: ${colorName}`, this.canvas.width / 2, 140);
            this.ctx.fillText(`Найди: ${colorName}`, this.canvas.width / 2, 140);
        }

        this.players.forEach(player => {
            this.ctx.fillStyle = player.answered ? (player.correct ? '#2ecc71' : '#e74c3c') : player.color;
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.roundRect(20, player.buttonY, this.canvas.width - 40, player.buttonHeight, 15);
            this.ctx.fill(); this.ctx.shadowBlur = 0;

            this.ctx.font = 'bold 28px Arial'; this.ctx.fillStyle = 'white'; this.ctx.textAlign = 'center';
            this.ctx.fillText(`${player.name}: ${player.score}`, this.canvas.width / 2, player.buttonY + player.buttonHeight / 2 + 10);

            if (player.answered) {
                this.ctx.font = '36px Arial';
                this.ctx.fillText('✓', this.canvas.width - 80, player.buttonY + player.buttonHeight / 2 + 12);
            }
        });
    }
    resize() { this.setupPlayers(); }
}
