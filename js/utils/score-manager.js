// Score Manager for all games
class ScoreManager {
    static saveScore(gameName, score) {
        const scores = this.getGameScores(gameName);

        scores.push({
            score: score,
            date: new Date().toISOString(),
            timestamp: Date.now()
        });

        // Sort by score (descending)
        scores.sort((a, b) => b.score - a.score);

        // Keep top 10
        const topScores = scores.slice(0, 10);

        localStorage.setItem(`zerqcraft-scores-${gameName}`, JSON.stringify(topScores));

        return topScores;
    }

    static getGameScores(gameName) {
        const data = localStorage.getItem(`zerqcraft-scores-${gameName}`);
        return data ? JSON.parse(data) : [];
    }

    static getAllScores() {
        const games = [
            'fruit-slash',
            'air-hockey',
            'color-splash',
            'piano-hero',
            'memory-match',
            'whack-a-mole',
            'bubble-pop',
            'space-defender'
        ];

        const allScores = {};
        games.forEach(game => {
            allScores[game] = this.getGameScores(game);
        });

        return allScores;
    }

    static getHighScore(gameName) {
        const scores = this.getGameScores(gameName);
        return scores.length > 0 ? scores[0].score : 0;
    }

    static clearScores(gameName) {
        if (gameName) {
            localStorage.removeItem(`zerqcraft-scores-${gameName}`);
        } else {
            // Clear all scores
            const games = [
                'fruit-slash',
                'air-hockey',
                'color-splash',
                'piano-hero',
                'memory-match',
                'whack-a-mole',
                'bubble-pop',
                'space-defender'
            ];
            games.forEach(game => {
                localStorage.removeItem(`zerqcraft-scores-${game}`);
            });
        }
    }
}
