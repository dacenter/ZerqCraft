using UnityEngine;
using DG.Tweening;

namespace MemoryMatch
{
    /// <summary>
    /// Individual card controller with flip animation
    /// Requires DOTween for smooth animations
    /// </summary>
    public class CardController : MonoBehaviour
    {
        [Header("Card Data")]
        [SerializeField] private int cardId;
        [SerializeField] private Sprite frontSprite;
        [SerializeField] private Sprite backSprite;

        [Header("Visual Components")]
        [SerializeField] private SpriteRenderer spriteRenderer;
        [SerializeField] private ParticleSystem matchParticles;

        [Header("Animation Settings")]
        [SerializeField] private float flipDuration = 0.3f;
        [SerializeField] private Ease flipEase = Ease.OutQuad;

        private bool isFlipped = false;
        private bool isMatched = false;
        private bool isFlipping = false;

        public int CardId => cardId;
        public bool IsFlipped => isFlipped;
        public bool IsMatched => isMatched;
        public bool IsFlipping => isFlipping;

        void Awake()
        {
            if (spriteRenderer == null)
                spriteRenderer = GetComponent<SpriteRenderer>();

            // Start face down
            spriteRenderer.sprite = backSprite;
        }

        public void Initialize(int id, Sprite sprite)
        {
            cardId = id;
            frontSprite = sprite;
            isFlipped = false;
            isMatched = false;

            if (spriteRenderer != null)
                spriteRenderer.sprite = backSprite;

            transform.localScale = Vector3.one;
        }

        public void Flip(bool faceUp, System.Action onComplete = null)
        {
            if (isFlipping || isMatched)
                return;

            isFlipping = true;
            isFlipped = faceUp;

            // Flip animation using DOTween
            Sequence flipSequence = DOTween.Sequence();

            // Scale to 0 on X axis (edge-on)
            flipSequence.Append(transform.DOScaleX(0f, flipDuration / 2).SetEase(flipEase));

            // Change sprite at midpoint
            flipSequence.AppendCallback(() =>
            {
                spriteRenderer.sprite = faceUp ? frontSprite : backSprite;
            });

            // Scale back to 1
            flipSequence.Append(transform.DOScaleX(1f, flipDuration / 2).SetEase(flipEase));

            // Complete
            flipSequence.OnComplete(() =>
            {
                isFlipping = false;
                onComplete?.Invoke();
            });
        }

        public void SetMatched()
        {
            isMatched = true;

            // Fade out animation
            DOTween.Sequence()
                .Append(transform.DOScale(1.2f, 0.2f))
                .Append(transform.DOScale(1f, 0.2f))
                .Append(spriteRenderer.DOFade(0.5f, 0.3f));

            // Play particles
            if (matchParticles != null)
                matchParticles.Play();
        }

        public void Reset()
        {
            isFlipped = false;
            isMatched = false;
            isFlipping = false;

            transform.localScale = Vector3.one;
            spriteRenderer.sprite = backSprite;
            spriteRenderer.color = Color.white;
        }

        void OnMouseDown()
        {
            // Handle click (if using mouse for testing)
            if (!isFlipped && !isMatched && !isFlipping)
            {
                // CardManager.Instance?.OnCardClicked(this);
            }
        }

        void OnTriggerEnter2D(Collider2D other)
        {
            // Handle touch (for actual touch input)
            if (other.CompareTag("TouchPointer") && !isFlipped && !isMatched && !isFlipping)
            {
                // CardManager.Instance?.OnCardClicked(this);
            }
        }
    }
}
