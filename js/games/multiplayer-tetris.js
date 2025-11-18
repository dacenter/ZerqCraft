// Multiplayer Tetris - Competitive Tetris for 2-6 players
class MultiplayerTetris {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;

        this.isRunning = false;
        this.players = [];
        this.currentPiece = null;
        this.nextPiece = null;

        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#2ecc71', '#e67e22'];

        this.cols = 10;
        this.rows = 20;
        this.cellSize = 0;

        this.dropSpeed = 1000; // Initial speed (ms)
        this.minDropSpeed = 100; // Max speed
        this.speedIncrease = 50; // Speed increase per level
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
            if (!this.isRunning || !this.currentPiece) return;

            // Determine which player's grid was touched
            this.players.forEach(player => {
                if (!player.alive) return;

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
            if (!this.isRunning || !this.currentPiece) return;

            const player = this.players.find(p => p.touchId === touch.id);
            if (player && player.alive) {
                const dx = touch.x - player.touchStartX;
                const dy = touch.y - player.touchStartY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // If moved more than 20 pixels, consider it dragging
                if (distance > 20) {
                    player.isDragging = true;

                    // Move piece left or right based on drag direction
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
                // If it was a tap (not drag), rotate the piece
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

        this.currentPiece = this.createPiece();
        this.nextPiece = this.createPiece();

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

    createPiece() {
        const pieces = [
            { shape: [[1,1,1,1]], color: '#00f0f0' }, // I
            { shape: [[1,1],[1,1]], color: '#f0f000' }, // O
            { shape: [[0,1,0],[1,1,1]], color: '#a000f0' }, // T
            { shape: [[1,1,0],[0,1,1]], color: '#00f000' }, // S
            { shape: [[0,1,1],[1,1,0]], color: '#f00000' }, // Z
            { shape: [[1,0,0],[1,1,1]], color: '#f0a000' }, // L
            { shape: [[0,0,1],[1,1,1]], color: '#0000f0' }  // J
        ];

        const piece = pieces[Math.floor(Math.random() * pieces.length)];
        return {
            shape: piece.shape,
            color: piece.color,
            x: Math.floor(this.cols / 2) - Math.floor(piece.shape[0].length / 2),
            y: 0
        };
    }

    gameLoop() {
        if (!this.isRunning) return;

        const now = Date.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        this.dropCounter += deltaTime;

        // Calculate speed based on average level
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length > 0) {
            const avgLevel = alivePlayers.reduce((sum, p) => sum + p.level, 0) / alivePlayers.length;
            this.dropSpeed = Math.max(this.minDropSpeed, 1000 - (avgLevel - 1) * this.speedIncrease);
        }

        if (this.dropCounter > this.dropSpeed) {
            this.dropCounter = 0;
            this.dropPiece();
        }

        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    dropPiece() {
        if (!this.currentPiece) return;

        const alivePlayers = this.players.filter(p => p.alive);

        alivePlayers.forEach(player => {
            if (this.canMove(player, 0, 1)) {
                this.currentPiece.y++;
            } else {
                this.lockPiece(player);
            }
        });
    }

    lockPiece(player) {
        if (!this.currentPiece) return;

        // Add piece to grid
        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col]) {
                    const gridY = this.currentPiece.y + row;
                    const gridX = this.currentPiece.x + col;

                    if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
                        player.grid[gridY][gridX] = this.currentPiece.color;
                    }
                }
            }
        }

        // Check for completed lines
        this.clearLines(player);

        // Check if all alive players locked the piece
        const allPlayersLocked = this.players.filter(p => p.alive).every(p => {
            return !this.canMove(p, 0, 1);
        });

        if (allPlayersLocked) {
            // Spawn new piece for all players
            this.currentPiece = {...this.nextPiece};
            this.nextPiece = this.createPiece();
            this.currentPiece.x = Math.floor(this.cols / 2) - Math.floor(this.currentPiece.shape[0].length / 2);
            this.currentPiece.y = 0;

            // Check if game over for any player
            this.players.filter(p => p.alive).forEach(p => {
                if (!this.canMove(p, 0, 0)) {
                    p.alive = false;
                    this.gameHub.playSound('hit');
                    this.checkGameOver();
                }
            });
        }

        this.updateScore();
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
                // Remove the line
                player.grid.splice(row, 1);
                // Add new empty line at top
                player.grid.unshift(new Array(this.cols).fill(0));
                linesCleared++;
                row++; // Check this row again
            }
        }

        if (linesCleared > 0) {
            player.lines += linesCleared;
            player.score += linesCleared * 100 * player.level;
            player.level = Math.floor(player.lines / this.linesForLevel) + 1;

            this.gameHub.playSound('powerup');
        }
    }

    canMove(player, offsetX, offsetY) {
        if (!this.currentPiece) return false;

        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col]) {
                    const newX = this.currentPiece.x + col + offsetX;
                    const newY = this.currentPiece.y + row + offsetY;

                    // Check boundaries
                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return false;
                    }

                    // Check collision with locked pieces
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
            this.currentPiece.x += offsetX;
            this.currentPiece.y += offsetY;
            return true;
        }
        return false;
    }

    rotatePiece(player) {
        if (!this.currentPiece) return;

        // Save current state
        const original = this.currentPiece.shape;

        // Rotate 90 degrees clockwise
        const rotated = [];
        for (let col = 0; col < original[0].length; col++) {
            const newRow = [];
            for (let row = original.length - 1; row >= 0; row--) {
                newRow.push(original[row][col]);
            }
            rotated.push(newRow);
        }

        // Try rotation
        this.currentPiece.shape = rotated;

        // Check if valid
        if (!this.canMove(player, 0, 0)) {
            // Try wall kick
            if (!this.canMove(player, 1, 0) && !this.canMove(player, -1, 0)) {
                // Rotation failed, revert
                this.currentPiece.shape = original;
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
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each player's grid
        this.players.forEach(player => {
            // Player label
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = player.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                player.name,
                player.gridX + (this.cols * this.cellSize) / 2,
                player.gridY - 80
            );

            // Score and level
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

            // Draw locked pieces
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

                        // Add border for 3D effect
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

            // Draw current piece
            if (this.currentPiece) {
                this.ctx.fillStyle = this.currentPiece.color;

                for (let row = 0; row < this.currentPiece.shape.length; row++) {
                    for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                        if (this.currentPiece.shape[row][col]) {
                            const x = player.gridX + (this.currentPiece.x + col) * this.cellSize + 1;
                            const y = player.gridY + (this.currentPiece.y + row) * this.cellSize + 1;

                            this.ctx.fillRect(x, y, this.cellSize - 2, this.cellSize - 2);

                            // Add border
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

        // Next piece preview (center)
        if (this.nextPiece) {
            const centerX = this.canvas.width / 2;
            const centerY = 50;

            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Следующая фигура:', centerX, centerY - 30);

            const previewSize = this.cellSize * 0.8;
            const previewX = centerX - (this.nextPiece.shape[0].length * previewSize) / 2;
            const previewY = centerY;

            this.ctx.fillStyle = this.nextPiece.color;

            for (let row = 0; row < this.nextPiece.shape.length; row++) {
                for (let col = 0; col < this.nextPiece.shape[row].length; col++) {
                    if (this.nextPiece.shape[row][col]) {
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
