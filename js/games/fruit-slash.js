// Fruit Slash - Slice flying fruits!
class FruitSlash {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.fruits = [];
        this.slices = [];
        this.score = 0;
        this.combo = 0;
        this.lives = 3;
        this.isRunning = false;

        this.fruitTypes = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🥝', '🍑', '🥭'];
        this.bombEmoji = '💣';

        this.spawnInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;

            // Create slice trail
            this.slices.push({
                x: touch.x,
                y: touch.y,
                time: Date.now(),
                color: `hsl(${Math.random() * 360}, 100%, 50%)`
            });

            // Check collision with fruits
            this.fruits.forEach(fruit => {
                if (fruit.sliced) return;

                const dx = touch.x - fruit.x;
                const dy = touch.y - fruit.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < fruit.radius + 20) {
                    this.sliceFruit(fruit, touch.x, touch.y);
                }
            });
        });
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.combo = 0;
        this.lives = 3;
        this.fruits = [];
        this.slices = [];

        this.gameHub.updateScore(this.score);

        // Spawn fruits regularly
        this.spawnInterval = setInterval(() => {
            this.spawnFruit();
        }, 800);

        // Start game loop
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    spawnFruit() {
        const isBomb = Math.random() < 0.15; // 15% chance of bomb

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

    sliceFruit(fruit, sliceX, sliceY) {
        fruit.sliced = true;

        if (fruit.isBomb) {
            // Hit bomb - lose all lives
            this.lives = 0;
            this.gameOver();

            // Create explosion effect
            if (this.gameHub.particleSystem) {
                this.gameHub.particleSystem.createExplosion(fruit.x, fruit.y, '#ff0000', 50);
            }

            // Shake screen
            this.canvas.style.animation = 'shake 0.5s';
            setTimeout(() => {
                this.canvas.style.animation = '';
            }, 500);

        } else {
            // Score points
            this.combo++;
            const points = 10 + (this.combo - 1) * 5;
            this.score += points;
            this.gameHub.updateScore(this.score);

            // Visual feedback
            if (this.gameHub.particleSystem) {
                this.gameHub.particleSystem.createExplosion(fruit.x, fruit.y, this.getColorForFruit(fruit.emoji), 30);

                if (this.combo > 3) {
                    this.gameHub.particleSystem.createComboText(
                        fruit.x - 50,
                        fruit.y - 50,
                        `COMBO x${this.combo}!`
                    );
                }
            }

            // Play sound
            this.gameHub.playSound('slice');

            // Vibrate
            if (navigator.vibrate && this.gameHub.settings.vibration) {
                navigator.vibrate(20);
            }
        }
    }

    getColorForFruit(emoji) {
        const colors = {
            '🍎': '#ff0000',
            '🍊': '#ff8800',
            '🍋': '#ffff00',
            '🍌': '#ffff88',
            '🍉': '#00ff00',
            '🍇': '#8800ff',
            '🍓': '#ff0044',
            '🥝': '#88ff00',
            '🍑': '#ffbb88',
            '🥭': '#ffaa00'
        };
        return colors[emoji] || '#ffd700';
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

            // Remove if off screen
            if (fruit.y > this.canvas.height + 100) {
                if (!fruit.sliced && !fruit.isBomb) {
                    // Missed a fruit
                    this.lives--;
                    this.combo = 0;

                    if (this.lives <= 0) {
                        this.gameOver();
                    }
                }
                this.fruits.splice(i, 1);
            }

            // Remove sliced fruits
            if (fruit.sliced && fruit.y > this.canvas.height + 100) {
                this.fruits.splice(i, 1);
            }
        }

        // Update slices (fade out)
        this.slices = this.slices.filter(slice => {
            return Date.now() - slice.time < 300;
        });
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f3460');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw slice trails
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';

        if (this.slices.length > 1) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.slices[0].x, this.slices[0].y);

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
                // Draw sliced fruit (split in half)
                this.ctx.globalAlpha = 0.5;
                this.ctx.font = `${fruit.radius * 2}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                // Left half
                this.ctx.save();
                this.ctx.translate(-15, 0);
                this.ctx.rotate(-0.3);
                this.ctx.fillText(fruit.emoji, 0, 0);
                this.ctx.restore();

                // Right half
                this.ctx.save();
                this.ctx.translate(15, 0);
                this.ctx.rotate(0.3);
                this.ctx.fillText(fruit.emoji, 0, 0);
                this.ctx.restore();

            } else {
                // Draw whole fruit
                this.ctx.font = `${fruit.radius * 2}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';

                // Glow effect for bombs
                if (fruit.isBomb) {
                    this.ctx.shadowColor = '#ff0000';
                    this.ctx.shadowBlur = 20;
                }

                this.ctx.fillText(fruit.emoji, 0, 0);
                this.ctx.shadowBlur = 0;
            }

            this.ctx.restore();
        });

        // Draw HUD
        this.drawHUD();
    }

    drawHUD() {
        // Lives
        this.ctx.font = '48px Arial';
        this.ctx.fillStyle = '#ff0000';
        this.ctx.textAlign = 'left';

        for (let i = 0; i < this.lives; i++) {
            this.ctx.fillText('❤️', 30 + i * 60, 50);
        }

        // Combo
        if (this.combo > 1) {
            this.ctx.font = 'bold 64px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 4;
            const comboText = `COMBO x${this.combo}`;
            this.ctx.strokeText(comboText, this.canvas.width / 2, 80);
            this.ctx.fillText(comboText, this.canvas.width / 2, 80);
        }
    }

    gameOver() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);

        // Save score
        ScoreManager.saveScore('fruit-slash', this.score);

        // Show game over screen
        setTimeout(() => {
            if (confirm(`GAME OVER!\n\nВаш счет: ${this.score}\n\nСыграть еще раз?`)) {
                this.start();
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    resize() {
        // Handle resize if needed
    }
}

// Add shake animation
if (!document.querySelector('#shake-animation')) {
    const style = document.createElement('style');
    style.id = 'shake-animation';
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
            20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
    `;
    document.head.appendChild(style);
}
