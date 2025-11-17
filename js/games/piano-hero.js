// Piano Hero - Musical rhythm game
class PianoHero {
    constructor(canvas, gameHub) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;

        this.isRunning = false;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;

        // Game settings
        this.lanes = 4;
        this.tileSpeed = 5;
        this.tiles = [];
        this.laneWidth = 0;

        this.colors = ['#ff6b6b', '#4ecdc4', '#95e1d3', '#f38181'];
        this.notes = ['C', 'D', 'E', 'F'];

        this.hitZoneY = 0;
        this.hitZoneHeight = 80;

        this.spawnInterval = null;
        this.animationFrame = null;

        this.touchHandler = new TouchHandler(canvas);
        this.setupTouchHandlers();
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning) return;

            const lane = this.getTouchLane(touch.x);
            if (lane !== -1) {
                this.hitLane(lane, touch.y);
            }
        });
    }

    getTouchLane(x) {
        const lane = Math.floor(x / this.laneWidth);
        return lane >= 0 && lane < this.lanes ? lane : -1;
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.tiles = [];

        this.laneWidth = this.canvas.width / this.lanes;
        this.hitZoneY = this.canvas.height - 150;

        this.gameHub.updateScore(this.score);

        // Spawn tiles
        this.spawnInterval = setInterval(() => {
            this.spawnTile();
        }, 600);

        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    spawnTile() {
        const lane = Math.floor(Math.random() * this.lanes);

        this.tiles.push({
            lane,
            y: -100,
            height: 80,
            color: this.colors[lane],
            hit: false,
            missed: false
        });
    }

    hitLane(lane, touchY) {
        // Find tile in hit zone
        let hitTile = null;
        let bestDistance = Infinity;

        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];

            if (tile.lane === lane && !tile.hit && !tile.missed) {
                const tileCenter = tile.y + tile.height / 2;
                const hitCenter = this.hitZoneY + this.hitZoneHeight / 2;
                const distance = Math.abs(tileCenter - hitCenter);

                if (distance < bestDistance && distance < 100) {
                    bestDistance = distance;
                    hitTile = tile;
                }
            }
        }

        if (hitTile) {
            hitTile.hit = true;

            // Calculate score based on accuracy
            let points = 0;
            let accuracy = '';

            if (bestDistance < 30) {
                points = 100;
                accuracy = 'PERFECT!';
                this.combo++;
            } else if (bestDistance < 60) {
                points = 50;
                accuracy = 'GREAT!';
                this.combo++;
            } else {
                points = 25;
                accuracy = 'OK';
                this.combo++;
            }

            // Combo bonus
            if (this.combo > 1) {
                points += this.combo * 5;
            }

            this.score += points;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.gameHub.updateScore(this.score);

            // Visual feedback
            this.showAccuracy(lane, accuracy, points);

            if (this.gameHub.particleSystem) {
                this.gameHub.particleSystem.createExplosion(
                    (lane + 0.5) * this.laneWidth,
                    this.hitZoneY + this.hitZoneHeight / 2,
                    this.colors[lane],
                    20
                );
            }

            this.gameHub.playSound('piano-note');

            if (navigator.vibrate && this.gameHub.settings.vibration) {
                navigator.vibrate(10);
            }
        } else {
            // Missed - break combo
            if (this.combo > 0) {
                this.combo = 0;
                this.showAccuracy(lane, 'MISS!', 0);
            }
        }
    }

    showAccuracy(lane, text, points) {
        const x = (lane + 0.5) * this.laneWidth;
        const y = this.hitZoneY;

        const element = document.createElement('div');
        element.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: 900;
            color: ${text === 'MISS!' ? '#ff0000' : '#ffd700'};
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
            animation: accuracyFade 1s ease-out forwards;
            pointer-events: none;
            z-index: 1000;
        `;
        element.textContent = `${text}\n+${points}`;

        document.body.appendChild(element);
        setTimeout(() => element.remove(), 1000);
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        // Update tiles
        for (let i = this.tiles.length - 1; i >= 0; i--) {
            const tile = this.tiles[i];

            if (!tile.hit) {
                tile.y += this.tileSpeed;

                // Check if missed
                if (tile.y > this.hitZoneY + this.hitZoneHeight && !tile.missed) {
                    tile.missed = true;
                    this.combo = 0;
                }
            }

            // Remove off-screen tiles
            if (tile.y > this.canvas.height + 100) {
                this.tiles.splice(i, 1);
            }
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw lanes
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;

        for (let i = 1; i < this.lanes; i++) {
            const x = i * this.laneWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Draw tiles
        this.tiles.forEach(tile => {
            if (tile.hit) {
                // Fade out hit tiles
                this.ctx.globalAlpha = 0.3;
            } else if (tile.missed) {
                this.ctx.globalAlpha = 0.5;
            }

            const x = tile.lane * this.laneWidth;

            // Glow effect
            this.ctx.shadowColor = tile.color;
            this.ctx.shadowBlur = 20;

            // Tile gradient
            const tileGradient = this.ctx.createLinearGradient(
                x, tile.y,
                x + this.laneWidth, tile.y + tile.height
            );
            tileGradient.addColorStop(0, tile.color);
            tileGradient.addColorStop(1, this.darkenColor(tile.color));

            this.ctx.fillStyle = tileGradient;
            this.ctx.fillRect(x + 5, tile.y, this.laneWidth - 10, tile.height);

            // Border
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x + 5, tile.y, this.laneWidth - 10, tile.height);

            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;
        });

        // Draw hit zone
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(0, this.hitZoneY, this.canvas.width, this.hitZoneHeight);

        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 5;
        this.ctx.strokeRect(0, this.hitZoneY, this.canvas.width, this.hitZoneHeight);

        // Draw lane indicators in hit zone
        for (let i = 0; i < this.lanes; i++) {
            const x = (i + 0.5) * this.laneWidth;
            const y = this.hitZoneY + this.hitZoneHeight / 2;

            this.ctx.fillStyle = this.colors[i];
            this.ctx.globalAlpha = 0.3;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 30, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;

            // Note label
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.notes[i], x, y);
        }

        // Draw combo
        if (this.combo > 1) {
            this.ctx.font = 'bold 72px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 5;
            this.ctx.textAlign = 'center';

            const comboText = `${this.combo}x COMBO!`;
            this.ctx.strokeText(comboText, this.canvas.width / 2, 100);
            this.ctx.fillText(comboText, this.canvas.width / 2, 100);
        }
    }

    darkenColor(color) {
        // Simple color darkening
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    resize() {
        this.laneWidth = this.canvas.width / this.lanes;
        this.hitZoneY = this.canvas.height - 150;
    }
}

// Add accuracy animation
if (!document.querySelector('#accuracy-animation')) {
    const style = document.createElement('style');
    style.id = 'accuracy-animation';
    style.textContent = `
        @keyframes accuracyFade {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(0); }
            50% { opacity: 1; transform: translate(-50%, -100%) scale(1.2); }
            100% { opacity: 0; transform: translate(-50%, -150%) scale(0.8); }
        }
    `;
    document.head.appendChild(style);
}
