// Simon Memory - Memory sequence game for 2-6 players
class SimonMemory {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;
        this.isRunning = false;
        this.players = [];
        this.sequence = [];
        this.playerSequence = [];
        this.currentPlayerIndex = 0;
        this.showingSequence = false;
        this.sequenceIndex = 0;
        this.colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
        this.activeColor = null;
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
                score: 0, alive: true, level: 1
            });
        }
    }
    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning || this.showingSequence) return;
            const player = this.players[this.currentPlayerIndex];
            if (!player || !player.alive) return;
            // Check which color button was pressed
            const buttonSize = 200;
            const spacing = 50;
            const startX = (this.canvas.width - (buttonSize * 2 + spacing)) / 2;
            const startY = 250;
            const buttons = [
                { x: startX, y: startY, color: 0 },
                { x: startX + buttonSize + spacing, y: startY, color: 1 },
                { x: startX, y: startY + buttonSize + spacing, color: 2 },
                { x: startX + buttonSize + spacing, y: startY + buttonSize + spacing, color: 3 }
            ];
            buttons.forEach(btn => {
                if (touch.x >= btn.x && touch.x <= btn.x + buttonSize &&
                    touch.y >= btn.y && touch.y <= btn.y + buttonSize) {
                    this.playerInput(btn.color);
                }
            });
        });
    }
    start() {
        this.isRunning = true;
        this.setupPlayers();
        this.sequence = [];
        this.currentPlayerIndex = 0;
        this.nextRound();
        this.gameLoop();
    }
    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }
    nextRound() {
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length === 0 || this.sequence.length >= 20) {
            this.endGame();
            return;
        }
        this.sequence.push(Math.floor(Math.random() * 4));
        this.playerSequence = [];
        this.currentPlayerIndex = this.players.findIndex(p => p.alive);
        this.showSequence();
    }
    showSequence() {
        this.showingSequence = true;
        this.sequenceIndex = 0;
        const showNext = () => {
            if (this.sequenceIndex >= this.sequence.length) {
                this.showingSequence = false;
                this.updateScore();
                return;
            }
            this.activeColor = this.sequence[this.sequenceIndex];
            this.gameHub.playSound('shoot');
            setTimeout(() => {
                this.activeColor = null;
                this.sequenceIndex++;
                setTimeout(showNext, 200);
            }, 500);
        };
        setTimeout(showNext, 1000);
    }
    playerInput(colorIndex) {
        this.activeColor = colorIndex;
        setTimeout(() => this.activeColor = null, 200);
        this.gameHub.playSound('shoot');
        const player = this.players[this.currentPlayerIndex];
        this.playerSequence.push(colorIndex);
        if (colorIndex !== this.sequence[this.playerSequence.length - 1]) {
            player.alive = false;
            this.gameHub.playSound('hit');
            this.nextPlayer();
        } else if (this.playerSequence.length === this.sequence.length) {
            player.score += this.sequence.length * 10;
            player.level = this.sequence.length;
            this.gameHub.playSound('powerup');
            this.nextPlayer();
        }
    }
    nextPlayer() {
        let nextIndex = (this.currentPlayerIndex + 1) % this.playerCount;
        let checked = 0;
        while (checked < this.playerCount && !this.players[nextIndex].alive) {
            nextIndex = (nextIndex + 1) % this.playerCount;
            checked++;
        }
        if (checked >= this.playerCount) {
            this.nextRound();
        } else {
            this.currentPlayerIndex = nextIndex;
            this.playerSequence = [];
        }
    }
    updateScore() {
        const scores = this.players.map(p => `П${p.id + 1}: ${p.score}${p.alive ? '' : '💀'}`).join(' | ');
        this.gameHub.updateScore(`Уровень ${this.sequence.length} | ${scores}`);
    }
    endGame() {
        this.isRunning = false;
        const winner = this.players.reduce((b, p) => !b || p.score > b.score ? p : b, null);
        if (winner) ScoreManager.saveScore('simon-memory', winner.score);
        setTimeout(() => {
            const scoreStr = this.players.map(p => `${p.name}: ${p.score} (Lvl ${p.level})`).join('\n');
            if (confirm(`🧠 ИГРА ЗАВЕРШЕНА!\n\nПобедитель: ${winner.name}\n\n${scoreStr}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('simon-memory');
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
        gradient.addColorStop(0, '#2c3e50'); gradient.addColorStop(1, '#34495e');
        this.ctx.fillStyle = gradient; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = 'bold 36px Arial'; this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Уровень ${this.sequence.length}`, this.canvas.width / 2, 60);

        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer && !this.showingSequence) {
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = currentPlayer.color;
            this.ctx.fillText(`Ход: ${currentPlayer.name}`, this.canvas.width / 2, 100);
        } else if (this.showingSequence) {
            this.ctx.fillText('Запомните последовательность', this.canvas.width / 2, 100);
        }

        // Color buttons
        const buttonSize = 200;
        const spacing = 50;
        const startX = (this.canvas.width - (buttonSize * 2 + spacing)) / 2;
        const startY = 250;
        const positions = [
            { x: startX, y: startY },
            { x: startX + buttonSize + spacing, y: startY },
            { x: startX, y: startY + buttonSize + spacing },
            { x: startX + buttonSize + spacing, y: startY + buttonSize + spacing }
        ];
        positions.forEach((pos, i) => {
            this.ctx.fillStyle = this.activeColor === i ?
                this.colors[i] : this.darkenColor(this.colors[i]);
            this.ctx.shadowColor = this.activeColor === i ? this.colors[i] : 'transparent';
            this.ctx.shadowBlur = this.activeColor === i ? 30 : 0;
            this.ctx.beginPath();
            this.ctx.roundRect(pos.x, pos.y, buttonSize, buttonSize, 20);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Player scores
        const scoreY = this.canvas.height - 80;
        this.players.forEach((player, i) => {
            const x = (this.canvas.width / this.playerCount) * i + (this.canvas.width / this.playerCount) / 2;
            this.ctx.fillStyle = player.color;
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText(player.name, x, scoreY);
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillText(player.alive ? player.score.toString() : '💀', x, scoreY + 30);
        });
    }
    darkenColor(color) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 100);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 100);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 100);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    resize() { this.setupPlayers(); }
}
