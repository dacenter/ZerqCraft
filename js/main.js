// Main Game Hub Controller
class GameHub {
    constructor() {
        this.currentGame = null;
        this.currentScreen = 'main-menu';
        this.pendingGameName = null; // For games requiring player selection
        this.settings = {
            volume: 70,
            music: 50,
            vibration: true
        };

        // Games that require player count selection
        this.multiplayerGames = ['race-track-pro', 'battle-tanks', 'snake-arena', 'ship-battle'];

        this.init();
    }

    init() {
        // Load settings from localStorage
        this.loadSettings();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize particle system
        if (window.ParticleSystem) {
            this.particleSystem = new ParticleSystem();
        }

        // Prevent default touch behaviors
        document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gesturestart', (e) => e.preventDefault());

        console.log('🎮 ZerqCraft Gaming Hub Initialized!');
    }

    setupEventListeners() {
        // Game card clicks
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const gameName = card.dataset.game;
                this.startGame(gameName);
                this.createTouchFeedback(e.pageX, e.pageY);
            });

            // Touch feedback
            card.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                this.createTouchFeedback(touch.pageX, touch.pageY);
            });
        });

        // Back button
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => this.backToMenu());
        });

        // Settings button
        document.querySelector('.btn-settings').addEventListener('click', () => {
            this.showScreen('settings-screen');
        });

        // Leaderboard button
        document.querySelector('.btn-leaderboard').addEventListener('click', () => {
            this.showScreen('leaderboard-screen');
            this.updateLeaderboard();
        });

        // Back to menu buttons
        document.querySelectorAll('.btn-back-menu').forEach(btn => {
            btn.addEventListener('click', () => this.showScreen('main-menu'));
        });

        // Settings controls
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.settings.volume = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('music-slider').addEventListener('input', (e) => {
            this.settings.music = parseInt(e.target.value);
            this.saveSettings();
        });

        document.getElementById('vibration-toggle').addEventListener('change', (e) => {
            this.settings.vibration = e.target.checked;
            this.saveSettings();
        });

        // Player count selection buttons
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerCount = parseInt(btn.dataset.players);
                if (this.pendingGameName) {
                    this.startGame(this.pendingGameName, playerCount);
                }
                this.createTouchFeedback(e.pageX, e.pageY);
            });
        });
    }

    startGame(gameName, playerCount = null) {
        console.log(`🎮 Starting game: ${gameName}`, playerCount ? `with ${playerCount} players` : '');

        // Check if this game requires player selection
        if (this.multiplayerGames.includes(gameName) && playerCount === null) {
            this.showPlayerSelection(gameName);
            return;
        }

        // Stop current game if any
        if (this.currentGame && this.currentGame.stop) {
            this.currentGame.stop();
        }

        // Show game screen
        this.showScreen('game-container');

        // Initialize the game
        const canvas = document.getElementById('game-canvas');
        const gameUI = document.getElementById('game-ui');
        const gameTitle = document.getElementById('game-title');

        // Clear previous game UI
        gameUI.innerHTML = '';

        // Set canvas size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 120;

        // Start the appropriate game
        switch(gameName) {
            case 'fruit-slash':
                gameTitle.textContent = '🍎 FRUIT SLASH';
                this.currentGame = new FruitSlash(canvas, this);
                break;
            case 'air-hockey':
                gameTitle.textContent = '🏒 AIR HOCKEY';
                this.currentGame = new AirHockey(canvas, this);
                break;
            case 'color-splash':
                gameTitle.textContent = '🎨 COLOR SPLASH';
                this.currentGame = new ColorSplash(canvas, this);
                break;
            case 'piano-hero':
                gameTitle.textContent = '🎹 PIANO HERO';
                this.currentGame = new PianoHero(canvas, this);
                break;
            case 'memory-match':
                gameTitle.textContent = '🧩 MEMORY MATCH';
                this.currentGame = new MemoryMatch(canvas, this);
                break;
            case 'whack-a-mole':
                gameTitle.textContent = '🔨 WHACK-A-MOLE';
                this.currentGame = new WhackAMole(canvas, this);
                break;
            case 'bubble-pop':
                gameTitle.textContent = '🫧 BUBBLE POP';
                this.currentGame = new BubblePop(canvas, this);
                break;
            case 'space-defender':
                gameTitle.textContent = '🚀 SPACE DEFENDER';
                this.currentGame = new SpaceDefender(canvas, this);
                break;
            case 'tower-battle':
                gameTitle.textContent = '🏰 TOWER BATTLE';
                this.currentGame = new TowerBattle(canvas, this);
                break;
            case 'paintball-arena':
                gameTitle.textContent = '🎯 PAINTBALL ARENA';
                this.currentGame = new PaintballArena(canvas, this);
                break;
            case 'racing-madness':
                gameTitle.textContent = '🏎️ RACING MADNESS';
                this.currentGame = new RacingMadness(canvas, this);
                break;
            case 'food-fight':
                gameTitle.textContent = '🍕 FOOD FIGHT';
                this.currentGame = new FoodFight(canvas, this);
                break;
            case 'race-track-pro':
                gameTitle.textContent = '🏁 RACE TRACK PRO';
                this.currentGame = new RaceTrackPro(canvas, this, playerCount);
                break;
            case 'battle-tanks':
                gameTitle.textContent = '🎖️ BATTLE TANKS';
                this.currentGame = new BattleTanks(canvas, this, playerCount);
                break;
            case 'snake-arena':
                gameTitle.textContent = '🐍 SNAKE ARENA';
                this.currentGame = new SnakeArena(canvas, this, playerCount);
                break;
            case 'ship-battle':
                gameTitle.textContent = '⚓ SHIP BATTLE';
                this.currentGame = new ShipBattle(canvas, this, playerCount);
                break;
        }

        if (this.currentGame && this.currentGame.start) {
            this.currentGame.start();
        }
    }

    showPlayerSelection(gameName) {
        this.pendingGameName = gameName;

        // Update title based on game
        const titles = {
            'race-track-pro': '🏁 RACE TRACK PRO',
            'battle-tanks': '🎖️ BATTLE TANKS',
            'snake-arena': '🐍 SNAKE ARENA',
            'ship-battle': '⚓ SHIP BATTLE'
        };

        const title = titles[gameName] || '🎮 ВЫБЕРИТЕ КОЛИЧЕСТВО ИГРОКОВ';
        document.getElementById('selection-game-title').textContent = `${title} - ВЫБЕРИТЕ ИГРОКОВ`;

        this.showScreen('player-selection');
    }

    backToMenu() {
        if (this.currentGame && this.currentGame.stop) {
            this.currentGame.stop();
        }
        this.currentGame = null;
        this.pendingGameName = null;
        this.showScreen('main-menu');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }

    updateScore(score) {
        document.getElementById('score').textContent = score;
    }

    createTouchFeedback(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'touch-ripple';
        ripple.style.left = (x - 100) + 'px';
        ripple.style.top = (y - 100) + 'px';
        document.body.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);

        // Haptic feedback
        if (this.settings.vibration && navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    playSound(soundName) {
        if (this.settings.volume === 0) return;

        // Sound playing logic (will be implemented with actual sound files)
        console.log(`🔊 Playing sound: ${soundName}`);
    }

    updateLeaderboard() {
        const content = document.getElementById('leaderboard-content');
        const scores = ScoreManager.getAllScores();

        content.innerHTML = '';

        Object.keys(scores).forEach(game => {
            const gameScores = scores[game];
            if (gameScores.length === 0) return;

            const gameSection = document.createElement('div');
            gameSection.style.marginBottom = '40px';

            const gameTitle = document.createElement('h3');
            gameTitle.textContent = this.getGameTitle(game);
            gameTitle.style.fontSize = '42px';
            gameTitle.style.color = '#667eea';
            gameTitle.style.marginBottom = '20px';
            gameSection.appendChild(gameTitle);

            gameScores.forEach((score, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';

                if (index === 0) item.classList.add('gold');
                else if (index === 1) item.classList.add('silver');
                else if (index === 2) item.classList.add('bronze');

                const position = document.createElement('span');
                position.textContent = `#${index + 1}`;

                const scoreSpan = document.createElement('span');
                scoreSpan.textContent = score.score;

                item.appendChild(position);
                item.appendChild(scoreSpan);
                gameSection.appendChild(item);
            });

            content.appendChild(gameSection);
        });

        if (content.innerHTML === '') {
            content.innerHTML = '<p style="text-align: center; font-size: 32px; color: #999; padding: 50px;">Пока нет рекордов. Начните играть!</p>';
        }
    }

    getGameTitle(gameKey) {
        const titles = {
            'fruit-slash': '🍎 Fruit Slash',
            'air-hockey': '🏒 Air Hockey',
            'color-splash': '🎨 Color Splash',
            'piano-hero': '🎹 Piano Hero',
            'memory-match': '🧩 Memory Match',
            'whack-a-mole': '🔨 Whack-a-Mole',
            'bubble-pop': '🫧 Bubble Pop',
            'space-defender': '🚀 Space Defender',
            'tower-battle': '🏰 Tower Battle',
            'paintball-arena': '🎯 Paintball Arena',
            'racing-madness': '🏎️ Racing Madness',
            'food-fight': '🍕 Food Fight',
            'race-track-pro': '🏁 Race Track Pro',
            'battle-tanks': '🎖️ Battle Tanks',
            'snake-arena': '🐍 Snake Arena',
            'ship-battle': '⚓ Ship Battle'
        };
        return titles[gameKey] || gameKey;
    }

    saveSettings() {
        localStorage.setItem('zerqcraft-settings', JSON.stringify(this.settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('zerqcraft-settings');
        if (saved) {
            this.settings = JSON.parse(saved);
            document.getElementById('volume-slider').value = this.settings.volume;
            document.getElementById('music-slider').value = this.settings.music;
            document.getElementById('vibration-toggle').checked = this.settings.vibration;
        }
    }
}

// Initialize when DOM is ready
let gameHub;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        gameHub = new GameHub();
    });
} else {
    gameHub = new GameHub();
}

// Handle window resize
window.addEventListener('resize', () => {
    if (gameHub && gameHub.currentGame && gameHub.currentGame.resize) {
        const canvas = document.getElementById('game-canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - 120;
        gameHub.currentGame.resize();
    }
});
