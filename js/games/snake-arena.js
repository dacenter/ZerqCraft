// Snake Arena - Snake PvP with side control panels
class SnakeArena {
    constructor(canvas, gameHub, playerCount, autoShoot = false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount;

        this.isRunning = false;
        this.snakes = [];
        this.food = [];
        this.controlPanels = [];

        this.playerColors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff00ff', '#00ffff'];

        this.gridSize = 20;
        this.gameSpeed = 100; // ms per move
        this.lastUpdate = 0;

        this.animationFrame = null;
        this.setupPlayers();
        this.createControlPanels();
        this.spawnFood();
    }

    setupPlayers() {
        const positions = [
            { x: 5, y: 5, dir: 2 },
            { x: 35, y: 5, dir: 2 },
            { x: 35, y: 25, dir: 0 },
            { x: 5, y: 25, dir: 0 },
            { x: 20, y: 5, dir: 2 },
            { x: 20, y: 25, dir: 0 }
        ];

        for (let i = 0; i < this.playerCount; i++) {
            const pos = positions[i];
            const snake = {
                id: i,
                body: [
                    { x: pos.x, y: pos.y },
                    { x: pos.x - 1, y: pos.y },
                    { x: pos.x - 2, y: pos.y }
                ],
                direction: pos.dir, // 0: up, 1: right, 2: down, 3: left
                nextDirection: pos.dir,
                color: this.playerColors[i],
                alive: true,
                score: 0,
                turnQueue: []
            };

            this.snakes.push(snake);
        }
    }

    createControlPanels() {
        const gameUI = document.getElementById('game-ui');
        gameUI.innerHTML = '';

        const panelWidth = 120;
        const spacing = (this.canvas.width - panelWidth * this.playerCount) / (this.playerCount + 1);

        for (let i = 0; i < this.playerCount; i++) {
            const panel = document.createElement('div');
            panel.className = 'control-panel';
            panel.style.left = `${spacing + i * (panelWidth + spacing)}px`;
            panel.style.bottom = '20px';

            // Player label
            const label = document.createElement('div');
            label.className = 'player-label-tag';
            label.textContent = `Игрок ${i + 1}`;
            label.style.backgroundColor = this.playerColors[i];
            panel.appendChild(label);

            // Left button (turn counter-clockwise)
            const leftBtn = document.createElement('button');
            leftBtn.className = 'control-btn left';
            leftBtn.innerHTML = '↺';
            leftBtn.addEventListener('click', () => this.turnSnake(i, -1));
            leftBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.turnSnake(i, -1);
            });
            panel.appendChild(leftBtn);

            // Right button (turn clockwise)
            const rightBtn = document.createElement('button');
            rightBtn.className = 'control-btn right';
            rightBtn.innerHTML = '↻';
            rightBtn.addEventListener('click', () => this.turnSnake(i, 1));
            rightBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.turnSnake(i, 1);
            });
            panel.appendChild(rightBtn);

            gameUI.appendChild(panel);
            this.controlPanels.push(panel);
        }
    }

    turnSnake(snakeId, turn) {
        const snake = this.snakes[snakeId];
        if (!snake.alive) return;

        // Turn: -1 = left (counter-clockwise), 1 = right (clockwise)
        let newDir = (snake.direction + turn + 4) % 4;

        // Prevent 180 degree turns
        if ((snake.direction + 2) % 4 !== newDir) {
            snake.nextDirection = newDir;
        }
    }

    spawnFood() {
        const maxX = Math.floor(this.canvas.width / this.gridSize);
        const maxY = Math.floor((this.canvas.height - 150) / this.gridSize);

        for (let i = this.food.length; i < 5; i++) {
            let foodPos;
            let attempts = 0;

            do {
                foodPos = {
                    x: Math.floor(Math.random() * (maxX - 2)) + 1,
                    y: Math.floor(Math.random() * (maxY - 2)) + 1
                };
                attempts++;
            } while (this.isFoodOnSnake(foodPos) && attempts < 50);

            if (attempts < 50) {
                this.food.push(foodPos);
            }
        }
    }

    isFoodOnSnake(foodPos) {
        for (let snake of this.snakes) {
            for (let segment of snake.body) {
                if (segment.x === foodPos.x && segment.y === foodPos.y) {
                    return true;
                }
            }
        }
        return false;
    }

    start() {
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameHub.updateScore('Длина: 3');
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

        // Clean up control panels
        const gameUI = document.getElementById('game-ui');
        gameUI.innerHTML = '';
    }

    gameLoop() {
        if (!this.isRunning) return;

        const now = Date.now();
        if (now - this.lastUpdate >= this.gameSpeed) {
            this.update();
            this.lastUpdate = now;
        }

        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        let aliveCount = 0;

        this.snakes.forEach(snake => {
            if (!snake.alive) return;
            aliveCount++;

            // Update direction
            snake.direction = snake.nextDirection;

            // Calculate new head position
            const head = { ...snake.body[0] };

            switch (snake.direction) {
                case 0: head.y--; break; // up
                case 1: head.x++; break; // right
                case 2: head.y++; break; // down
                case 3: head.x--; break; // left
            }

            // Check wall collision
            const maxX = Math.floor(this.canvas.width / this.gridSize);
            const maxY = Math.floor((this.canvas.height - 150) / this.gridSize);

            if (head.x < 0 || head.x >= maxX || head.y < 0 || head.y >= maxY) {
                snake.alive = false;
                this.gameHub.playSound('hit');
                return;
            }

            // Check self collision
            for (let i = 0; i < snake.body.length; i++) {
                if (head.x === snake.body[i].x && head.y === snake.body[i].y) {
                    snake.alive = false;
                    this.gameHub.playSound('hit');
                    return;
                }
            }

            // Check collision with other snakes
            for (let other of this.snakes) {
                if (other.id === snake.id || !other.alive) continue;

                for (let segment of other.body) {
                    if (head.x === segment.x && head.y === segment.y) {
                        snake.alive = false;
                        this.gameHub.playSound('hit');
                        return;
                    }
                }
            }

            // Add new head
            snake.body.unshift(head);

            // Check food collision
            let ateFood = false;
            for (let i = this.food.length - 1; i >= 0; i--) {
                if (head.x === this.food[i].x && head.y === this.food[i].y) {
                    this.food.splice(i, 1);
                    ateFood = true;
                    snake.score++;
                    this.gameHub.playSound('powerup');
                    this.spawnFood();
                    break;
                }
            }

            // Remove tail if didn't eat food
            if (!ateFood) {
                snake.body.pop();
            }
        });

        // Check if only one snake left
        if (aliveCount === 1) {
            this.endGame();
        } else if (aliveCount === 0) {
            this.endGame();
        }

        this.updateScore();
    }

    updateScore() {
        const lengths = this.snakes
            .filter(s => s.alive)
            .map(s => `Игрок ${s.id + 1}: ${s.body.length}`)
            .join(' | ');

        this.gameHub.updateScore(lengths || 'Игра окончена');
    }

    endGame() {
        this.isRunning = false;

        // Find winner (longest snake or last alive)
        const winner = this.snakes.reduce((best, snake) => {
            if (!best) return snake;
            if (snake.alive && !best.alive) return snake;
            if (snake.body.length > best.body.length) return snake;
            return best;
        }, null);

        const score = winner ? winner.body.length : 0;
        ScoreManager.saveScore('snake-arena', score);

        setTimeout(() => {
            if (confirm(`ИГРА ЗАВЕРШЕНА!\n\nПобедитель: Игрок ${winner.id + 1}\nДлина: ${score}\n\nСыграть еще раз?`)) {
                this.gameHub.showPlayerSelection('snake-arena');
            } else {
                this.gameHub.backToMenu();
            }
        }, 500);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background grid
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1;

        const maxX = Math.floor(this.canvas.width / this.gridSize);
        const maxY = Math.floor((this.canvas.height - 150) / this.gridSize);

        for (let x = 0; x <= maxX; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.gridSize, 0);
            this.ctx.lineTo(x * this.gridSize, maxY * this.gridSize);
            this.ctx.stroke();
        }

        for (let y = 0; y <= maxY; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.gridSize);
            this.ctx.lineTo(maxX * this.gridSize, y * this.gridSize);
            this.ctx.stroke();
        }

        // Draw food
        this.food.forEach(f => {
            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(
                f.x * this.gridSize + this.gridSize / 2,
                f.y * this.gridSize + this.gridSize / 2,
                this.gridSize / 2 - 2,
                0, Math.PI * 2
            );
            this.ctx.fill();
            this.ctx.stroke();
        });

        // Draw snakes
        this.snakes.forEach(snake => {
            if (!snake.alive) return;

            snake.body.forEach((segment, index) => {
                const alpha = index === 0 ? 1 : 1 - (index / snake.body.length) * 0.3;
                this.ctx.fillStyle = snake.color;
                this.ctx.globalAlpha = alpha;

                this.ctx.fillRect(
                    segment.x * this.gridSize + 1,
                    segment.y * this.gridSize + 1,
                    this.gridSize - 2,
                    this.gridSize - 2
                );

                // Draw head
                if (index === 0) {
                    this.ctx.fillStyle = 'white';
                    const centerX = segment.x * this.gridSize + this.gridSize / 2;
                    const centerY = segment.y * this.gridSize + this.gridSize / 2;

                    // Eyes based on direction
                    let eye1X, eye1Y, eye2X, eye2Y;
                    switch (snake.direction) {
                        case 0: // up
                            eye1X = centerX - 4; eye1Y = centerY - 3;
                            eye2X = centerX + 4; eye2Y = centerY - 3;
                            break;
                        case 1: // right
                            eye1X = centerX + 3; eye1Y = centerY - 4;
                            eye2X = centerX + 3; eye2Y = centerY + 4;
                            break;
                        case 2: // down
                            eye1X = centerX - 4; eye1Y = centerY + 3;
                            eye2X = centerX + 4; eye2Y = centerY + 3;
                            break;
                        case 3: // left
                            eye1X = centerX - 3; eye1Y = centerY - 4;
                            eye2X = centerX - 3; eye2Y = centerY + 4;
                            break;
                    }

                    this.ctx.fillRect(eye1X - 2, eye1Y - 2, 4, 4);
                    this.ctx.fillRect(eye2X - 2, eye2Y - 2, 4, 4);
                }
            });

            this.ctx.globalAlpha = 1;
        });

        // Draw player info
        this.snakes.forEach((snake, index) => {
            const x = 20 + index * 200;
            const y = this.canvas.height - 100;

            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = snake.color;
            this.ctx.fillText(`Игрок ${snake.id + 1}`, x, y);

            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(`Длина: ${snake.body.length}`, x, y + 25);

            if (!snake.alive) {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillText('💀 МЕРТВ', x, y + 50);
            }
        });
    }

    resize() {
        // Nothing special needed
    }
}
