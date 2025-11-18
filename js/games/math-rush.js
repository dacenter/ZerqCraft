// Math Rush - Fast math game for 2-6 players
class MathRush {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;
        this.isRunning = false;
        this.players = [];
        this.currentQuestion = null;
        this.options = [];
        this.totalQuestions = 15;
        this.questionIndex = 0;
        this.timePerQuestion = 10000;
        this.timeLeft = 0;
        this.questionStartTime = 0;
        this.showingAnswer = false;
        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#2ecc71', '#e67e22'];
        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupPlayers();
        this.setupTouchHandlers();
    }
    setupPlayers() {
        this.players = [];
        const answerWidth = this.canvas.width / this.playerCount;
        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i, name: `П${i + 1}`, color: this.playerColors[i],
                score: 0, answerX: answerWidth * i, answerWidth: answerWidth,
                answered: false, touchId: null
            });
        }
    }
    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning || this.showingAnswer || !this.currentQuestion) return;
            // Check option buttons
            const optionY = 350;
            const optionHeight = 80;
            this.options.forEach((opt, i) => {
                const y = optionY + i * (optionHeight + 20);
                if (touch.x >= 50 && touch.x <= this.canvas.width - 50 &&
                    touch.y >= y && touch.y <= y + optionHeight) {
                    // Check which player pressed
                    this.players.forEach(player => {
                        if (!player.answered &&
                            touch.x >= player.answerX &&
                            touch.x <= player.answerX + player.answerWidth) {
                            this.playerAnswered(player, opt);
                        }
                    });
                }
            });
        });
    }
    playerAnswered(player, answer) {
        player.answered = true;
        const correct = answer === this.currentQuestion.answer;
        if (correct) {
            const timeBonus = Math.floor((this.timeLeft / this.timePerQuestion) * 50);
            player.score += 100 + timeBonus;
            this.gameHub.playSound('powerup');
        } else {
            this.gameHub.playSound('hit');
        }
        if (this.players.every(p => p.answered)) this.showAnswer();
    }
    start() {
        this.isRunning = true;
        this.questionIndex = 0;
        this.setupPlayers();
        this.nextQuestion();
        this.gameLoop();
    }
    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }
    nextQuestion() {
        if (this.questionIndex >= this.totalQuestions) {
            this.endGame();
            return;
        }
        this.showingAnswer = false;
        this.players.forEach(p => p.answered = false);
        this.generateQuestion();
        this.questionIndex++;
        this.questionStartTime = Date.now();
        this.timeLeft = this.timePerQuestion;
        this.updateScore();
        setTimeout(() => { if (!this.showingAnswer) this.showAnswer(); }, this.timePerQuestion);
    }
    generateQuestion() {
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        const ops = ['+', '-', '×'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let answer;
        if (op === '+') answer = a + b;
        else if (op === '-') answer = Math.abs(a - b);
        else answer = a * b;
        this.currentQuestion = { text: `${a} ${op} ${b} = ?`, answer: answer };
        this.options = [answer];
        while (this.options.length < 4) {
            const wrong = answer + Math.floor(Math.random() * 20) - 10;
            if (wrong > 0 && !this.options.includes(wrong)) this.options.push(wrong);
        }
        this.options.sort(() => Math.random() - 0.5);
    }
    showAnswer() {
        this.showingAnswer = true;
        this.gameHub.playSound('explosion');
        setTimeout(() => this.nextQuestion(), 2000);
    }
    updateScore() {
        const scores = this.players.map(p => `${p.name}:${p.score}`).join(' | ');
        this.gameHub.updateScore(`Вопрос ${this.questionIndex}/${this.totalQuestions} | ${scores}`);
    }
    endGame() {
        this.isRunning = false;
        const winner = this.players.reduce((b, p) => !b || p.score > b.score ? p : b, null);
        if (winner) ScoreManager.saveScore('math-rush', winner.score);
        setTimeout(() => {
            const scoreStr = this.players.map(p => `${p.name}: ${p.score}`).join('\n');
            if (confirm(`🔢 МАТЕМ АТИКА ЗАВЕРШЕНА!\n\nПобедитель: ${winner.name}\n\n${scoreStr}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('math-rush');
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }
    gameLoop() {
        if (!this.isRunning) return;
        if (!this.showingAnswer) this.timeLeft = Math.max(0, this.timePerQuestion - (Date.now() - this.questionStartTime));
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#2c3e50'); gradient.addColorStop(1, '#34495e');
        this.ctx.fillStyle = gradient; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.currentQuestion) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; this.ctx.shadowBlur = 20;
            this.ctx.beginPath();
            this.ctx.roundRect(100, 100, this.canvas.width - 200, 180, 20);
            this.ctx.fill(); this.ctx.shadowBlur = 0;

            this.ctx.font = 'bold 64px Arial'; this.ctx.fillStyle = '#2c3e50';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.currentQuestion.text, this.canvas.width / 2, 200);

            // Timer
            const timerProgress = this.timeLeft / this.timePerQuestion;
            const timerColor = timerProgress > 0.5 ? '#2ecc71' : timerProgress > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillStyle = timerColor;
            this.ctx.fillRect(100, 250, (this.canvas.width - 200) * timerProgress, 15);

            // Options
            this.options.forEach((opt, i) => {
                const y = 350 + i * 100;
                const isCorrect = opt === this.currentQuestion.answer;
                this.ctx.fillStyle = this.showingAnswer && isCorrect ? '#2ecc71' : '#3498db';
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'; this.ctx.shadowBlur = 10;
                this.ctx.beginPath();
                this.ctx.roundRect(50, y, this.canvas.width - 100, 80, 15);
                this.ctx.fill(); this.ctx.shadowBlur = 0;

                this.ctx.font = 'bold 48px Arial'; this.ctx.fillStyle = 'white';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(opt.toString(), this.canvas.width / 2, y + 55);
            });
        }

        // Player indicators
        this.players.forEach(player => {
            const x = player.answerX + player.answerWidth / 2;
            this.ctx.font = 'bold 24px Arial'; this.ctx.fillStyle = player.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${player.name}: ${player.score}`, x, 50);
            if (player.answered) {
                this.ctx.font = '32px Arial';
                this.ctx.fillText('✓', x, 80);
            }
        });
    }
    resize() { this.setupPlayers(); }
}
