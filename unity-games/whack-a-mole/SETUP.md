# 🔨 Whack-a-Mole - Unity Setup Guide

Создание 3D игры Whack-a-Mole с мультитач поддержкой.

---

## 📋 Шаг 1: Создание проекта

1. Unity Hub → New Project
2. Template: **3D (URP)** или **3D Core**
3. Project Name: `WhackAMole`
4. Location: `unity-games/whack-a-mole/`
5. Create Project

---

## 📦 Шаг 2: Зависимости

```
Window → Package Manager

Установить:
- Input System
- ProBuilder (для создания 3D моделей)
- TextMesh Pro
- Particle System (встроен)
```

---

## 🎨 Шаг 3: Создание сцены

### Hierarchy:

```
MainScene
├── Main Camera (Top-down view)
├── Directional Light
├── GameManager
├── UI Canvas
│   ├── ScoreText
│   ├── TimerText
│   └── GameOverPanel
├── Ground (Plane)
├── MoleGrid (Empty)
│   ├── MoleHole_01
│   │   ├── Hole (Cylinder)
│   │   ├── MoleModel (Capsule)
│   │   └── Particles
│   ├── MoleHole_02
│   ├── ...
│   └── MoleHole_12 (3x4 grid)
└── AudioManager
```

---

## 🕳️ Шаг 4: Создание норы крота

### MoleHole Prefab:

**Structure:**
```
MoleHole
├── Hole (Cylinder - brown)
│   └── Collider
├── Mole (Capsule - hidden below)
│   ├── Model
│   └── HitCollider (для touch)
└── HitParticles (Particle System)
```

**Hole (Cylinder):**
- Scale: (1, 0.1, 1)
- Material: Brown/Dark
- Position: Y = 0

**Mole (Capsule):**
- Scale: (0.5, 0.8, 0.5)
- Start Position: Y = -2 (hidden)
- Visible Position: Y = 0.5 (above hole)
- Material: Brown (normal) or Gold (special)

**Components:**
- MoleController.cs
- Collider (for touch detection)
- Animator (optional, for animations)

---

## 🎮 Шаг 5: Скрипты

### MoleController.cs

```csharp
Настройки:
- Pop Up Time: 0.3s
- Visible Duration: 1.5s
- Hide Time: 0.3s
- Points (Normal): 10
- Points (Golden): 50
```

### MoleManager.cs

Создайте новый скрипт:

```csharp
using UnityEngine;
using System.Collections.Generic;

public class MoleManager : MonoBehaviour
{
    [SerializeField] private List<MoleController> moles;
    [SerializeField] private float spawnInterval = 0.8f;
    [SerializeField] private float goldenChance = 0.15f;

    private float gameTime = 60f;
    private int score = 0;

    void Update()
    {
        gameTime -= Time.deltaTime;

        if (gameTime <= 0)
            GameOver();
    }

    void SpawnMole()
    {
        // Random mole
        MoleController randomMole = moles[Random.Range(0, moles.Count)];
        bool isGolden = Random.value < goldenChance;
        randomMole.PopUp(isGolden);
    }
}
```

---

## 📱 Шаг 6: Touch Input

### TouchInputManager.cs

```csharp
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

public class TouchInputManager : MonoBehaviour
{
    private Camera mainCamera;

    void OnEnable()
    {
        EnhancedTouchSupport.Enable();
        mainCamera = Camera.main;
    }

    void Update()
    {
        foreach (var touch in Touch.activeTouches)
        {
            if (touch.phase == UnityEngine.InputSystem.TouchPhase.Began)
            {
                HandleTouch(touch.screenPosition);
            }
        }
    }

    void HandleTouch(Vector2 screenPos)
    {
        Ray ray = mainCamera.ScreenPointToRay(screenPos);

        if (Physics.Raycast(ray, out RaycastHit hit))
        {
            MoleController mole = hit.collider.GetComponent<MoleController>();
            if (mole != null && mole.IsHittable())
            {
                mole.Hit();
            }
        }
    }
}
```

---

## 🎯 Шаг 7: Размещение нор

### Grid Layout (3x4):

```
Positions (X, Z):
Row 1: (-2, 2), (0, 2), (2, 2), (4, 2)
Row 2: (-2, 0), (0, 0), (2, 0), (4, 0)
Row 3: (-2, -2), (0, -2), (2, -2), (4, -2)
```

**Script для автоматического создания:**

```csharp
void CreateMoleGrid()
{
    for (int row = 0; row < 3; row++)
    {
        for (int col = 0; col < 4; col++)
        {
            Vector3 pos = new Vector3(
                col * 2 - 2,  // X
                0,            // Y
                row * 2 - 2   // Z
            );

            Instantiate(moleHolePrefab, pos, Quaternion.identity, moleGrid);
        }
    }
}
```

---

## 🎨 Шаг 8: Визуальные эффекты

### Hit Particles:

```
Particle System:
- Duration: 0.5s
- Start Lifetime: 0.3s
- Start Speed: 5
- Start Size: 0.2
- Emission: Burst (20 particles)
- Shape: Sphere
- Color: Yellow/Gold
```

### Materials:

**Normal Mole:**
- Color: Brown (#8B4513)
- Metallic: 0
- Smoothness: 0.3

**Golden Mole:**
- Color: Gold (#FFD700)
- Metallic: 0.8
- Smoothness: 0.9
- Emission: Enabled, Color: Yellow

---

## ⚙️ Шаг 9: Camera Setup

```
Camera Position: (1, 15, -5)
Rotation: (60, 0, 0)
Projection: Perspective
Field of View: 45
Clipping Planes:
- Near: 0.3
- Far: 100
```

---

## 🎵 Шаг 10: Звуки

### Sound Effects:

- **Whack Sound:** Short impact sound
- **Golden Hit:** Special chime/ding
- **Pop Up:** Quick "boing"
- **Timer Warning:** Tick-tock at 10s remaining

### Audio Sources:

```csharp
[SerializeField] private AudioClip whackSound;
[SerializeField] private AudioClip goldenHitSound;

void PlaySound(AudioClip clip)
{
    AudioSource.PlayClipAtPoint(clip, transform.position);
}
```

---

## 🔧 Шаг 11: Build Settings

```
File → Build Settings

Platform: Windows
Architecture: x86_64

Player Settings:
- Fullscreen Mode: Fullscreen Window
- Default Screen: 1920 x 1080
- Cursor: Custom (hammer cursor)
- Run In Background: ✓

Quality:
- V Sync: On
- Anti Aliasing: 4x MSAA
- Shadow Quality: Medium
```

---

## 🎮 Шаг 12: Геймплей настройка

### Difficulty Scaling:

```csharp
// Увеличивайте сложность со временем
float currentSpawnInterval = spawnInterval - (60 - gameTime) * 0.01f;
currentSpawnInterval = Mathf.Max(0.3f, currentSpawnInterval);
```

### Scoring:

```
Normal Mole: 10 points
Golden Mole: 50 points
Combo Bonus: +5 per consecutive hit
Miss Penalty: -5 points (optional)
```

---

## ✅ Тестирование

1. **Play Mode:** Проверьте появление кротов
2. **Mouse Click:** Должны работать клики
3. **Touch:** Тестируйте на touch устройстве
4. **Golden Moles:** 15% должны быть золотыми
5. **Timer:** 60 секунд отсчитываются
6. **Score:** Очки начисляются правильно

---

## 🐛 Troubleshooting

**Кроты не появляются:**
- Проверьте что MoleController.PopUp() вызывается
- Убедитесь что Y позиции правильные

**Touch не работает:**
- Input System установлен?
- EnhancedTouchSupport.Enable() вызван?
- Collider есть на кроте?

**Raycast не попадает:**
- Layer маски правильные?
- Камера смотрит вниз?
- Collider не отключен?

---

## 📦 Финальный билд

```
WhackAMole/
├── Whack-a-Mole.exe
├── UnityPlayer.dll
└── Whack-a-Mole_Data/
```

Размер: ~40-50 MB

---

## 🎉 Готово!

Whack-a-Mole готов! Веселитесь, ударяя кротов на вашем touch экране! 🔨
