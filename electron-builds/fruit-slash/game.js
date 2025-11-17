// Fruit Slash - Standalone Electron Version
class FruitSlashGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.fruits = [];
        this.slices = [];
        this.score = 0;
        this.combo = 0;
        this.lives = 3;
        this.isRunning = false;

        this.fruitTypes = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🥝', '🍑', '🥭'];
        this.bombEmoji = '💣';

        this.touches = new Map();
        this.spawnInterval = null;
        this.animationFrame = null;

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

        // Mouse events for testing
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        this.start();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 120;
    }

    handleTouchStart(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        for (let touch of e.changedTouches) {
            this.touches.set(touch.identifier, {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            });
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        for (let touch of e.changedTouches) {
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            this.slices.push({
                x, y,
                time: Date.now(),
                color: `hsl(${Math.random() * 360}, 100%, 50%)`
            });

            this.checkFruitCollisions(x, y);
            this.touches.set(touch.identifier, { x, y });
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        for (let touch of e.changedTouches) {
            this.touches.delete(touch.identifier);
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.touches.set('mouse', {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    }

    handleMouseMove(e) {
        if (!this.touches.has('mouse')) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.slices.push({ x, y, time: Date.now() });
        this.checkFruitCollisions(x, y);
        this.touches.set('mouse', { x, y });
    }

    handleMouseUp(e) {
        this.touches.delete('mouse');
    }

    checkFruitCollisions(x, y) {
        this.fruits.forEach(fruit => {
            if (fruit.sliced) return;

            const dx = x - fruit.x;
            const dy = y - fruit.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < fruit.radius + 20) {
                this.sliceFruit(fruit, x, y);
            }
        });
    }

    sliceFruit(fruit, x, y) {
        fruit.sliced = true;

        if (fruit.isBomb) {
            this.lives = 0;
            this.gameOver();
            this.createExplosion(fruit.x, fruit.y, '#ff0000', 50);
            this.canvas.style.animation = 'shake 0.5s';
            setTimeout(() => this.canvas.style.animation = '', 500);
        } else {
            this.combo++;
            const points = 10 + (this.combo - 1) * 5;
            this.score += points;
            this.updateScore();

            this.createExplosion(fruit.x, fruit.y, this.getColorForFruit(fruit.emoji), 30);
        }
    }

    getColorForFruit(emoji) {
        const colors = {
            '🍎': '#ff0000', '🍊': '#ff8800', '🍋': '#ffff00',
            '🍌': '#ffff88', '🍉': '#00ff00', '🍇': '#8800ff',
            '🍓': '#ff0044', '🥝': '#88ff00', '🍑': '#ffbb88', '🥭': '#ffaa00'
        };
        return colors[emoji] || '#ffd700';
    }

    createExplosion(x, y, color, count) {
        // Simple visual feedback
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 5;

            // Visual effect would be rendered in draw
        }
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.combo = 0;
        this.lives = 3;
        this.fruits = [];
        this.updateScore();
        this.updateLives();

        this.spawnInterval = setInterval(() => {
            this.spawnFruit();
        }, 800);

        this.gameLoop();
    }

    spawnFruit() {
        const isBomb = Math.random() < 0.15;

        const fruit = {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height + 50,
            vx: (Math.random() - 0.5) * 8,
            vy: -(Math.random() * 15 + 20),
            radius: 40,
            emoji: isBomb ? this.bombEmoji : this.fruitTypes[Math.floor(Math.random() * this.fruitTypes.length)],
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2,
            isBomb: isBomb,
            sliced: false,
            gravity: 0.5
        };

        this.fruits.push(fruit);
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update fruits
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];

            fruit.vy += fruit.gravity;
            fruit.x += fruit.vx;
            fruit.y += fruit.vy;
            fruit.rotation += fruit.rotationSpeed;

            if (fruit.y > this.canvas.height + 100) {
                if (!fruit.sliced && !fruit.isBomb) {
                    this.lives--;
                    this.combo = 0;
                    this.updateLives();

                    if (this.lives <= 0) {
                        this.gameOver();
                    }
                }
                this.fruits.splice(i, 1);
            }
        }

        // Update slices
        this.slices = this.slices.filter(slice => Date.now() - slice.time < 300);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f3460');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw slice trails
        if (this.slices.length > 1) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 8;
            this.ctx.lineCap = 'round';
            this.ctx.beginPath();

            for (let i = 1; i < this.slices.length; i++) {
                const age = Date.now() - this.slices[i].time;
                const alpha = 1 - (age / 300);
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.lineTo(this.slices[i].x, this.slices[i].y);
                this.ctx.stroke();
                this.ctx.beginPath();
                this.ctx.moveTo(this.slices[i].x, this.slices[i].y);
            }
        }

        // Draw fruits
        this.fruits.forEach(fruit => {
            this.ctx.save();
            this.ctx.translate(fruit.x, fruit.y);
            this.ctx.rotate(fruit.rotation);

            if (fruit.sliced) {
                this.ctx.globalAlpha = 0.5;
                this.ctx.font = `${fruit.radius * 2}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                this.ctx.save();
                this.ctx.translate(-15, 0);
                this.ctx.rotate(-0.3);
                this.ctx.fillText(fruit.emoji, 0, 0);
                this.ctx.restore();

                this.ctx.save();
                this.ctx.translate(15, 0);
                this.ctx.rotate(0.3);
                this.ctx.fillText(fruit.emoji, 0, 0);
                this.ctx.restore();
            } else {
                this.ctx.font = `${fruit.radius * 2}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                if (fruit.isBomb) {
                    this.ctx.shadowColor = '#ff0000';
                    this.ctx.shadowBlur = 20;
                }

                this.ctx.fillText(fruit.emoji, 0, 0);
                this.ctx.shadowBlur = 0;
            }

            this.ctx.restore();
        });

        // Draw combo
        if (this.combo > 1) {
            this.ctx.font = 'bold 72px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 4;
            this.ctx.textAlign = 'center';
            const comboText = `COMBO x${this.combo}`;
            this.ctx.strokeText(comboText, this.canvas.width / 2, 80);
            this.ctx.fillText(comboText, this.canvas.width / 2, 80);
        }
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
    }

    updateLives() {
        const livesEl = document.getElementById('lives');
        livesEl.textContent = '❤️ '.repeat(Math.max(0, this.lives));
    }

    gameOver() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);

        setTimeout(() => {
            if (confirm(`GAME OVER!\n\nВаш счет: ${this.score}\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                window.close();
            }
        }, 500);
    }
}

// Start game when loaded
window.addEventListener('load', () => {
    new FruitSlashGame();
});
