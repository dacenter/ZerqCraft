using UnityEngine;

namespace WhackAMole
{
    /// <summary>
    /// Controls individual mole behavior - appearing, hiding, and being hit
    /// </summary>
    public class MoleController : MonoBehaviour
    {
        [Header("Mole Settings")]
        [SerializeField] private bool isGolden = false;
        [SerializeField] private float popUpTime = 0.3f;
        [SerializeField] private float hideTime = 0.3f;
        [SerializeField] private float visibleDuration = 1.5f;

        [Header("Visuals")]
        [SerializeField] private GameObject moleModel;
        [SerializeField] private Material normalMaterial;
        [SerializeField] private Material goldenMaterial;
        [SerializeField] private ParticleSystem hitParticles;

        private enum MoleState { Hidden, Appearing, Visible, Disappearing, Hit }
        private MoleState currentState = MoleState.Hidden;

        private Vector3 hiddenPosition;
        private Vector3 visiblePosition;
        private float stateTimer;

        void Awake()
        {
            if (moleModel != null)
            {
                hiddenPosition = moleModel.transform.localPosition;
                visiblePosition = hiddenPosition + Vector3.up * 2f;
            }
        }

        void Update()
        {
            UpdateMoleState();
        }

        void UpdateMoleState()
        {
            stateTimer -= Time.deltaTime;

            switch (currentState)
            {
                case MoleState.Appearing:
                    float appearProgress = 1f - (stateTimer / popUpTime);
                    moleModel.transform.localPosition = Vector3.Lerp(hiddenPosition, visiblePosition, appearProgress);

                    if (stateTimer <= 0)
                    {
                        currentState = MoleState.Visible;
                        stateTimer = visibleDuration;
                    }
                    break;

                case MoleState.Visible:
                    if (stateTimer <= 0)
                    {
                        Hide();
                    }
                    break;

                case MoleState.Disappearing:
                    float hideProgress = stateTimer / hideTime;
                    moleModel.transform.localPosition = Vector3.Lerp(hiddenPosition, visiblePosition, hideProgress);

                    if (stateTimer <= 0)
                    {
                        currentState = MoleState.Hidden;
                    }
                    break;
            }
        }

        public void PopUp(bool golden = false)
        {
            if (currentState != MoleState.Hidden)
                return;

            isGolden = golden;
            currentState = MoleState.Appearing;
            stateTimer = popUpTime;

            // Set material
            if (moleModel != null)
            {
                Renderer renderer = moleModel.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.material = isGolden ? goldenMaterial : normalMaterial;
                }
            }
        }

        public void Hide()
        {
            if (currentState == MoleState.Hidden || currentState == MoleState.Disappearing)
                return;

            currentState = MoleState.Disappearing;
            stateTimer = hideTime;
        }

        public void Hit()
        {
            if (currentState != MoleState.Visible && currentState != MoleState.Appearing)
                return;

            currentState = MoleState.Hit;

            // Award points
            int points = isGolden ? 50 : 10;
            // MoleManager.Instance?.AddScore(points);

            // Visual effects
            if (hitParticles != null)
                hitParticles.Play();

            // Hide immediately
            Hide();
        }

        public bool IsHittable()
        {
            return currentState == MoleState.Visible || currentState == MoleState.Appearing;
        }
    }
}
