// Multiplayer Tetris - Competitive Tetris for 2-6 players
class MultiplayerTetris {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;

        this.isRunning = false;
        this.players = [];
        this.currentPieceTemplate = null; // Общий шаблон фигуры
        this.nextPieceTemplate = null;

        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#2ecc71', '#e67e22'];

        this.cols = 10;
        this.rows = 20;
        this.cellSize = 0;

        this.dropSpeed = 1000;
        this.minDropSpeed = 100;
        this.speedIncrease = 50;
        this.linesForLevel = 10;

        this.dropCounter = 0;
        this.lastTime = 0;

        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);

        this.setupPlayers();
        this.setupTouchHandlers();
    }

    setupPlayers() {
        this.players = [];
        const gridWidth = Math.floor(this.canvas.width / this.playerCount);
        this.cellSize = Math.floor(gridWidth / (this.cols + 2));

        for (let i = 0; i < this.playerCount; i++) {
            const gridX = gridWidth * i + this.cellSize;
            const gridY = 150;

            this.players.push({
                id: i,
                name: `Игрок ${i + 1}`,
                color: this.playerColors[i],
                alive: true,
                score: 0,
                lines: 0,
                level: 1,
                gridX: gridX,
                gridY: gridY,
                grid: this.createGrid(),
                piece: null, // Своя позиция фигуры
                touchId: null,
                touchStartX: 0,
                touchStartY: 0,
                isDragging: false
            });
        }
    }

    createGrid() {
        const grid = [];
        for (let row = 0; row < this.rows; row++) {
            grid[row] = [];
            for (let col = 0; col < this.cols; col++) {
                grid[row][col] = 0;
            }
        }
        return grid;
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning || !this.currentPieceTemplate) return;

            // Определяем, в чьей зоне было нажатие
            this.players.forEach(player => {
                if (!player.alive || !player.piece) return;

                const touchInGrid = touch.x >= player.gridX &&
                                  touch.x <= player.gridX + this.cols * this.cellSize &&
                                  touch.y >= player.gridY &&
                                  touch.y <= player.gridY + this.rows * this.cellSize;

                if (touchInGrid && player.touchId === null) {
                    player.touchId = touch.id;
                    player.touchStartX = touch.x;
                    player.touchStartY = touch.y;
                    player.isDragging = false;
                }
            });
        });

        this.touchHandler.on('onTouchMove', (touch) => {
            if (!this.isRunning || !this.currentPieceTemplate) return;

            const player = this.players.find(p => p.touchId === touch.id);
            if (player && player.alive && player.piece) {
                const dx = touch.x - player.touchStartX;
                const dy = touch.y - player.touchStartY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 20) {
                    player.isDragging = true;

                    // Двигаем ТОЛЬКО фигуру этого игрока
                    if (Math.abs(dx) > Math.abs(dy)) {
                        if (dx > 0) {
                            this.movePiece(player, 1, 0);
                        } else {
                            this.movePiece(player, -1, 0);
                        }
                        player.touchStartX = touch.x;
                    }
                }
            }
        });

        this.touchHandler.on('onTouchEnd', (touch) => {
            const player = this.players.find(p => p.touchId === touch.id);
            if (player) {
                // Если это был тап (не перетаскивание), поворачиваем
                if (!player.isDragging) {
                    this.rotatePiece(player);
                }

                player.touchId = null;
                player.isDragging = false;
            }
        });
    }

    start() {
        this.isRunning = true;
        this.setupPlayers();

        this.currentPieceTemplate = this.createPieceTemplate();
        this.nextPieceTemplate = this.createPieceTemplate();

        // Даем каждому игроку свою копию фигуры с начальными координатами
        this.players.forEach(player => {
            if (player.alive) {
                player.piece = {
                    shape: JSON.parse(JSON.stringify(this.currentPieceTemplate.shape)),
                    color: this.currentPieceTemplate.color,
                    x: Math.floor(this.cols / 2) - Math.floor(this.currentPieceTemplate.shape[0].length / 2),
                    y: 0
                };
            }
        });

        this.dropCounter = 0;
        this.lastTime = Date.now();
        this.dropSpeed = 1000;

        this.updateScore();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.touchHandler.destroy();
    }

    createPieceTemplate() {
        const pieces = [
            { shape: [[1,1,1,1]], color: '#00f0f0' }, // I
            { shape: [[1,1],[1,1]], color: '#f0f000' }, // O
            { shape: [[0,1,0],[1,1,1]], color: '#a000f0' }, // T
            { shape: [[1,1,0],[0,1,1]], color: '#00f000' }, // S
            { shape: [[0,1,1],[1,1,0]], color: '#f00000' }, // Z
            { shape: [[1,0,0],[1,1,1]], color: '#f0a000' }, // L
            { shape: [[0,0,1],[1,1,1]], color: '#0000f0' }  // J
        ];

        return pieces[Math.floor(Math.random() * pieces.length)];
    }

    gameLoop() {
        if (!this.isRunning) return;

        const now = Date.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        this.dropCounter += deltaTime;

        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length > 0) {
            const avgLevel = alivePlayers.reduce((sum, p) => sum + p.level, 0) / alivePlayers.length;
            this.dropSpeed = Math.max(this.minDropSpeed, 1000 - (avgLevel - 1) * this.speedIncrease);
        }

        if (this.dropCounter > this.dropSpeed) {
            this.dropCounter = 0;
            this.dropAllPieces();
        }

        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    dropAllPieces() {
        if (!this.currentPieceTemplate) return;

        let allLocked = true;

        this.players.forEach(player => {
            if (!player.alive || !player.piece) return;

            if (this.canMove(player, 0, 1)) {
                player.piece.y++;
                allLocked = false;
            } else {
                this.lockPiece(player);
            }
        });

        // Если все живые игроки заблокировали фигуру, создаем новую для всех
        if (allLocked) {
            this.spawnNewPiece();
        }
    }

    spawnNewPiece() {
        this.currentPieceTemplate = this.nextPieceTemplate;
        this.nextPieceTemplate = this.createPieceTemplate();

        this.players.forEach(player => {
            if (player.alive) {
                player.piece = {
                    shape: JSON.parse(JSON.stringify(this.currentPieceTemplate.shape)),
                    color: this.currentPieceTemplate.color,
                    x: Math.floor(this.cols / 2) - Math.floor(this.currentPieceTemplate.shape[0].length / 2),
                    y: 0
                };

                // Проверка game over
                if (!this.canMove(player, 0, 0)) {
                    player.alive = false;
                    this.gameHub.playSound('hit');
                    this.checkGameOver();
                }
            }
        });
    }

    lockPiece(player) {
        if (!player.piece) return;

        // Добавляем фигуру в grid игрока
        for (let row = 0; row < player.piece.shape.length; row++) {
            for (let col = 0; col < player.piece.shape[row].length; col++) {
                if (player.piece.shape[row][col]) {
                    const gridY = player.piece.y + row;
                    const gridX = player.piece.x + col;

                    if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
                        player.grid[gridY][gridX] = player.piece.color;
                    }
                }
            }
        }

        // Проверяем линии
        this.clearLines(player);
    }

    clearLines(player) {
        let linesCleared = 0;

        for (let row = this.rows - 1; row >= 0; row--) {
            let isFull = true;

            for (let col = 0; col < this.cols; col++) {
                if (!player.grid[row][col]) {
                    isFull = false;
                    break;
                }
            }

            if (isFull) {
                player.grid.splice(row, 1);
                player.grid.unshift(new Array(this.cols).fill(0));
                linesCleared++;
                row++;
            }
        }

        if (linesCleared > 0) {
            player.lines += linesCleared;
            player.score += linesCleared * 100 * player.level;
            player.level = Math.floor(player.lines / this.linesForLevel) + 1;

            this.gameHub.playSound('powerup');
        }

        this.updateScore();
    }

    canMove(player, offsetX, offsetY) {
        if (!player.piece) return false;

        for (let row = 0; row < player.piece.shape.length; row++) {
            for (let col = 0; col < player.piece.shape[row].length; col++) {
                if (player.piece.shape[row][col]) {
                    const newX = player.piece.x + col + offsetX;
                    const newY = player.piece.y + row + offsetY;

                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return false;
                    }

                    if (newY >= 0 && player.grid[newY][newX]) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    movePiece(player, offsetX, offsetY) {
        if (this.canMove(player, offsetX, offsetY)) {
            player.piece.x += offsetX;
            player.piece.y += offsetY;
            return true;
        }
        return false;
    }

    rotatePiece(player) {
        if (!player.piece) return;

        const original = player.piece.shape;

        // Поворот на 90 градусов по часовой стрелке
        const rotated = [];
        for (let col = 0; col < original[0].length; col++) {
            const newRow = [];
            for (let row = original.length - 1; row >= 0; row--) {
                newRow.push(original[row][col]);
            }
            rotated.push(newRow);
        }

        player.piece.shape = rotated;

        // Проверка валидности
        if (!this.canMove(player, 0, 0)) {
            // Пробуем wall kick
            if (!this.canMove(player, 1, 0) && !this.canMove(player, -1, 0)) {
                // Откат
                player.piece.shape = original;
                return;
            }
        }

        this.gameHub.playSound('shoot');
    }

    checkGameOver() {
        const alivePlayers = this.players.filter(p => p.alive);

        if (alivePlayers.length <= 1) {
            this.endGame();
        }
    }

    endGame() {
        this.isRunning = false;

        const winner = this.players.reduce((best, player) => {
            if (!best || player.score > best.score) return player;
            return best;
        }, null);

        if (winner) {
            ScoreManager.saveScore('multiplayer-tetris', winner.score);
        }

        setTimeout(() => {
            const scoreStr = this.players
                .map(p => `${p.name}: ${p.score} (${p.lines} линий)`)
                .join('\n');

            const message = `🎮 ТЕТРИС ЗАВЕРШЁН!\n\nПобедитель: ${winner ? winner.name : 'Никто'}\n\n${scoreStr}\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.gameHub.showPlayerSelection('multiplayer-tetris');
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    updateScore() {
        const aliveCount = this.players.filter(p => p.alive).length;
        const scores = this.players
            .map(p => `П${p.id + 1}: ${p.score}${p.alive ? '' : '💀'}`)
            .join(' | ');

        this.gameHub.updateScore(`${scores} | Живых: ${aliveCount}`);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем каждого игрока
        this.players.forEach(player => {
            // Имя и статистика
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = player.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                player.name,
                player.gridX + (this.cols * this.cellSize) / 2,
                player.gridY - 80
            );

            this.ctx.font = 'bold 18px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(
                `${player.score}`,
                player.gridX + (this.cols * this.cellSize) / 2,
                player.gridY - 55
            );

            this.ctx.font = '16px Arial';
            this.ctx.fillText(
                `Линий: ${player.lines} | Lvl ${player.level}`,
                player.gridX + (this.cols * this.cellSize) / 2,
                player.gridY - 30
            );

            // Grid background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(
                player.gridX,
                player.gridY,
                this.cols * this.cellSize,
                this.rows * this.cellSize
            );

            // Grid lines
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.lineWidth = 1;

            for (let row = 0; row <= this.rows; row++) {
                this.ctx.beginPath();
                this.ctx.moveTo(player.gridX, player.gridY + row * this.cellSize);
                this.ctx.lineTo(player.gridX + this.cols * this.cellSize, player.gridY + row * this.cellSize);
                this.ctx.stroke();
            }

            for (let col = 0; col <= this.cols; col++) {
                this.ctx.beginPath();
                this.ctx.moveTo(player.gridX + col * this.cellSize, player.gridY);
                this.ctx.lineTo(player.gridX + col * this.cellSize, player.gridY + this.rows * this.cellSize);
                this.ctx.stroke();
            }

            if (!player.alive) {
                // Game over overlay
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(
                    player.gridX,
                    player.gridY,
                    this.cols * this.cellSize,
                    this.rows * this.cellSize
                );

                this.ctx.font = 'bold 32px Arial';
                this.ctx.fillStyle = '#ff0000';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    '💀',
                    player.gridX + (this.cols * this.cellSize) / 2,
                    player.gridY + (this.rows * this.cellSize) / 2
                );

                return;
            }

            // Locked pieces
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    if (player.grid[row][col]) {
                        this.ctx.fillStyle = player.grid[row][col];
                        this.ctx.fillRect(
                            player.gridX + col * this.cellSize + 1,
                            player.gridY + row * this.cellSize + 1,
                            this.cellSize - 2,
                            this.cellSize - 2
                        );

                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeRect(
                            player.gridX + col * this.cellSize + 1,
                            player.gridY + row * this.cellSize + 1,
                            this.cellSize - 2,
                            this.cellSize - 2
                        );
                    }
                }
            }

            // Current piece ЭТОГО игрока
            if (player.piece) {
                this.ctx.fillStyle = player.piece.color;

                for (let row = 0; row < player.piece.shape.length; row++) {
                    for (let col = 0; col < player.piece.shape[row].length; col++) {
                        if (player.piece.shape[row][col]) {
                            const x = player.gridX + (player.piece.x + col) * this.cellSize + 1;
                            const y = player.gridY + (player.piece.y + row) * this.cellSize + 1;

                            this.ctx.fillRect(x, y, this.cellSize - 2, this.cellSize - 2);

                            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                            this.ctx.lineWidth = 2;
                            this.ctx.strokeRect(x, y, this.cellSize - 2, this.cellSize - 2);
                        }
                    }
                }
            }

            // Touch hint
            if (player.touchId === null) {
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    '👆 Коснись = поворот',
                    player.gridX + (this.cols * this.cellSize) / 2,
                    player.gridY + this.rows * this.cellSize + 20
                );
                this.ctx.fillText(
                    '☝️ Зажми = двигай',
                    player.gridX + (this.cols * this.cellSize) / 2,
                    player.gridY + this.rows * this.cellSize + 40
                );
            }
        });

        // Next piece preview
        if (this.nextPieceTemplate) {
            const centerX = this.canvas.width / 2;
            const centerY = 50;

            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Следующая фигура:', centerX, centerY - 30);

            const previewSize = this.cellSize * 0.8;
            const previewX = centerX - (this.nextPieceTemplate.shape[0].length * previewSize) / 2;
            const previewY = centerY;

            this.ctx.fillStyle = this.nextPieceTemplate.color;

            for (let row = 0; row < this.nextPieceTemplate.shape.length; row++) {
                for (let col = 0; col < this.nextPieceTemplate.shape[row].length; col++) {
                    if (this.nextPieceTemplate.shape[row][col]) {
                        const x = previewX + col * previewSize;
                        const y = previewY + row * previewSize;

                        this.ctx.fillRect(x, y, previewSize - 2, previewSize - 2);
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeRect(x, y, previewSize - 2, previewSize - 2);
                    }
                }
            }
        }
    }

    resize() {
        this.setupPlayers();
    }
}
