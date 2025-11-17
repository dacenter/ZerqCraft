// Memory Match - Find matching pairs game
class MemoryMatch {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.score = 0;
        this.moves = 0;
        this.matches = 0;

        // Card settings
        this.rows = 4;
        this.cols = 6;
        this.totalPairs = (this.rows * this.cols) / 2;
        this.cards = [];
        this.flippedCards = [];
        this.matchedCards = [];

        this.cardWidth = 0;
        this.cardHeight = 0;
        this.padding = 10;

        this.emojis = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🥝', '🍑', '🥭', '🍒', '🍍'];

        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;
            this.handleCardClick(touch.x, touch.y);
        });
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.moves = 0;
        this.matches = 0;
        this.flippedCards = [];
        this.matchedCards = [];

        this.calculateCardSize();
        this.initializeCards();
        this.gameHub.updateScore(this.score);

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    calculateCardSize() {
        const availableWidth = this.canvas.width - (this.padding * (this.cols + 1));
        const availableHeight = this.canvas.height - (this.padding * (this.rows + 1));

        this.cardWidth = availableWidth / this.cols;
        this.cardHeight = availableHeight / this.rows;
    }

    initializeCards() {
        this.cards = [];

        // Create pairs
        const pairs = [];
        for (let i = 0; i < this.totalPairs; i++) {
            const emoji = this.emojis[i % this.emojis.length];
            pairs.push(emoji, emoji);
        }

        // Shuffle
        for (let i = pairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
        }

        // Create card objects
        let index = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.cards.push({
                    emoji: pairs[index],
                    row,
                    col,
                    x: this.padding + col * (this.cardWidth + this.padding),
                    y: this.padding + row * (this.cardHeight + this.padding),
                    flipped: false,
                    matched: false,
                    flipProgress: 0
                });
                index++;
            }
        }
    }

    handleCardClick(x, y) {
        // Can only flip 2 cards at a time
        if (this.flippedCards.length >= 2) return;

        // Find clicked card
        const card = this.cards.find(c =>
            x >= c.x && x <= c.x + this.cardWidth &&
            y >= c.y && y <= c.y + this.cardHeight &&
            !c.flipped && !c.matched
        );

        if (!card) return;

        // Flip card
        card.flipped = true;
        this.flippedCards.push(card);

        this.gameHub.playSound('flip');

        // Check for match
        if (this.flippedCards.length === 2) {
            this.moves++;

            const [card1, card2] = this.flippedCards;

            if (card1.emoji === card2.emoji) {
                // Match!
                setTimeout(() => {
                    card1.matched = true;
                    card2.matched = true;
                    this.matchedCards.push(card1, card2);
                    this.flippedCards = [];

                    this.matches++;
                    this.score += 100;
                    this.gameHub.updateScore(this.score);

                    // Visual feedback
                    if (this.gameHub.particleSystem) {
                        this.gameHub.particleSystem.createExplosion(
                            card1.x + this.cardWidth / 2,
                            card1.y + this.cardHeight / 2,
                            '#ffd700',
                            30
                        );
                        this.gameHub.particleSystem.createExplosion(
                            card2.x + this.cardWidth / 2,
                            card2.y + this.cardHeight / 2,
                            '#ffd700',
                            30
                        );
                    }

                    this.gameHub.playSound('match');

                    // Check for win
                    if (this.matches === this.totalPairs) {
                        this.gameOver();
                    }
                }, 600);
            } else {
                // No match - flip back
                setTimeout(() => {
                    card1.flipped = false;
                    card2.flipped = false;
                    this.flippedCards = [];
                }, 1000);
            }
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update flip animations
        this.cards.forEach(card => {
            if (card.flipped && card.flipProgress < 1) {
                card.flipProgress = Math.min(1, card.flipProgress + 0.1);
            } else if (!card.flipped && card.flipProgress > 0) {
                card.flipProgress = Math.max(0, card.flipProgress - 0.1);
            }
        });
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw cards
        this.cards.forEach(card => {
            this.drawCard(card);
        });

        // Draw HUD
        this.drawHUD();
    }

    drawCard(card) {
        this.ctx.save();

        const centerX = card.x + this.cardWidth / 2;
        const centerY = card.y + this.cardHeight / 2;

        this.ctx.translate(centerX, centerY);

        // Flip animation
        const scaleX = Math.abs(Math.cos(card.flipProgress * Math.PI));

        this.ctx.scale(scaleX, 1);

        // Card background
        if (card.matched) {
            this.ctx.fillStyle = '#95e1d3';
            this.ctx.globalAlpha = 0.5;
        } else if (card.flipProgress > 0.5) {
            // Front (emoji)
            this.ctx.fillStyle = 'white';
        } else {
            // Back (pattern)
            this.ctx.fillStyle = '#4ecdc4';
        }

        // Draw card
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 5;
        this.ctx.shadowOffsetY = 5;

        const radius = 15;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.cardWidth / 2 + radius, -this.cardHeight / 2);
        this.ctx.lineTo(this.cardWidth / 2 - radius, -this.cardHeight / 2);
        this.ctx.quadraticCurveTo(this.cardWidth / 2, -this.cardHeight / 2, this.cardWidth / 2, -this.cardHeight / 2 + radius);
        this.ctx.lineTo(this.cardWidth / 2, this.cardHeight / 2 - radius);
        this.ctx.quadraticCurveTo(this.cardWidth / 2, this.cardHeight / 2, this.cardWidth / 2 - radius, this.cardHeight / 2);
        this.ctx.lineTo(-this.cardWidth / 2 + radius, this.cardHeight / 2);
        this.ctx.quadraticCurveTo(-this.cardWidth / 2, this.cardHeight / 2, -this.cardWidth / 2, this.cardHeight / 2 - radius);
        this.ctx.lineTo(-this.cardWidth / 2, -this.cardHeight / 2 + radius);
        this.ctx.quadraticCurveTo(-this.cardWidth / 2, -this.cardHeight / 2, -this.cardWidth / 2 + radius, -this.cardHeight / 2);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.shadowColor = 'transparent';

        // Draw content
        if (card.flipProgress > 0.5) {
            // Show emoji
            this.ctx.font = `${this.cardHeight * 0.5}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#333';
            this.ctx.fillText(card.emoji, 0, 0);
        } else {
            // Show back pattern
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.5;

            // Draw pattern
            for (let i = -2; i <= 2; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(-this.cardWidth / 3, i * 20);
                this.ctx.lineTo(this.cardWidth / 3, i * 20);
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }

    drawHUD() {
        // Moves counter
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;

        const movesText = `Ходы: ${this.moves}`;
        this.ctx.strokeText(movesText, 30, 30);
        this.ctx.fillText(movesText, 30, 30);

        // Matches counter
        const matchesText = `Пары: ${this.matches}/${this.totalPairs}`;
        this.ctx.strokeText(matchesText, 30, 80);
        this.ctx.fillText(matchesText, 30, 80);
    }

    gameOver() {
        this.isRunning = false;

        // Calculate final score (bonus for fewer moves)
        const moveBonus = Math.max(0, (this.totalPairs * 3 - this.moves) * 10);
        this.score += moveBonus;

        ScoreManager.saveScore('memory-match', this.score);

        setTimeout(() => {
            const message = `🎉 ПОЗДРАВЛЯЕМ!\n\nВы нашли все пары!\nХодов: ${this.moves}\nБонус: +${moveBonus}\nИтого: ${this.score}\n\nСыграть еще?`;

            if (confirm(message)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    resize() {
        this.calculateCardSize();
        // Update card positions
        this.cards.forEach((card, index) => {
            const row = Math.floor(index / this.cols);
            const col = index % this.cols;
            card.x = this.padding + col * (this.cardWidth + this.padding);
            card.y = this.padding + row * (this.cardHeight + this.padding);
        });
    }
}
