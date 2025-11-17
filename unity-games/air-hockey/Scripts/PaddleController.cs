using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

namespace AirHockey
{
    /// <summary>
    /// Controls paddle movement via touch input
    /// Supports multi-touch for multiple players
    /// </summary>
    public class PaddleController : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private int playerNumber = 1; // 1 or 2
        [SerializeField] private float movementSpeed = 15f;
        [SerializeField] private float paddleRadius = 0.5f;

        [Header("Movement Constraints")]
        [SerializeField] private bool constrainToHalf = true;
        [SerializeField] private float minX = -8f;
        [SerializeField] private float maxX = 8f;
        [SerializeField] private float minY = -4f;
        [SerializeField] private float maxY = 4f;

        private Camera mainCamera;
        private Rigidbody2D rb;
        private Vector2 targetPosition;
        private int assignedTouchId = -1;

        void Awake()
        {
            rb = GetComponent<Rigidbody2D>();
            mainCamera = Camera.main;
            targetPosition = transform.position;
        }

        void OnEnable()
        {
            EnhancedTouchSupport.Enable();
        }

        void OnDisable()
        {
            EnhancedTouchSupport.Disable();
        }

        void Update()
        {
            HandleTouchInput();
        }

        void FixedUpdate()
        {
            // Move paddle towards target position
            Vector2 newPosition = Vector2.Lerp(rb.position, targetPosition, movementSpeed * Time.fixedDeltaTime);

            // Apply constraints
            newPosition.x = Mathf.Clamp(newPosition.x, minX, maxX);
            newPosition.y = Mathf.Clamp(newPosition.y, minY, maxY);

            // Constrain to player's half
            if (constrainToHalf)
            {
                if (playerNumber == 1)
                    newPosition.y = Mathf.Min(newPosition.y, -0.5f); // Bottom half
                else if (playerNumber == 2)
                    newPosition.y = Mathf.Max(newPosition.y, 0.5f);  // Top half
            }

            rb.MovePosition(newPosition);
        }

        void HandleTouchInput()
        {
            if (Touch.activeTouches.Count == 0)
            {
                assignedTouchId = -1;
                return;
            }

            // Find touch for this paddle
            Touch? activeTouch = null;

            // Try to find our assigned touch
            if (assignedTouchId >= 0)
            {
                foreach (var touch in Touch.activeTouches)
                {
                    if (touch.touchId == assignedTouchId)
                    {
                        activeTouch = touch;
                        break;
                    }
                }
            }

            // If no assigned touch, find nearest touch in our half
            if (!activeTouch.HasValue)
            {
                float nearestDistance = float.MaxValue;

                foreach (var touch in Touch.activeTouches)
                {
                    Vector2 worldPos = mainCamera.ScreenToWorldPoint(touch.screenPosition);

                    // Check if touch is in our half
                    bool inOurHalf = (playerNumber == 1 && worldPos.y < 0) ||
                                     (playerNumber == 2 && worldPos.y > 0);

                    if (inOurHalf)
                    {
                        float distance = Vector2.Distance(worldPos, rb.position);
                        if (distance < nearestDistance)
                        {
                            nearestDistance = distance;
                            activeTouch = touch;
                            assignedTouchId = touch.touchId;
                        }
                    }
                }
            }

            // Update target position
            if (activeTouch.HasValue)
            {
                Vector2 worldPos = mainCamera.ScreenToWorldPoint(activeTouch.Value.screenPosition);
                targetPosition = worldPos;
            }
        }

        void OnCollisionEnter2D(Collision2D collision)
        {
            // Add force to puck on collision
            if (collision.gameObject.CompareTag("Puck"))
            {
                Rigidbody2D puckRb = collision.rigidbody;
                if (puckRb != null)
                {
                    Vector2 hitDirection = (collision.transform.position - transform.position).normalized;
                    float hitForce = rb.velocity.magnitude * 100f;
                    puckRb.AddForce(hitDirection * hitForce);
                }
            }
        }

        void OnDrawGizmosSelected()
        {
            // Draw movement bounds
            Gizmos.color = Color.yellow;
            Vector3 bottomLeft = new Vector3(minX, minY, 0);
            Vector3 bottomRight = new Vector3(maxX, minY, 0);
            Vector3 topLeft = new Vector3(minX, maxY, 0);
            Vector3 topRight = new Vector3(maxX, maxY, 0);

            Gizmos.DrawLine(bottomLeft, bottomRight);
            Gizmos.DrawLine(bottomRight, topRight);
            Gizmos.DrawLine(topRight, topLeft);
            Gizmos.DrawLine(topLeft, bottomLeft);
        }
    }
}
