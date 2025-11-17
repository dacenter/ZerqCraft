using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

namespace SpaceDefender
{
    /// <summary>
    /// Player ship controller with touch input and auto-shooting
    /// </summary>
    public class ShipController : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float moveSpeed = 10f;
        [SerializeField] private float smoothing = 5f;

        [Header("Shooting")]
        [SerializeField] private Transform firePoint;
        [SerializeField] private GameObject bulletPrefab;
        [SerializeField] private float fireRate = 0.2f;
        [SerializeField] private float bulletSpeed = 20f;

        [Header("Visuals")]
        [SerializeField] private Color shipColor = Color.cyan;
        [SerializeField] private ParticleSystem thrustParticles;
        [SerializeField] private TrailRenderer trail;

        private Camera mainCamera;
        private Vector2 targetPosition;
        private float nextFireTime;
        private int assignedTouchId = -1;
        private bool isActive = false;

        void Awake()
        {
            mainCamera = Camera.main;
            targetPosition = transform.position;

            // Set ship color
            Renderer renderer = GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.color = shipColor;
            }

            if (trail != null)
            {
                trail.startColor = shipColor;
                trail.endColor = new Color(shipColor.r, shipColor.g, shipColor.b, 0);
            }
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

            if (isActive)
            {
                // Auto shoot
                if (Time.time >= nextFireTime)
                {
                    Shoot();
                    nextFireTime = Time.time + fireRate;
                }

                // Update thrust particles
                if (thrustParticles != null && !thrustParticles.isPlaying)
                {
                    thrustParticles.Play();
                }
            }
            else
            {
                if (thrustParticles != null && thrustParticles.isPlaying)
                {
                    thrustParticles.Stop();
                }
            }
        }

        void FixedUpdate()
        {
            if (isActive)
            {
                // Smooth movement
                Vector2 newPosition = Vector2.Lerp(
                    transform.position,
                    targetPosition,
                    smoothing * Time.fixedDeltaTime
                );

                // Keep in bounds
                float halfWidth = mainCamera.orthographicSize * mainCamera.aspect;
                float halfHeight = mainCamera.orthographicSize;

                newPosition.x = Mathf.Clamp(newPosition.x, -halfWidth + 1f, halfWidth - 1f);
                newPosition.y = Mathf.Clamp(newPosition.y, -halfHeight + 1f, halfHeight - 1f);

                transform.position = newPosition;
            }
        }

        void HandleTouchInput()
        {
            if (Touch.activeTouches.Count == 0)
            {
                isActive = false;
                assignedTouchId = -1;
                return;
            }

            Touch? activeTouch = null;

            // Find our touch
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

            // Assign new touch
            if (!activeTouch.HasValue)
            {
                foreach (var touch in Touch.activeTouches)
                {
                    Vector2 worldPos = mainCamera.ScreenToWorldPoint(touch.screenPosition);
                    float distance = Vector2.Distance(worldPos, transform.position);

                    if (distance < 100f) // Assign to nearest ship
                    {
                        activeTouch = touch;
                        assignedTouchId = touch.touchId;
                        isActive = true;
                        break;
                    }
                }
            }

            // Update target
            if (activeTouch.HasValue)
            {
                Vector2 worldPos = mainCamera.ScreenToWorldPoint(activeTouch.Value.screenPosition);
                targetPosition = worldPos;
                isActive = true;
            }
        }

        void Shoot()
        {
            if (bulletPrefab == null || firePoint == null)
                return;

            GameObject bullet = Instantiate(bulletPrefab, firePoint.position, firePoint.rotation);

            Rigidbody2D rb = bullet.GetComponent<Rigidbody2D>();
            if (rb != null)
            {
                rb.velocity = firePoint.up * bulletSpeed;
            }

            // Set bullet color to match ship
            Renderer renderer = bullet.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.color = shipColor;
            }

            // Auto destroy after 3 seconds
            Destroy(bullet, 3f);
        }

        void OnTriggerEnter2D(Collider2D other)
        {
            if (other.CompareTag("Enemy"))
            {
                // Destroy enemy on collision
                Destroy(other.gameObject);

                // Award points
                // GameManager.Instance?.AddScore(10);

                // Visual effect
                // ExplosionManager.Instance?.CreateExplosion(other.transform.position);
            }
        }
    }
}
