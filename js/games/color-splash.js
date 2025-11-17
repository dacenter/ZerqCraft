// Color Splash - Creative painting and color mixing game
class ColorSplash {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.mode = 'freestyle'; // 'freestyle' or 'challenge'

        this.colors = [
            { name: 'Красный', hex: '#ff0000', emoji: '🔴' },
            { name: 'Синий', hex: '#0000ff', emoji: '🔵' },
            { name: 'Желтый', hex: '#ffff00', emoji: '🟡' },
            { name: 'Зеленый', hex: '#00ff00', emoji: '🟢' },
            { name: 'Оранжевый', hex: '#ff8800', emoji: '🟠' },
            { name: 'Фиолетовый', hex: '#8800ff', emoji: '🟣' },
            { name: 'Розовый', hex: '#ff69b4', emoji: '💗' },
            { name: 'Голубой', hex: '#00ffff', emoji: '💙' }
        ];

        this.currentColor = this.colors[0].hex;
        this.brushSize = 30;
        this.splashes = [];
        this.particles = [];

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
        this.createUI();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;
            this.addSplash(touch.x, touch.y, touch.id);
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning) return;
            this.addSplash(touch.x, touch.y, touch.id);
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            // Create final burst
            if (this.isRunning) {
                this.createBurst(touch.x, touch.y);
            }
        });
    }

    createUI() {
        const gameUI = document.getElementById('game-ui');

        // Color palette
        const palette = document.createElement('div');
        palette.style.cssText = `
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 20px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;

        this.colors.forEach(color => {
            const btn = document.createElement('button');
            btn.textContent = color.emoji;
            btn.style.cssText = `
                width: 80px;
                height: 80px;
                font-size: 48px;
                border: 4px solid ${color.hex};
                border-radius: 50%;
                background: white;
                cursor: pointer;
                transition: all 0.2s;
            `;

            btn.addEventListener('click', () => {
                this.currentColor = color.hex;
                // Update all buttons
                palette.querySelectorAll('button').forEach(b => {
                    b.style.background = 'white';
                    b.style.transform = 'scale(1)';
                });
                btn.style.background = color.hex;
                btn.style.transform = 'scale(1.2)';
            });

            palette.appendChild(btn);
        });

        gameUI.appendChild(palette);

        // Tool buttons
        const tools = document.createElement('div');
        tools.style.cssText = `
            position: absolute;
            top: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;

        // Clear button
        const clearBtn = this.createToolButton('🗑️', 'Очистить');
        clearBtn.addEventListener('click', () => this.clear());
        tools.appendChild(clearBtn);

        // Brush size buttons
        const smallBrush = this.createToolButton('⚪', 'Малая');
        smallBrush.addEventListener('click', () => {
            this.brushSize = 15;
            this.updateBrushButtons(tools, smallBrush);
        });
        tools.appendChild(smallBrush);

        const mediumBrush = this.createToolButton('🔵', 'Средняя');
        mediumBrush.addEventListener('click', () => {
            this.brushSize = 30;
            this.updateBrushButtons(tools, mediumBrush);
        });
        mediumBrush.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        tools.appendChild(mediumBrush);

        const largeBrush = this.createToolButton('🔴', 'Большая');
        largeBrush.addEventListener('click', () => {
            this.brushSize = 60;
            this.updateBrushButtons(tools, largeBrush);
        });
        tools.appendChild(largeBrush);

        // Rainbow mode
        const rainbowBtn = this.createToolButton('🌈', 'Радуга');
        rainbowBtn.addEventListener('click', () => {
            this.currentColor = 'rainbow';
            rainbowBtn.style.transform = 'scale(1.2)';
            setTimeout(() => rainbowBtn.style.transform = 'scale(1)', 200);
        });
        tools.appendChild(rainbowBtn);

        gameUI.appendChild(tools);
    }

    createToolButton(emoji, label) {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.title = label;
        btn.style.cssText = `
            width: 80px;
            height: 80px;
            font-size: 40px;
            border: none;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            transition: all 0.2s;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
        });

        return btn;
    }

    updateBrushButtons(container, activeBtn) {
        container.querySelectorAll('button').forEach((btn, index) => {
            if (index >= 1 && index <= 3) { // Brush size buttons
                btn.style.background = 'white';
            }
        });
        activeBtn.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }

    start() {
        this.isRunning = true;
        this.clear();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    clear() {
        this.splashes = [];
        this.particles = [];
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    addSplash(x, y, touchId) {
        const color = this.currentColor === 'rainbow'
            ? `hsl(${Date.now() % 360}, 100%, 50%)`
            : this.currentColor;

        this.splashes.push({
            x, y,
            color,
            size: this.brushSize,
            alpha: 0.7,
            touchId
        });

        // Add particles
        if (Math.random() < 0.3) {
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    x,
                    y,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    color,
                    size: Math.random() * 10 + 5,
                    life: 1
                });
            }
        }
    }

    createBurst(x, y) {
        const color = this.currentColor === 'rainbow'
            ? `hsl(${Date.now() % 360}, 100%, 50%)`
            : this.currentColor;

        // Create large splash
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const distance = this.brushSize * 2;
            this.splashes.push({
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                color,
                size: this.brushSize * 0.5,
                alpha: 0.5
            });
        }

        // Create particles
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 15 + 5;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: Math.random() * 15 + 5,
                life: 1
            });
        }

        this.gameHub.playSound('splash');
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // Gravity
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        // Don't clear canvas - we want painting to persist

        // Draw new splashes
        this.splashes.forEach(splash => {
            this.ctx.globalAlpha = splash.alpha;

            // Gradient splash
            const gradient = this.ctx.createRadialGradient(
                splash.x, splash.y, 0,
                splash.x, splash.y, splash.size
            );
            gradient.addColorStop(0, splash.color);
            gradient.addColorStop(0.5, splash.color);
            gradient.addColorStop(1, 'transparent');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(splash.x, splash.y, splash.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.globalAlpha = 1;

        // Clear splashes after drawing
        this.splashes = [];

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        this.ctx.globalAlpha = 1;
    }

    resize() {
        // Save current canvas
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Resize will be handled by main
        setTimeout(() => {
            this.ctx.putImageData(imageData, 0, 0);
        }, 0);
    }
}
