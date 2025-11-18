// School Quiz - Educational quiz game for 2-6 players
class SchoolQuiz {
    constructor(canvas, gameHub, playerCount = 2) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameHub = gameHub;
        this.playerCount = playerCount || 2;

        this.isRunning = false;
        this.players = [];
        this.currentQuestion = null;
        this.questionIndex = 0;
        this.usedQuestions = [];
        this.showingAnswer = false;
        this.answerTimeout = null;
        this.questionTimeout = null;

        this.playerColors = ['#ff6b6b', '#4ecdc4', '#f39c12', '#9b59b6', '#2ecc71', '#e67e22'];

        this.totalQuestions = 20; // Questions per game
        this.timePerQuestion = 15000; // 15 seconds
        this.timeLeft = 0;
        this.questionStartTime = 0;

        this.animationFrame = null;
        this.touchHandler = new TouchHandler(canvas);

        this.setupPlayers();
        this.setupTouchHandlers();
    }

    setupPlayers() {
        this.players = [];
        const buttonWidth = this.canvas.width / this.playerCount;

        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i,
                name: `Игрок ${i + 1}`,
                color: this.playerColors[i],
                score: 0,
                answered: false,
                answerCorrect: false,
                buttonX: buttonWidth * i,
                buttonY: this.canvas.height - 150,
                buttonWidth: buttonWidth,
                buttonHeight: 120,
                touchId: null
            });
        }
    }

    setupTouchHandlers() {
        this.touchHandler.on('onTouchStart', (touch) => {
            if (!this.isRunning || this.showingAnswer) return;

            // Check which player's button was pressed
            this.players.forEach(player => {
                if (!player.answered &&
                    touch.x >= player.buttonX &&
                    touch.x <= player.buttonX + player.buttonWidth &&
                    touch.y >= player.buttonY &&
                    touch.y <= player.buttonY + player.buttonHeight) {

                    this.playerAnswered(player);
                }
            });
        });
    }

    playerAnswered(player) {
        player.answered = true;
        player.touchId = Date.now();

        // Check if answer is correct
        if (this.currentQuestion) {
            const answeredOptions = this.players
                .filter(p => p.answered)
                .map(p => p.id);

            // Award points based on speed and correctness
            const timeBonus = Math.floor((this.timeLeft / this.timePerQuestion) * 100);
            const basePoints = 100;

            player.answerCorrect = true;
            player.score += basePoints + timeBonus;

            this.gameHub.playSound('powerup');

            if (navigator.vibrate && this.gameHub.settings.vibration) {
                navigator.vibrate(50);
            }

            // Check if all players answered
            const allAnswered = this.players.every(p => p.answered);
            if (allAnswered) {
                this.showAnswer();
            }
        }
    }

    start() {
        this.isRunning = true;
        this.questionIndex = 0;
        this.usedQuestions = [];
        this.setupPlayers();

        this.nextQuestion();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.answerTimeout) clearTimeout(this.answerTimeout);
        if (this.questionTimeout) clearTimeout(this.questionTimeout);
        this.touchHandler.destroy();
    }

    nextQuestion() {
        if (this.questionIndex >= this.totalQuestions) {
            this.endGame();
            return;
        }

        this.showingAnswer = false;
        this.players.forEach(p => {
            p.answered = false;
            p.answerCorrect = false;
        });

        // Get random question that hasn't been used
        const availableQuestions = this.getQuestions().filter((q, i) => !this.usedQuestions.includes(i));
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        this.currentQuestion = availableQuestions[randomIndex];

        // Mark as used
        const originalIndex = this.getQuestions().indexOf(this.currentQuestion);
        this.usedQuestions.push(originalIndex);

        this.questionIndex++;
        this.questionStartTime = Date.now();
        this.timeLeft = this.timePerQuestion;

        this.updateScore();

        // Auto-advance after time limit
        this.questionTimeout = setTimeout(() => {
            if (!this.showingAnswer) {
                this.showAnswer();
            }
        }, this.timePerQuestion);
    }

    showAnswer() {
        this.showingAnswer = true;
        if (this.questionTimeout) clearTimeout(this.questionTimeout);

        this.gameHub.playSound('hit');

        // Wait 3 seconds before next question
        this.answerTimeout = setTimeout(() => {
            this.nextQuestion();
        }, 3000);
    }

    updateScore() {
        const scores = this.players
            .map(p => `П${p.id + 1}: ${p.score}`)
            .join(' | ');

        this.gameHub.updateScore(`Вопрос ${this.questionIndex}/${this.totalQuestions} | ${scores}`);
    }

    endGame() {
        this.isRunning = false;

        // Find winner
        const winner = this.players.reduce((best, player) => {
            if (!best || player.score > best.score) return player;
            return best;
        }, null);

        if (winner) {
            ScoreManager.saveScore('school-quiz', winner.score);
        }

        setTimeout(() => {
            const scoreStr = this.players
                .map((p, i) => `${p.name}: ${p.score}`)
                .join('\n');

            const message = `🎓 ВИКТОРИНА ЗАВЕРШЕНА!\n\nПобедитель: ${winner ? winner.name : 'Никто'}\n\n${scoreStr}\n\nСыграть еще раз?`;

            if (confirm(message)) {
                this.gameHub.showPlayerSelection('school-quiz');
            } else {
                this.gameHub.backToMenu();
            }
        }, 1000);
    }

    gameLoop() {
        if (!this.isRunning) return;

        // Update time left
        if (!this.showingAnswer) {
            this.timeLeft = Math.max(0, this.timePerQuestion - (Date.now() - this.questionStartTime));
        }

        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.currentQuestion) return;

        // Draw question card
        const cardX = this.canvas.width * 0.1;
        const cardY = 100;
        const cardWidth = this.canvas.width * 0.8;
        const cardHeight = this.canvas.height - 350;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 20);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Question number
        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillStyle = '#667eea';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Вопрос ${this.questionIndex} из ${this.totalQuestions}`, this.canvas.width / 2, cardY + 50);

        // Category
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillStyle = '#999';
        this.ctx.fillText(this.currentQuestion.category, this.canvas.width / 2, cardY + 85);

        // Question text
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';

        const questionText = this.currentQuestion.question;
        const words = questionText.split(' ');
        let line = '';
        let y = cardY + 150;
        const lineHeight = 45;
        const maxWidth = cardWidth - 60;

        for (let word of words) {
            const testLine = line + word + ' ';
            const metrics = this.ctx.measureText(testLine);

            if (metrics.width > maxWidth && line !== '') {
                this.ctx.fillText(line, this.canvas.width / 2, y);
                line = word + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        this.ctx.fillText(line, this.canvas.width / 2, y);

        // Answer options
        if (this.currentQuestion.options && this.currentQuestion.options.length > 0) {
            const optionsY = y + 80;
            const optionHeight = 50;
            const optionPadding = 15;

            this.currentQuestion.options.forEach((option, i) => {
                const optY = optionsY + (optionHeight + optionPadding) * i;

                // Highlight correct answer if showing answer
                if (this.showingAnswer && i === this.currentQuestion.correctIndex) {
                    this.ctx.fillStyle = '#2ecc71';
                } else {
                    this.ctx.fillStyle = '#f0f0f0';
                }

                this.ctx.beginPath();
                this.ctx.roundRect(cardX + 30, optY, cardWidth - 60, optionHeight, 10);
                this.ctx.fill();

                this.ctx.font = 'bold 28px Arial';
                this.ctx.fillStyle = '#333';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(`${String.fromCharCode(65 + i)}. ${option}`, cardX + 50, optY + 35);
            });
        } else if (this.showingAnswer) {
            // Show answer for open questions
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Ответ: ${this.currentQuestion.answer}`, this.canvas.width / 2, y + 100);
        }

        // Timer bar
        if (!this.showingAnswer) {
            const timerBarY = cardY + cardHeight + 30;
            const timerBarHeight = 20;
            const timerProgress = this.timeLeft / this.timePerQuestion;

            // Background
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.roundRect(cardX, timerBarY, cardWidth, timerBarHeight, 10);
            this.ctx.fill();

            // Progress
            const timerColor = timerProgress > 0.5 ? '#2ecc71' : timerProgress > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillStyle = timerColor;
            this.ctx.beginPath();
            this.ctx.roundRect(cardX, timerBarY, cardWidth * timerProgress, timerBarHeight, 10);
            this.ctx.fill();

            // Time text
            this.ctx.font = 'bold 24px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`⏱️ ${Math.ceil(this.timeLeft / 1000)}с`, this.canvas.width / 2, timerBarY + 50);
        } else {
            this.ctx.font = 'bold 36px Arial';
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('✓ Следующий вопрос...', this.canvas.width / 2, cardY + cardHeight + 50);
        }

        // Draw player buttons
        this.players.forEach(player => {
            // Button
            if (player.answered) {
                this.ctx.fillStyle = player.answerCorrect ? '#2ecc71' : player.color;
            } else {
                this.ctx.fillStyle = player.color;
            }

            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.roundRect(
                player.buttonX + 10,
                player.buttonY,
                player.buttonWidth - 20,
                player.buttonHeight,
                15
            );
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Player info
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                player.name,
                player.buttonX + player.buttonWidth / 2,
                player.buttonY + 35
            );

            // Score
            this.ctx.font = 'bold 36px Arial';
            this.ctx.fillText(
                player.score.toString(),
                player.buttonX + player.buttonWidth / 2,
                player.buttonY + 75
            );

            // Status
            if (player.answered) {
                this.ctx.font = '32px Arial';
                this.ctx.fillText(
                    '✓',
                    player.buttonX + player.buttonWidth / 2,
                    player.buttonY + 110
                );
            } else if (!this.showingAnswer) {
                this.ctx.font = 'bold 20px Arial';
                this.ctx.globalAlpha = 0.7;
                this.ctx.fillText(
                    '👆 ОТВЕТИТЬ',
                    player.buttonX + player.buttonWidth / 2,
                    player.buttonY + 110
                );
                this.ctx.globalAlpha = 1;
            }
        });
    }

    resize() {
        this.setupPlayers();
    }

    // Database of 200 school questions
    getQuestions() {
        return [
            // Математика (40 вопросов)
            { category: 'Математика', question: 'Сколько будет 7 × 8?', answer: '56', options: ['54', '56', '58', '60'], correctIndex: 1 },
            { category: 'Математика', question: 'Чему равна площадь квадрата со стороной 5?', answer: '25', options: ['20', '25', '30', '35'], correctIndex: 1 },
            { category: 'Математика', question: 'Сколько градусов в прямом угле?', answer: '90', options: ['45', '90', '180', '360'], correctIndex: 1 },
            { category: 'Математика', question: 'Чему равен корень из 81?', answer: '9', options: ['7', '8', '9', '10'], correctIndex: 2 },
            { category: 'Математика', question: 'Сколько будет 15% от 200?', answer: '30', options: ['20', '25', '30', '35'], correctIndex: 2 },
            { category: 'Математика', question: 'Чему равна сумма углов треугольника?', answer: '180°', options: ['90°', '180°', '270°', '360°'], correctIndex: 1 },
            { category: 'Математика', question: 'Сколько будет 12²?', answer: '144', options: ['124', '134', '144', '154'], correctIndex: 2 },
            { category: 'Математика', question: 'Периметр прямоугольника 3×5?', answer: '16', options: ['14', '15', '16', '18'], correctIndex: 2 },
            { category: 'Математика', question: 'Чему равно число Пи (округлённо)?', answer: '3.14', options: ['2.71', '3.14', '3.56', '4.12'], correctIndex: 1 },
            { category: 'Математика', question: 'Сколько будет 100 - 37?', answer: '63', options: ['61', '62', '63', '64'], correctIndex: 2 },

            { category: 'Математика', question: 'Диаметр окружности 10 см. Радиус?', answer: '5 см', options: ['3 см', '5 см', '7 см', '10 см'], correctIndex: 1 },
            { category: 'Математика', question: 'Сколько секунд в 5 минутах?', answer: '300', options: ['250', '300', '350', '400'], correctIndex: 1 },
            { category: 'Математика', question: '2³ (два в кубе) равно?', answer: '8', options: ['6', '8', '9', '12'], correctIndex: 1 },
            { category: 'Математика', question: 'Половина от 98?', answer: '49', options: ['47', '48', '49', '50'], correctIndex: 2 },
            { category: 'Математика', question: 'Сколько граней у куба?', answer: '6', options: ['4', '6', '8', '12'], correctIndex: 1 },
            { category: 'Математика', question: '25% это сколько в дробях?', answer: '1/4', options: ['1/2', '1/4', '1/3', '1/5'], correctIndex: 1 },
            { category: 'Математика', question: 'Сколько нулей в миллионе?', answer: '6', options: ['5', '6', '7', '8'], correctIndex: 1 },
            { category: 'Математика', question: '7 + 8 × 2 = ?', answer: '23', options: ['21', '22', '23', '30'], correctIndex: 2 },
            { category: 'Математика', question: 'Объём куба со стороной 3?', answer: '27', options: ['9', '18', '27', '36'], correctIndex: 2 },
            { category: 'Математика', question: 'Квадратный корень из 144?', answer: '12', options: ['10', '11', '12', '14'], correctIndex: 2 },

            { category: 'Математика', question: '1 км = ? метров', answer: '1000', options: ['100', '500', '1000', '10000'], correctIndex: 2 },
            { category: 'Математика', question: 'Сколько минут в 3 часах?', answer: '180', options: ['150', '180', '200', '240'], correctIndex: 1 },
            { category: 'Математика', question: '50% от 80 = ?', answer: '40', options: ['30', '35', '40', '45'], correctIndex: 2 },
            { category: 'Математика', question: 'Сколько углов у пятиугольника?', answer: '5', options: ['4', '5', '6', '7'], correctIndex: 1 },
            { category: 'Математика', question: '9 × 9 = ?', answer: '81', options: ['72', '81', '90', '99'], correctIndex: 1 },
            { category: 'Математика', question: '144 ÷ 12 = ?', answer: '12', options: ['10', '11', '12', '13'], correctIndex: 2 },
            { category: 'Математика', question: 'Римская цифра X означает?', answer: '10', options: ['5', '10', '50', '100'], correctIndex: 1 },
            { category: 'Математика', question: 'Сколько сторон у шестиугольника?', answer: '6', options: ['5', '6', '7', '8'], correctIndex: 1 },
            { category: 'Математика', question: 'Удвоенное 15 = ?', answer: '30', options: ['25', '30', '35', '40'], correctIndex: 1 },
            { category: 'Математика', question: '1 центнер = ? кг', answer: '100', options: ['10', '50', '100', '1000'], correctIndex: 2 },

            { category: 'Математика', question: '0.5 × 100 = ?', answer: '50', options: ['5', '25', '50', '500'], correctIndex: 2 },
            { category: 'Математика', question: 'Треть от 90?', answer: '30', options: ['20', '25', '30', '35'], correctIndex: 2 },
            { category: 'Математика', question: '5! (факториал) = ?', answer: '120', options: ['100', '110', '120', '125'], correctIndex: 2 },
            { category: 'Математика', question: 'log₁₀(100) = ?', answer: '2', options: ['1', '2', '10', '100'], correctIndex: 1 },
            { category: 'Математика', question: '2 в степени 5 = ?', answer: '32', options: ['16', '25', '32', '64'], correctIndex: 2 },
            { category: 'Математика', question: 'Медиана чисел 3,5,7?', answer: '5', options: ['3', '5', '7', '15'], correctIndex: 1 },
            { category: 'Математика', question: 'НОД(12, 18) = ?', answer: '6', options: ['2', '3', '6', '9'], correctIndex: 2 },
            { category: 'Математика', question: 'НОК(4, 6) = ?', answer: '12', options: ['6', '8', '12', '24'], correctIndex: 2 },
            { category: 'Математика', question: 'Простое число?', answer: '17', options: ['15', '16', '17', '18'], correctIndex: 2 },
            { category: 'Математика', question: 'Сумма 1+2+3+...+10?', answer: '55', options: ['45', '50', '55', '60'], correctIndex: 2 },

            // Русский язык (30 вопросов)
            { category: 'Русский язык', question: 'Сколько букв в русском алфавите?', answer: '33', options: ['30', '32', '33', '35'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Главный член предложения, кто?', answer: 'Подлежащее', options: ['Подлежащее', 'Сказуемое', 'Дополнение', 'Определение'], correctIndex: 0 },
            { category: 'Русский язык', question: 'Синоним слова "большой"?', answer: 'Огромный', options: ['Маленький', 'Средний', 'Огромный', 'Крошечный'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Антоним слова "день"?', answer: 'Ночь', options: ['Утро', 'Вечер', 'Ночь', 'Рассвет'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Сколько падежей в русском?', answer: '6', options: ['4', '5', '6', '7'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Часть речи слова "быстро"?', answer: 'Наречие', options: ['Глагол', 'Прилагательное', 'Наречие', 'Существительное'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Множественное от "ребёнок"?', answer: 'Дети', options: ['Ребята', 'Ребёнки', 'Дети', 'Детишки'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Приставка в слове "переход"?', answer: 'пере-', options: ['пере-', 'пе-', 'пер-', 'переход-'], correctIndex: 0 },
            { category: 'Русский язык', question: 'Корень в слове "водный"?', answer: 'вод', options: ['во', 'вод', 'водн', 'водный'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Омоним слова "коса" (волосы)?', answer: 'Коса (инструмент)', options: ['Волосы', 'Берег', 'Коса (инструмент)', 'Причёска'], correctIndex: 2 },

            { category: 'Русский язык', question: 'Правильное написание?', answer: 'Здравствуйте', options: ['Здраствуйте', 'Здравствуйте', 'Здраствуте', 'Здравствуте'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Род слова "кофе"?', answer: 'Мужской', options: ['Мужской', 'Женский', 'Средний', 'Общий'], correctIndex: 0 },
            { category: 'Русский язык', question: 'Ударение в слове "звонИт"?', answer: 'На И', options: ['На О', 'На И', 'На звО', 'Без разницы'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Фразеологизм означает "обмануть"?', answer: 'Водить за нос', options: ['Бить баклуши', 'Водить за нос', 'Повесить нос', 'Задрать нос'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Сколько времён у глагола?', answer: '3', options: ['2', '3', '4', '5'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Вид глагола "читать"?', answer: 'Несовершенный', options: ['Совершенный', 'Несовершенный', 'Переходный', 'Возвратный'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Спряжение глагола "идти"?', answer: 'I спряжение', options: ['I спряжение', 'II спряжение', 'Разноспрягаемый', 'Неспрягаемый'], correctIndex: 0 },
            { category: 'Русский язык', question: 'Буква после Ж, Ш пишется?', answer: 'И', options: ['Ы', 'И', 'Е', 'Любая'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Правило ЖИ-ШИ пиши с?', answer: 'И', options: ['Ы', 'И', 'Е', 'Ё'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Сколько склонений существительных?', answer: '3', options: ['2', '3', '4', '5'], correctIndex: 1 },

            { category: 'Русский язык', question: 'Какое слово пишется слитно?', answer: 'Вместе', options: ['В месте', 'Вместе', 'В след', 'На счёт'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Паронимы - это слова?', answer: 'Похожие по звучанию', options: ['Одинаковые', 'Похожие по звучанию', 'Противоположные', 'Синонимы'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Деепричастие от "бежать"?', answer: 'Бегая', options: ['Бежал', 'Бегая', 'Беги', 'Бежавший'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Причастие - это форма?', answer: 'Глагола', options: ['Существительного', 'Прилагательного', 'Глагола', 'Наречия'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Союз "и" какой?', answer: 'Сочинительный', options: ['Сочинительный', 'Подчинительный', 'Производный', 'Простой'], correctIndex: 0 },
            { category: 'Русский язык', question: 'Предлог "благодаря" управляет?', answer: 'Дательным падежом', options: ['Именительным', 'Родительным', 'Дательным', 'Винительным'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Частица "не" с глаголами?', answer: 'Раздельно', options: ['Слитно', 'Раздельно', 'Через дефис', 'По-разному'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Междометие выражает?', answer: 'Эмоции', options: ['Действие', 'Признак', 'Эмоции', 'Предмет'], correctIndex: 2 },
            { category: 'Русский язык', question: 'Числительное "пятый" какое?', answer: 'Порядковое', options: ['Количественное', 'Порядковое', 'Собирательное', 'Дробное'], correctIndex: 1 },
            { category: 'Русский язык', question: 'Местоимение "я" какого лица?', answer: '1-го', options: ['1-го', '2-го', '3-го', 'Без лица'], correctIndex: 0 },

            // География (25 вопросов)
            { category: 'География', question: 'Столица России?', answer: 'Москва', options: ['Москва', 'Санкт-Петербург', 'Казань', 'Владивосток'], correctIndex: 0 },
            { category: 'География', question: 'Самый большой океан?', answer: 'Тихий', options: ['Атлантический', 'Индийский', 'Тихий', 'Северный Ледовитый'], correctIndex: 2 },
            { category: 'География', question: 'На каком материке Египет?', answer: 'Африка', options: ['Азия', 'Африка', 'Европа', 'Южная Америка'], correctIndex: 1 },
            { category: 'География', question: 'Самая длинная река в мире?', answer: 'Амазонка', options: ['Нил', 'Амазонка', 'Волга', 'Янцзы'], correctIndex: 1 },
            { category: 'География', question: 'Сколько материков на Земле?', answer: '6', options: ['5', '6', '7', '8'], correctIndex: 1 },
            { category: 'География', question: 'Столица Франции?', answer: 'Париж', options: ['Лондон', 'Берлин', 'Париж', 'Рим'], correctIndex: 2 },
            { category: 'География', question: 'Самая высокая гора?', answer: 'Эверест', options: ['Эльбрус', 'Килиманджаро', 'Эверест', 'Монблан'], correctIndex: 2 },
            { category: 'География', question: 'Пустыня в Африке?', answer: 'Сахара', options: ['Гоби', 'Сахара', 'Атакама', 'Каракум'], correctIndex: 1 },
            { category: 'География', question: 'Столица Японии?', answer: 'Токио', options: ['Пекин', 'Сеул', 'Токио', 'Бангкок'], correctIndex: 2 },
            { category: 'География', question: 'На каком материке Австралия?', answer: 'Австралия', options: ['Азия', 'Африка', 'Австралия', 'Океания'], correctIndex: 2 },

            { category: 'География', question: 'Самое глубокое озеро?', answer: 'Байкал', options: ['Байкал', 'Виктория', 'Каспийское', 'Мичиган'], correctIndex: 0 },
            { category: 'География', question: 'Столица Италии?', answer: 'Рим', options: ['Милан', 'Рим', 'Венеция', 'Флоренция'], correctIndex: 1 },
            { category: 'География', question: 'Сколько океанов на Земле?', answer: '4', options: ['3', '4', '5', '6'], correctIndex: 1 },
            { category: 'География', question: 'Канал между Европой и Азией?', answer: 'Босфор', options: ['Суэцкий', 'Панамский', 'Босфор', 'Коринфский'], correctIndex: 2 },
            { category: 'География', question: 'Страна кленового листа?', answer: 'Канада', options: ['США', 'Канада', 'Норвегия', 'Швеция'], correctIndex: 1 },
            { category: 'География', question: 'Море без берегов?', answer: 'Саргассово', options: ['Мёртвое', 'Саргассово', 'Красное', 'Чёрное'], correctIndex: 1 },
            { category: 'География', question: 'Родина пирамид?', answer: 'Египет', options: ['Мексика', 'Египет', 'Индия', 'Китай'], correctIndex: 1 },
            { category: 'География', question: 'Самая маленькая страна?', answer: 'Ватикан', options: ['Монако', 'Ватикан', 'Лихтенштейн', 'Мальта'], correctIndex: 1 },
            { category: 'География', question: 'Полуостров в форме сапога?', answer: 'Апеннинский', options: ['Пиренейский', 'Апеннинский', 'Балканский', 'Скандинавский'], correctIndex: 1 },
            { category: 'География', question: 'Ниагарский водопад где?', answer: 'США/Канада', options: ['Бразилия', 'США/Канада', 'Венесуэла', 'Замбия'], correctIndex: 1 },

            { category: 'География', question: 'Самый населённый город?', answer: 'Токио', options: ['Нью-Йорк', 'Токио', 'Москва', 'Шанхай'], correctIndex: 1 },
            { category: 'География', question: 'Пролив между Африкой и Европой?', answer: 'Гибралтарский', options: ['Берингов', 'Дрейка', 'Гибралтарский', 'Магелланов'], correctIndex: 2 },
            { category: 'География', question: 'Цветные моря?', answer: 'Чёрное, Красное, Жёлтое', options: ['Синее, Белое', 'Чёрное, Красное, Жёлтое', 'Зелёное, Розовое', 'Все неверно'], correctIndex: 1 },
            { category: 'География', question: 'Фьорды характерны для?', answer: 'Норвегии', options: ['Италии', 'Норвегии', 'Испании', 'Греции'], correctIndex: 1 },
            { category: 'География', question: 'Координаты состоят из?', answer: 'Широты и долготы', options: ['Широты и долготы', 'Высоты и глубины', 'Севера и юга', 'Востока и запада'], correctIndex: 0 },

            // История (25 вопросов)
            { category: 'История', question: 'Год основания Москвы?', answer: '1147', options: ['1047', '1147', '1247', '1347'], correctIndex: 1 },
            { category: 'История', question: 'Когда началась ВОВ?', answer: '1941', options: ['1939', '1940', '1941', '1942'], correctIndex: 2 },
            { category: 'История', question: 'Первый космонавт?', answer: 'Гагарин', options: ['Титов', 'Гагарин', 'Терешкова', 'Леонов'], correctIndex: 1 },
            { category: 'История', question: 'Год крещения Руси?', answer: '988', options: ['888', '988', '1088', '1188'], correctIndex: 1 },
            { category: 'История', question: 'Петр I основал город?', answer: 'Санкт-Петербург', options: ['Москва', 'Санкт-Петербург', 'Новгород', 'Владимир'], correctIndex: 1 },
            { category: 'История', question: 'Отечественная война?', answer: '1812', options: ['1712', '1812', '1912', '1912'], correctIndex: 1 },
            { category: 'История', question: 'Куликовская битва когда?', answer: '1380', options: ['1280', '1380', '1480', '1580'], correctIndex: 1 },
            { category: 'История', question: 'СССР образован в?', answer: '1922', options: ['1917', '1920', '1922', '1925'], correctIndex: 2 },
            { category: 'История', question: 'Первый президент России?', answer: 'Ельцин', options: ['Горбачёв', 'Ельцин', 'Путин', 'Медведев'], correctIndex: 1 },
            { category: 'История', question: 'Ледовое побоище год?', answer: '1242', options: ['1142', '1242', '1342', '1442'], correctIndex: 1 },

            { category: 'История', question: 'Древнерусское государство центр?', answer: 'Киев', options: ['Москва', 'Новгород', 'Киев', 'Владимир'], correctIndex: 2 },
            { category: 'История', question: 'Монгольское иго длилось?', answer: '240 лет', options: ['140 лет', '240 лет', '340 лет', '440 лет'], correctIndex: 1 },
            { category: 'История', question: 'Декабристы восстали в?', answer: '1825', options: ['1801', '1812', '1825', '1861'], correctIndex: 2 },
            { category: 'История', question: 'Отмена крепостного права?', answer: '1861', options: ['1812', '1825', '1861', '1917'], correctIndex: 2 },
            { category: 'История', question: 'Октябрьская революция?', answer: '1917', options: ['1905', '1914', '1917', '1922'], correctIndex: 2 },
            { category: 'История', question: 'Последний русский царь?', answer: 'Николай II', options: ['Александр III', 'Николай II', 'Пётр III', 'Павел I'], correctIndex: 1 },
            { category: 'История', question: 'Бородинская битва?', answer: '1812', options: ['1709', '1812', '1814', '1825'], correctIndex: 1 },
            { category: 'История', question: 'Полтавская битва?', answer: '1709', options: ['1609', '1709', '1809', '1909'], correctIndex: 1 },
            { category: 'История', question: 'Иван Грозный первый?', answer: 'Царь', options: ['Князь', 'Царь', 'Император', 'Король'], correctIndex: 1 },
            { category: 'История', question: 'Смутное время век?', answer: '17', options: ['15', '16', '17', '18'], correctIndex: 2 },

            { category: 'История', question: 'Невская битва год?', answer: '1240', options: ['1140', '1240', '1340', '1440'], correctIndex: 1 },
            { category: 'История', question: 'Александр Невский победил?', answer: 'Шведов и немцев', options: ['Монголов', 'Французов', 'Шведов и немцев', 'Турок'], correctIndex: 2 },
            { category: 'История', question: 'Столица при Петре I?', answer: 'Санкт-Петербург', options: ['Москва', 'Санкт-Петербург', 'Новгород', 'Киев'], correctIndex: 1 },
            { category: 'История', question: 'День Победы?', answer: '9 мая', options: ['8 мая', '9 мая', '10 мая', '1 мая'], correctIndex: 1 },
            { category: 'История', question: 'Сталинградская битва?', answer: '1942-1943', options: ['1941-1942', '1942-1943', '1943-1944', '1944-1945'], correctIndex: 1 },

            // Биология (20 вопросов)
            { category: 'Биология', question: 'Самое большое животное?', answer: 'Синий кит', options: ['Слон', 'Синий кит', 'Жираф', 'Белая акула'], correctIndex: 1 },
            { category: 'Биология', question: 'Сколько камер в сердце человека?', answer: '4', options: ['2', '3', '4', '5'], correctIndex: 2 },
            { category: 'Биология', question: 'Наука о растениях?', answer: 'Ботаника', options: ['Зоология', 'Ботаника', 'Анатомия', 'Экология'], correctIndex: 1 },
            { category: 'Биология', question: 'Сколько пар рёбер у человека?', answer: '12', options: ['10', '11', '12', '14'], correctIndex: 2 },
            { category: 'Биология', question: 'Самое быстрое животное?', answer: 'Гепард', options: ['Лев', 'Гепард', 'Орёл', 'Акула'], correctIndex: 1 },
            { category: 'Биология', question: 'Процесс дыхания растений?', answer: 'Фотосинтез', options: ['Фотосинтез', 'Испарение', 'Опыление', 'Размножение'], correctIndex: 0 },
            { category: 'Биология', question: 'Сколько костей у взрослого?', answer: '206', options: ['180', '206', '250', '300'], correctIndex: 1 },
            { category: 'Биология', question: 'Самая большая кость?', answer: 'Бедренная', options: ['Плечевая', 'Бедренная', 'Позвоночник', 'Череп'], correctIndex: 1 },
            { category: 'Биология', question: 'Орган вкуса?', answer: 'Язык', options: ['Нос', 'Язык', 'Губы', 'Горло'], correctIndex: 1 },
            { category: 'Биология', question: 'Красные кровяные тельца?', answer: 'Эритроциты', options: ['Лейкоциты', 'Эритроциты', 'Тромбоциты', 'Плазма'], correctIndex: 1 },

            { category: 'Биология', question: 'Сколько хромосом у человека?', answer: '46', options: ['23', '46', '48', '50'], correctIndex: 1 },
            { category: 'Биология', question: 'Самый большой орган человека?', answer: 'Кожа', options: ['Печень', 'Кожа', 'Кишечник', 'Лёгкие'], correctIndex: 1 },
            { category: 'Биология', question: 'Млекопитающее откладывает яйца?', answer: 'Утконос', options: ['Кенгуру', 'Ехидна', 'Утконос', 'Оба 2 и 3'], correctIndex: 3 },
            { category: 'Биология', question: 'Сколько зубов у взрослого?', answer: '32', options: ['28', '30', '32', '34'], correctIndex: 2 },
            { category: 'Биология', question: 'Орган слуха?', answer: 'Ухо', options: ['Нос', 'Ухо', 'Глаз', 'Рот'], correctIndex: 1 },
            { category: 'Биология', question: 'Группы крови сколько?', answer: '4', options: ['2', '3', '4', '5'], correctIndex: 2 },
            { category: 'Биология', question: 'Единица наследственности?', answer: 'Ген', options: ['Ген', 'ДНК', 'РНК', 'Белок'], correctIndex: 0 },
            { category: 'Биология', question: 'Бабочка развивается из?', answer: 'Гусеницы', options: ['Личинки', 'Гусеницы', 'Куколки', 'Яйца'], correctIndex: 1 },
            { category: 'Биология', question: 'Сколько пальцев у человека?', answer: '20', options: ['10', '15', '20', '24'], correctIndex: 2 },
            { category: 'Биология', question: 'Позвоночник состоит из?', answer: 'Позвонков', options: ['Костей', 'Позвонков', 'Хрящей', 'Суставов'], correctIndex: 1 },

            // Физика (15 вопросов)
            { category: 'Физика', question: 'Скорость света?', answer: '300000 км/с', options: ['100000 км/с', '200000 км/с', '300000 км/с', '400000 км/с'], correctIndex: 2 },
            { category: 'Физика', question: 'Единица силы?', answer: 'Ньютон', options: ['Джоуль', 'Ньютон', 'Ватт', 'Паскаль'], correctIndex: 1 },
            { category: 'Физика', question: 'Сила тяжести на Земле?', answer: '9.8 м/с²', options: ['8.8 м/с²', '9.8 м/с²', '10.8 м/с²', '11.8 м/с²'], correctIndex: 1 },
            { category: 'Физика', question: 'Формула скорости?', answer: 'v = s/t', options: ['v = s×t', 'v = s/t', 'v = t/s', 'v = s+t'], correctIndex: 1 },
            { category: 'Физика', question: 'Агрегатные состояния?', answer: '3', options: ['2', '3', '4', '5'], correctIndex: 1 },
            { category: 'Физика', question: 'Единица энергии?', answer: 'Джоуль', options: ['Ньютон', 'Джоуль', 'Ватт', 'Вольт'], correctIndex: 1 },
            { category: 'Физика', question: 'Температура кипения воды?', answer: '100°C', options: ['90°C', '100°C', '110°C', '120°C'], correctIndex: 1 },
            { category: 'Физика', question: 'Закон Ньютона первый?', answer: 'Инерция', options: ['Инерция', 'F=ma', 'Действие=противодействию', 'Гравитация'], correctIndex: 0 },
            { category: 'Физика', question: 'Единица мощности?', answer: 'Ватт', options: ['Джоуль', 'Ньютон', 'Ватт', 'Ом'], correctIndex: 2 },
            { category: 'Физика', question: 'Давление измеряется в?', answer: 'Паскалях', options: ['Ньютонах', 'Паскалях', 'Джоулях', 'Ваттах'], correctIndex: 1 },

            { category: 'Физика', question: 'Закон Ома?', answer: 'I=U/R', options: ['I=U×R', 'I=U/R', 'I=R/U', 'I=U+R'], correctIndex: 1 },
            { category: 'Физика', question: 'Единица электрического тока?', answer: 'Ампер', options: ['Вольт', 'Ампер', 'Ом', 'Ватт'], correctIndex: 1 },
            { category: 'Физика', question: 'Звук распространяется в?', answer: 'Среде', options: ['Вакууме', 'Среде', 'Только воздухе', 'Только воде'], correctIndex: 1 },
            { category: 'Физика', question: 'Преломление света в?', answer: 'Оптике', options: ['Механике', 'Оптике', 'Термодинамике', 'Электричестве'], correctIndex: 1 },
            { category: 'Физика', question: 'Рычаг - это?', answer: 'Простой механизм', options: ['Сложный механизм', 'Простой механизм', 'Инструмент', 'Машина'], correctIndex: 1 },

            // Химия (15 вопросов)
            { category: 'Химия', question: 'Формула воды?', answer: 'H₂O', options: ['H₂O', 'CO₂', 'O₂', 'HO'], correctIndex: 0 },
            { category: 'Химия', question: 'Золото в таблице?', answer: 'Au', options: ['Ag', 'Au', 'Al', 'Go'], correctIndex: 1 },
            { category: 'Химия', question: 'Кислород символ?', answer: 'O', options: ['H', 'O', 'N', 'C'], correctIndex: 1 },
            { category: 'Химия', question: 'Водород символ?', answer: 'H', options: ['H', 'He', 'Hg', 'Ho'], correctIndex: 0 },
            { category: 'Химия', question: 'Формула соли?', answer: 'NaCl', options: ['NaCl', 'NaOH', 'HCl', 'KCl'], correctIndex: 0 },
            { category: 'Химия', question: 'Углекислый газ?', answer: 'CO₂', options: ['O₂', 'CO₂', 'CO', 'C₂O'], correctIndex: 1 },
            { category: 'Химия', question: 'pH воды?', answer: '7', options: ['5', '6', '7', '8'], correctIndex: 2 },
            { category: 'Химия', question: 'Железо символ?', answer: 'Fe', options: ['Fe', 'Zn', 'Cu', 'Ag'], correctIndex: 0 },
            { category: 'Химия', question: 'Самый легкий элемент?', answer: 'Водород', options: ['Гелий', 'Водород', 'Литий', 'Углерод'], correctIndex: 1 },
            { category: 'Химия', question: 'Валентность кислорода?', answer: '2', options: ['1', '2', '3', '4'], correctIndex: 1 },

            { category: 'Химия', question: 'Благородный газ?', answer: 'Гелий', options: ['Кислород', 'Азот', 'Гелий', 'Водород'], correctIndex: 2 },
            { category: 'Химия', question: 'Серебро символ?', answer: 'Ag', options: ['Ag', 'Au', 'Al', 'Ar'], correctIndex: 0 },
            { category: 'Химия', question: 'Кислота имеет pH?', answer: 'Меньше 7', options: ['Больше 7', 'Меньше 7', 'Равно 7', 'Любое'], correctIndex: 1 },
            { category: 'Химия', question: 'Медь символ?', answer: 'Cu', options: ['Co', 'Cu', 'Cr', 'Ca'], correctIndex: 1 },
            { category: 'Химия', question: 'Азот символ?', answer: 'N', options: ['N', 'Na', 'Ne', 'Ni'], correctIndex: 0 },

            // Литература (10 вопросов)
            { category: 'Литература', question: 'Автор "Войны и мира"?', answer: 'Толстой', options: ['Достоевский', 'Толстой', 'Чехов', 'Пушкин'], correctIndex: 1 },
            { category: 'Литература', question: 'Поэма "Руслан и Людмила"?', answer: 'Пушкин', options: ['Лермонтов', 'Пушкин', 'Некрасов', 'Тютчев'], correctIndex: 1 },
            { category: 'Литература', question: '"Мёртвые души" автор?', answer: 'Гоголь', options: ['Гоголь', 'Чехов', 'Тургенев', 'Салтыков-Щедрин'], correctIndex: 0 },
            { category: 'Литература', question: '"Евгений Онегин" кто?', answer: 'Пушкин', options: ['Пушкин', 'Лермонтов', 'Тютчев', 'Фет'], correctIndex: 0 },
            { category: 'Литература', question: '"Преступление и наказание"?', answer: 'Достоевский', options: ['Толстой', 'Достоевский', 'Тургенев', 'Чехов'], correctIndex: 1 },
            { category: 'Литература', question: '"Муму" автор?', answer: 'Тургенев', options: ['Гоголь', 'Тургенев', 'Чехов', 'Некрасов'], correctIndex: 1 },
            { category: 'Литература', question: 'Поэт "Бородино"?', answer: 'Лермонтов', options: ['Пушкин', 'Лермонтов', 'Некрасов', 'Тютчев'], correctIndex: 1 },
            { category: 'Литература', question: '"Анна Каренина" кто?', answer: 'Толстой', options: ['Достоевский', 'Толстой', 'Тургенев', 'Чехов'], correctIndex: 1 },
            { category: 'Литература', question: '"Ревизор" автор?', answer: 'Гоголь', options: ['Гоголь', 'Грибоедов', 'Фонвизин', 'Островский'], correctIndex: 0 },
            { category: 'Литература', question: '"Горе от ума" кто?', answer: 'Грибоедов', options: ['Гоголь', 'Грибоедов', 'Фонвизин', 'Пушкин'], correctIndex: 1 },

            // Информатика (10 вопросов)
            { category: 'Информатика', question: 'Единица информации?', answer: 'Бит', options: ['Бит', 'Байт', 'Килобайт', 'Мегабайт'], correctIndex: 0 },
            { category: 'Информатика', question: '1 байт = ? бит', answer: '8', options: ['4', '8', '16', '32'], correctIndex: 1 },
            { category: 'Информатика', question: 'Устройство ввода?', answer: 'Клавиатура', options: ['Монитор', 'Клавиатура', 'Принтер', 'Колонки'], correctIndex: 1 },
            { category: 'Информатика', question: 'Устройство вывода?', answer: 'Монитор', options: ['Монитор', 'Мышь', 'Сканер', 'Микрофон'], correctIndex: 0 },
            { category: 'Информатика', question: 'ОЗУ - это?', answer: 'Оперативная память', options: ['Процессор', 'Оперативная память', 'Жесткий диск', 'Видеокарта'], correctIndex: 1 },
            { category: 'Информатика', question: 'CPU - это?', answer: 'Процессор', options: ['Процессор', 'Память', 'Монитор', 'Диск'], correctIndex: 0 },
            { category: 'Информатика', question: 'Программа просмотра веб?', answer: 'Браузер', options: ['Браузер', 'Редактор', 'Плеер', 'Архиватор'], correctIndex: 0 },
            { category: 'Информатика', question: 'Вредоносная программа?', answer: 'Вирус', options: ['Антивирус', 'Вирус', 'Файервол', 'Браузер'], correctIndex: 1 },
            { category: 'Информатика', question: 'WWW - это?', answer: 'World Wide Web', options: ['World Wide Web', 'Windows World', 'Web Work World', 'World Web Work'], correctIndex: 0 },
            { category: 'Информатика', question: 'Расширение текстового файла?', answer: '.txt', options: ['.txt', '.exe', '.jpg', '.mp3'], correctIndex: 0 }
        ];
    }
}
