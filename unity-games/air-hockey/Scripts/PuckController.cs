using UnityEngine;

namespace AirHockey
{
    /// <summary>
    /// Controls puck physics and behavior
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    [RequireComponent(typeof(CircleCollider2D))]
    public class PuckController : MonoBehaviour
    {
        [Header("Physics Settings")]
        [SerializeField] private float maxSpeed = 25f;
        [SerializeField] private float minSpeed = 0.5f;
        [SerializeField] private float wallBounceMultiplier = 0.9f;

        [Header("Trail Effect")]
        [SerializeField] private TrailRenderer trail;
        [SerializeField] private float trailTimeThreshold = 10f;

        private Rigidbody2D rb;
        private Vector2 lastVelocity;

        void Awake()
        {
            rb = GetComponent<Rigidbody2D>();

            // Configure rigidbody
            rb.gravityScale = 0f;
            rb.drag = 0.5f;
            rb.angularDrag = 0.5f;
            rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        }

        void Start()
        {
            // Give initial push
            Vector2 randomDirection = Random.insideUnitCircle.normalized;
            rb.AddForce(randomDirection * 300f);
        }

        void FixedUpdate()
        {
            // Limit speed
            if (rb.velocity.magnitude > maxSpeed)
            {
                rb.velocity = rb.velocity.normalized * maxSpeed;
            }

            // Stop if too slow
            if (rb.velocity.magnitude < minSpeed)
            {
                rb.velocity = Vector2.zero;
            }

            // Update trail visibility based on speed
            if (trail != null)
            {
                trail.emitting = rb.velocity.magnitude > trailTimeThreshold;
            }

            lastVelocity = rb.velocity;
        }

        void OnCollisionEnter2D(Collision2D collision)
        {
            // Wall bounce
            if (collision.gameObject.CompareTag("Wall"))
            {
                // Reduce velocity slightly on wall bounce
                rb.velocity *= wallBounceMultiplier;

                // Play sound effect (if audio manager exists)
                // AudioManager.Instance?.PlaySound("wall_hit");
            }
            // Paddle bounce
            else if (collision.gameObject.CompareTag("Paddle"))
            {
                // Play sound effect
                // AudioManager.Instance?.PlaySound("paddle_hit");
            }
        }

        /// <summary>
        /// Reset puck to center with random velocity
        /// </summary>
        public void ResetPuck()
        {
            transform.position = Vector3.zero;
            rb.velocity = Vector2.zero;
            rb.angularVelocity = 0f;

            // Give new random push
            Vector2 randomDirection = Random.insideUnitCircle.normalized;
            rb.AddForce(randomDirection * 300f);
        }

        /// <summary>
        /// Add force to puck
        /// </summary>
        public void AddImpulse(Vector2 force)
        {
            rb.AddForce(force, ForceMode2D.Impulse);
        }
    }
}
