#🚀 Space Defender - Unity Setup Guide

Кооперативный космический шутер с волнами врагов и мультитач поддержкой.

---

## 📋 Шаг 1: Создание проекта

1. Unity Hub → New Project
2. Template: **2D (URP)**
3. Project Name: `SpaceDefender`
4. Location: `unity-games/space-defender/`
5. Create Project

---

## 📦 Шаг 2: Packages

```
Window → Package Manager

Install:
- Input System
- 2D Sprite
- 2D Physics
- TextMesh Pro
- Cinemachine (optional, for camera shake)
```

---

## 🎨 Шаг 3: Scene Structure

```
SpaceDefender
├── Main Camera
├── GameManager
├── Canvas
│   ├── ScoreText
│   ├── WaveText
│   ├── LivesDisplay
│   └── InstructionsText
├── PlayerShips (Empty, ships spawn here)
├── Enemies (Empty, enemy container)
├── Bullets (Empty, bullet pool)
├── Background
│   ├── Starfield1 (Parallax layer 1)
│   ├── Starfield2 (Parallax layer 2)
│   └── Starfield3 (Parallax layer 3)
└── Managers
    ├── EnemySpawner
    ├── BulletPool
    └── AudioManager
```

---

## 🚀 Шаг 4: Player Ship Prefab

### ShipController Setup:

**GameObject Structure:**
```
PlayerShip
├── ShipSprite (Triangle/Spaceship)
├── FirePoint (Empty, front of ship)
├── ThrustParticles
├── Shield (Circle sprite, optional)
└── TrailRenderer
```

**Components:**
- Rigidbody2D (Kinematic)
- CircleCollider2D (Trigger)
- ShipController.cs
- TrailRenderer

**Settings:**
- Move Speed: 10
- Fire Rate: 0.2 (5 shots/sec)
- Color: Unique per player

---

## 👾 Шаг 5: Enemy Types

### Enemy Prefabs:

**1. Basic Enemy:**
```
- Health: 1
- Speed: 2
- Points: 10
- Sprite: Basic alien
```

**2. Fast Enemy:**
```
- Health: 1
- Speed: 4
- Points: 20
- Sprite: Small UFO
```

**3. Tank Enemy:**
```
- Health: 3
- Speed: 1
- Points: 30
- Sprite: Large boss
```

### EnemyController.cs:

```csharp
using UnityEngine;

public class EnemyController : MonoBehaviour
{
    [SerializeField] private int health = 1;
    [SerializeField] private float speed = 2f;
    [SerializeField] private int points = 10;

    void Update()
    {
        // Move downward
        transform.Translate(Vector3.down * speed * Time.deltaTime);

        // Destroy if off screen
        if (transform.position.y < -10f)
        {
            GameManager.Instance.LoseLife();
            Destroy(gameObject);
        }
    }

    public void TakeDamage(int damage)
    {
        health -= damage;

        if (health <= 0)
        {
            GameManager.Instance.AddScore(points);
            CreateExplosion();
            Destroy(gameObject);
        }
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Bullet"))
        {
            TakeDamage(1);
            Destroy(other.gameObject);
        }
    }

    void CreateExplosion()
    {
        // Spawn explosion particles
    }
}
```

---

## 🔫 Шаг 6: Bullet System

### BulletPool.cs:

```csharp
using UnityEngine;
using System.Collections.Generic;

public class BulletPool : MonoBehaviour
{
    [SerializeField] private GameObject bulletPrefab;
    [SerializeField] private int poolSize = 50;

    private Queue<GameObject> bulletPool;

    void Awake()
    {
        bulletPool = new Queue<GameObject>();

        for (int i = 0; i < poolSize; i++)
        {
            GameObject bullet = Instantiate(bulletPrefab, transform);
            bullet.SetActive(false);
            bulletPool.Enqueue(bullet);
        }
    }

    public GameObject GetBullet()
    {
        if (bulletPool.Count > 0)
        {
            GameObject bullet = bulletPool.Dequeue();
            bullet.SetActive(true);
            return bullet;
        }
        else
        {
            // Create new if pool exhausted
            return Instantiate(bulletPrefab, transform);
        }
    }

    public void ReturnBullet(GameObject bullet)
    {
        bullet.SetActive(false);
        bulletPool.Enqueue(bullet);
    }
}
```

### Bullet Prefab:

```
Components:
- SpriteRenderer (small laser)
- Rigidbody2D (Kinematic)
- BoxCollider2D (Trigger)
- Auto-destroy after 3 seconds
```

---

## 🌊 Шаг 7: Wave System

### EnemySpawner.cs:

```csharp
using UnityEngine;
using System.Collections;

public class EnemySpawner : MonoBehaviour
{
    [Header("Enemy Prefabs")]
    [SerializeField] private GameObject basicEnemyPrefab;
    [SerializeField] private GameObject fastEnemyPrefab;
    [SerializeField] private GameObject tankEnemyPrefab;

    [Header("Wave Settings")]
    [SerializeField] private int currentWave = 1;
    [SerializeField] private float spawnInterval = 1f;

    private int enemiesPerWave => 5 + currentWave * 2;
    private int enemiesSpawned = 0;

    void Start()
    {
        StartCoroutine(SpawnWave());
    }

    IEnumerator SpawnWave()
    {
        enemiesSpawned = 0;

        while (enemiesSpawned < enemiesPerWave)
        {
            SpawnRandomEnemy();
            enemiesSpawned++;
            yield return new WaitForSeconds(spawnInterval);
        }

        // Check if wave complete
        yield return new WaitUntil(() => FindObjectsOfType<EnemyController>().Length == 0);

        currentWave++;
        yield return new WaitForSeconds(2f);
        StartCoroutine(SpawnWave());
    }

    void SpawnRandomEnemy()
    {
        // Choose enemy type based on wave
        GameObject enemyPrefab = basicEnemyPrefab;

        float rand = Random.value;
        if (currentWave >= 3 && rand < 0.3f)
            enemyPrefab = fastEnemyPrefab;
        else if (currentWave >= 5 && rand < 0.15f)
            enemyPrefab = tankEnemyPrefab;

        // Spawn at random X position
        float xPos = Random.Range(-8f, 8f);
        Vector3 spawnPos = new Vector3(xPos, 10f, 0);

        Instantiate(enemyPrefab, spawnPos, Quaternion.identity, transform);
    }
}
```

---

## 🎮 Шаг 8: Game Manager

### GameManager.cs:

```csharp
using UnityEngine;
using TMPro;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance;

    [Header("UI")]
    [SerializeField] private TextMeshProUGUI scoreText;
    [SerializeField] private TextMeshProUGUI waveText;
    [SerializeField] private TextMeshProUGUI livesText;

    private int score = 0;
    private int lives = 3;
    private int currentWave = 1;

    void Awake()
    {
        Instance = this;
    }

    void Start()
    {
        UpdateUI();
    }

    public void AddScore(int points)
    {
        score += points;
        UpdateUI();
    }

    public void LoseLife()
    {
        lives--;
        UpdateUI();

        if (lives <= 0)
            GameOver();
    }

    public void NextWave()
    {
        currentWave++;
        UpdateUI();
    }

    void UpdateUI()
    {
        scoreText.text = $"Score: {score}";
        waveText.text = $"Wave {currentWave}";
        livesText.text = new string('❤', lives);
    }

    void GameOver()
    {
        // Show game over screen
        Time.timeScale = 0;
    }
}
```

---

## ⭐ Шаг 9: Starfield Background

### Parallax Scrolling:

```csharp
using UnityEngine;

public class ParallaxBackground : MonoBehaviour
{
    [SerializeField] private float scrollSpeed = 2f;
    [SerializeField] private float resetY = -20f;

    void Update()
    {
        transform.Translate(Vector3.down * scrollSpeed * Time.deltaTime);

        if (transform.position.y < resetY)
        {
            transform.position = new Vector3(
                transform.position.x,
                -resetY,
                transform.position.z
            );
        }
    }
}
```

**Setup:**
- Create 3 layers of stars
- Different speeds (1x, 2x, 3x)
- Duplicate sprites for seamless loop

---

## 💥 Шаг 10: Particle Effects

### Explosion Effect:

```
Particle System Settings:
- Duration: 0.5s
- Start Lifetime: 0.3-0.5s
- Start Speed: 10-20
- Start Size: 0.2-0.5
- Emission: Burst 30 particles
- Shape: Sphere, Radius 0.5
- Color Over Lifetime: Yellow → Red → Transparent
```

### Trail Renderer (Ships):

```
Settings:
- Time: 0.3s
- Width: 0.1 → 0
- Color: Ship color with alpha fade
- Material: Additive
```

---

## 🔧 Шаг 11: Project Settings

### Physics 2D:

```
Layers:
- 8: Player
- 9: Enemy
- 10: PlayerBullet
- 11: EnemyBullet (future)

Layer Collision Matrix:
- Player vs Enemy: ✓
- Player vs EnemyBullet: ✓
- Enemy vs PlayerBullet: ✓
- PlayerBullet vs EnemyBullet: ✗
```

### Tags:

```
- Player
- Enemy
- Bullet
- PowerUp (future)
```

---

## 🎵 Шаг 12: Audio

### Sound Effects:

- **Shoot:** Laser sound (0.1s)
- **Explosion:** Boom sound (0.5s)
- **Hit:** Impact sound (0.05s)
- **Game Over:** Dramatic sound

### Background Music:

- Epic space music (loop)
- Intensity increases with waves

---

## 🔧 Шаг 13: Build Settings

```
File → Build Settings

Platform: Windows x64

Player Settings:
- Resolution: 1920x1080
- Fullscreen: Fullscreen Window
- V Sync: On
- Quality: Medium-High

Optimizations:
- Scripting Backend: IL2CPP
- Stripping Level: Medium
- Managed Code Stripping: ✓
```

---

## 🎯 Шаг 14: Balancing

### Difficulty Curve:

```
Wave 1-2: Basic enemies only
Wave 3-4: Add fast enemies (30%)
Wave 5+: Add tanks (15%)
Wave 10+: Increase spawn rate

Enemy Count: 5 + (wave * 2)
Max Enemies On Screen: 20
```

### Power-Ups (Optional):

```
- Shield: Temporary invincibility
- Rapid Fire: 2x fire rate
- Multi-Shot: 3 bullets at once
```

---

## ✅ Testing Checklist

- [ ] Ships spawn on touch
- [ ] Auto-shooting works
- [ ] Enemies spawn correctly
- [ ] Collisions work
- [ ] Waves progress
- [ ] Score updates
- [ ] Lives decrease
- [ ] Game over triggers
- [ ] Multi-touch (4 ships)
- [ ] Performance (60 FPS)

---

## 📦 Final Build

```
SpaceDefender/
├── Space Defender.exe
└── Space Defender_Data/
```

**Size:** ~45MB

---

## 🎉 Готово!

Космический защитник готов! Соберите друзей и защитите планету! 🚀🛸
