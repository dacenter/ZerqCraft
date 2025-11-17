// Bubble Pop - Relaxing bubble popping game
class BubblePop {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.score = 0;
        this.combo = 0;

        this.bubbles = [];
        this.maxBubbles = 30;

        this.spawnInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;
            this.handleTouch(touch.x, touch.y);
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;
            this.handleTouch(touch.x, touch.y);
        });
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.combo = 0;
        this.bubbles = [];

        this.gameHub.updateScore(this.score);

        // Spawn initial bubbles
        for (let i = 0; i < 15; i++) {
            this.spawnBubble();
        }

        // Continuous spawning
        this.spawnInterval = setInterval(() => {
            if (this.bubbles.length < this.maxBubbles) {
                this.spawnBubble();
            }
        }, 1000);

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    spawnBubble() {
        const size = Math.random() * 60 + 40;

        const bubble = {
            x: Math.random() * (this.canvas.width - size * 2) + size,
            y: this.canvas.height + size,
            radius: size,
            vx: (Math.random() - 0.5) * 2,
            vy: -(Math.random() * 2 + 3),
            color: this.getRandomColor(),
            shimmer: Math.random() * Math.PI * 2,
            wobble: Math.random() * Math.PI * 2,
            popped: false,
            popProgress: 0
        };

        this.bubbles.push(bubble);
    }

    getRandomColor() {
        const colors = [
            'rgba(255, 107, 107, 0.6)',
            'rgba(78, 205, 196, 0.6)',
            'rgba(149, 225, 211, 0.6)',
            'rgba(243, 129, 129, 0.6)',
            'rgba(170, 150, 218, 0.6)',
            'rgba(252, 186, 211, 0.6)',
            'rgba(168, 216, 234, 0.6)',
            'rgba(255, 170, 165, 0.6)'
        ];

        return colors[Math.floor(Math.random() * colors.length)];
    }

    handleTouch(x, y) {
        let poppedCount = 0;

        this.bubbles.forEach(bubble => {
            if (bubble.popped) return;

            const dx = x - bubble.x;
            const dy = y - bubble.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < bubble.radius) {
                this.popBubble(bubble);
                poppedCount++;
            }
        });

        if (poppedCount > 0) {
            this.combo += poppedCount;
        }
    }

    popBubble(bubble) {
        bubble.popped = true;

        // Score
        const basePoints = Math.floor(bubble.radius / 2);
        const comboBonus = this.combo * 2;
        const points = basePoints + comboBonus;

        this.score += points;
        this.gameHub.updateScore(this.score);

        // Visual feedback
        if (this.gameHub.particleSystem) {
            this.gameHub.particleSystem.createExplosion(
                bubble.x,
                bubble.y,
                bubble.color.replace('0.6', '0.8'),
                Math.floor(bubble.radius / 3)
            );

            if (this.combo > 5) {
                this.gameHub.particleSystem.createComboText(
                    bubble.x - 50,
                    bubble.y - 50,
                    `x${this.combo} COMBO!`
                );
            }
        }

        this.gameHub.playSound('bubble-pop');

        if (navigator.vibrate && this.gameHub.settings.vibration) {
            navigator.vibrate(15);
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const bubble = this.bubbles[i];

            if (bubble.popped) {
                bubble.popProgress += 0.1;
                if (bubble.popProgress >= 1) {
                    this.bubbles.splice(i, 1);
                }
                continue;
            }

            // Movement
            bubble.x += bubble.vx;
            bubble.y += bubble.vy;

            // Wobble
            bubble.wobble += 0.05;
            bubble.shimmer += 0.1;

            // Bounce off walls
            if (bubble.x - bubble.radius < 0 || bubble.x + bubble.radius > this.canvas.width) {
                bubble.vx *= -1;
                bubble.x = Math.max(bubble.radius, Math.min(this.canvas.width - bubble.radius, bubble.x));
            }

            // Float up
            if (bubble.y + bubble.radius < 0) {
                // Bubble escaped - reset combo
                this.combo = Math.max(0, this.combo - 1);
                this.bubbles.splice(i, 1);
            }
        }
    }

    draw() {
        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(230, 240, 255, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#e6f0ff');
        gradient.addColorStop(1, '#c2e0ff');
        this.ctx.globalCompositeOperation = 'destination-over';
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'source-over';

        // Draw bubbles
        this.bubbles.forEach(bubble => {
            this.drawBubble(bubble);
        });

        // Draw combo
        if (this.combo > 3) {
            this.ctx.font = 'bold 64px Arial';
            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 5;
            this.ctx.textAlign = 'center';

            const comboText = `${this.combo}x COMBO!`;
            this.ctx.strokeText(comboText, this.canvas.width / 2, 80);
            this.ctx.fillText(comboText, this.canvas.width / 2, 80);
        }
    }

    drawBubble(bubble) {
        if (bubble.popped) {
            // Pop animation
            this.ctx.globalAlpha = 1 - bubble.popProgress;

            const scale = 1 + bubble.popProgress * 0.5;
            this.ctx.save();
            this.ctx.translate(bubble.x, bubble.y);
            this.ctx.scale(scale, scale);

            // Draw fragments
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 * i) / 6;
                const distance = bubble.radius * bubble.popProgress;

                this.ctx.fillStyle = bubble.color;
                this.ctx.beginPath();
                this.ctx.arc(
                    Math.cos(angle) * distance,
                    Math.sin(angle) * distance,
                    bubble.radius / 4,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }

            this.ctx.restore();
            this.ctx.globalAlpha = 1;
            return;
        }

        this.ctx.save();
        this.ctx.translate(bubble.x, bubble.y);

        // Wobble effect
        const wobbleX = Math.sin(bubble.wobble) * 5;
        const wobbleY = Math.cos(bubble.wobble * 1.3) * 3;
        this.ctx.translate(wobbleX, wobbleY);

        // Draw bubble
        const gradient = this.ctx.createRadialGradient(
            -bubble.radius / 3,
            -bubble.radius / 3,
            bubble.radius / 10,
            0,
            0,
            bubble.radius
        );

        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.3, bubble.color);
        gradient.addColorStop(1, bubble.color.replace('0.6', '0.3'));

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, bubble.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Highlight
        const highlightGradient = this.ctx.createRadialGradient(
            -bubble.radius / 4,
            -bubble.radius / 4,
            0,
            -bubble.radius / 4,
            -bubble.radius / 4,
            bubble.radius / 2
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.ctx.fillStyle = highlightGradient;
        this.ctx.beginPath();
        this.ctx.arc(-bubble.radius / 4, -bubble.radius / 4, bubble.radius / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // Shimmer
        const shimmerAlpha = (Math.sin(bubble.shimmer) + 1) / 2 * 0.3;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${shimmerAlpha})`;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, bubble.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, bubble.radius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.restore();
    }

    resize() {
        // Nothing special needed for resize
    }
}
