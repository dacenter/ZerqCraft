using UnityEngine;

namespace AirHockey
{
    /// <summary>
    /// Detects when puck enters goal zone
    /// </summary>
    public class GoalDetector : MonoBehaviour
    {
        [SerializeField] private int scoringPlayer = 1; // Which player scores when puck enters this goal

        [Header("Visual Effects")]
        [SerializeField] private ParticleSystem goalParticles;
        [SerializeField] private Color goalColor = Color.green;

        void OnTriggerEnter2D(Collider2D other)
        {
            if (other.CompareTag("Puck"))
            {
                OnGoal();
            }
        }

        void OnGoal()
        {
            // Notify game manager
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGoalScored(scoringPlayer);
            }

            // Play particles
            if (goalParticles != null)
            {
                var main = goalParticles.main;
                main.startColor = goalColor;
                goalParticles.Play();
            }

            // Play sound
            // AudioManager.Instance?.PlaySound("goal");

            Debug.Log($"Goal! Player {scoringPlayer} scores!");
        }

        void OnDrawGizmos()
        {
            // Draw goal zone
            Gizmos.color = new Color(goalColor.r, goalColor.g, goalColor.b, 0.3f);
            BoxCollider2D box = GetComponent<BoxCollider2D>();
            if (box != null)
            {
                Gizmos.matrix = transform.localToWorldMatrix;
                Gizmos.DrawCube(box.offset, box.size);
            }
        }
    }
}
