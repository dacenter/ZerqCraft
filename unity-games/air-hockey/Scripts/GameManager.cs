using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

namespace AirHockey
{
    /// <summary>
    /// Main game manager for Air Hockey
    /// Handles score, game state, and UI
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        [Header("Game Settings")]
        [SerializeField] private int scoreToWin = 7;
        [SerializeField] private float resetDelay = 2f;

        [Header("UI References")]
        [SerializeField] private Text player1ScoreText;
        [SerializeField] private Text player2ScoreText;
        [SerializeField] private Text winnerText;
        [SerializeField] private GameObject gameOverPanel;

        [Header("Game Objects")]
        [SerializeField] private Transform puck;
        [SerializeField] private Transform paddle1;
        [SerializeField] private Transform paddle2;

        private int player1Score = 0;
        private int player2Score = 0;
        private bool gameOver = false;

        private Vector3 puckStartPos;
        private Vector3 paddle1StartPos;
        private Vector3 paddle2StartPos;

        private static GameManager instance;
        public static GameManager Instance => instance;

        void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            instance = this;

            // Store initial positions
            if (puck != null) puckStartPos = puck.position;
            if (paddle1 != null) paddle1StartPos = paddle1.position;
            if (paddle2 != null) paddle2StartPos = paddle2.position;
        }

        void Start()
        {
            UpdateScoreUI();
            if (gameOverPanel != null)
                gameOverPanel.SetActive(false);
        }

        void Update()
        {
            // ESC to quit
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Application.Quit();
            }
        }

        /// <summary>
        /// Called when a goal is scored
        /// </summary>
        public void OnGoalScored(int player)
        {
            if (gameOver) return;

            if (player == 1)
                player1Score++;
            else if (player == 2)
                player2Score++;

            UpdateScoreUI();

            // Check for winner
            if (player1Score >= scoreToWin)
            {
                EndGame(1);
            }
            else if (player2Score >= scoreToWin)
            {
                EndGame(2);
            }
            else
            {
                // Reset puck and paddles
                Invoke(nameof(ResetPositions), resetDelay);
            }
        }

        void UpdateScoreUI()
        {
            if (player1ScoreText != null)
                player1ScoreText.text = player1Score.ToString();

            if (player2ScoreText != null)
                player2ScoreText.text = player2Score.ToString();
        }

        void ResetPositions()
        {
            // Reset puck
            if (puck != null)
            {
                puck.position = puckStartPos;
                Rigidbody2D puckRb = puck.GetComponent<Rigidbody2D>();
                if (puckRb != null)
                {
                    puckRb.velocity = Vector2.zero;
                    puckRb.angularVelocity = 0f;

                    // Give random initial push
                    float angle = Random.Range(0f, 360f) * Mathf.Deg2Rad;
                    Vector2 direction = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                    puckRb.AddForce(direction * 300f);
                }
            }

            // Reset paddles
            if (paddle1 != null)
                paddle1.position = paddle1StartPos;

            if (paddle2 != null)
                paddle2.position = paddle2StartPos;
        }

        void EndGame(int winner)
        {
            gameOver = true;

            if (winnerText != null)
            {
                string playerName = winner == 1 ? "ИГРОК 1 (Синий)" : "ИГРОК 2 (Красный)";
                winnerText.text = $"🏆 ПОБЕДИЛ {playerName}!\n\nСчет: {player1Score} : {player2Score}";
            }

            if (gameOverPanel != null)
                gameOverPanel.SetActive(true);
        }

        /// <summary>
        /// Restart the game
        /// </summary>
        public void RestartGame()
        {
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        /// <summary>
        /// Quit to menu or exit
        /// </summary>
        public void QuitGame()
        {
            Application.Quit();
        }
    }
}
