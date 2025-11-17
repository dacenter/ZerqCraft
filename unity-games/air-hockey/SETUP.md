# 🏒 Air Hockey - Unity Setup Guide

Пошаговая инструкция по созданию игры Air Hockey в Unity.

---

## 📋 Шаг 1: Создание проекта

1. Откройте **Unity Hub**
2. **New Project**
3. Template: **2D (URP)** или **2D Core**
4. Project Name: `AirHockey`
5. Location: `unity-games/air-hockey/`
6. **Create Project**

---

## 📦 Шаг 2: Установка зависимостей

### Input System (обязательно для touch)

```
Window → Package Manager
Search: "Input System"
Install
```

После установки Unity предложит перезапуск - согласитесь.

### TextMesh Pro (для UI)

```
Window → TextMeshPro → Import TMP Essential Resources
```

---

## 🎨 Шаг 3: Создание сцены

### Hierarchy Structure:

```
MainGame
├── Main Camera
├── GameManager (Empty GameObject)
├── Canvas (UI)
│   ├── Player1Score (Text - TMP)
│   ├── Player2Score (Text - TMP)
│   └── GameOverPanel
│       ├── WinnerText (Text - TMP)
│       ├── RestartButton
│       └── QuitButton
├── Table (Sprite)
├── CenterLine (Sprite)
├── Paddle1 (Sprite - Blue)
├── Paddle2 (Sprite - Red)
├── Puck (Sprite - White)
├── Walls
│   ├── WallLeft
│   ├── WallRight
│   ├── WallTop (outside goals)
│   └── WallBottom (outside goals)
└── Goals
    ├── Goal1 (top)
    └── Goal2 (bottom)
```

---

## 🎮 Шаг 4: Настройка компонентов

### GameManager (Empty GameObject)

**Components:**
- Add Script: `GameManager.cs`

**Inspector Settings:**
- Score To Win: `7`
- Reset Delay: `2.0`
- Assign all UI references

---

### Puck (Sprite)

**Components:**
- Sprite Renderer (белый круг)
- Rigidbody2D
  - Mass: `0.5`
  - Linear Drag: `0.5`
  - Angular Drag: `0.5`
  - Gravity Scale: `0`
  - Collision Detection: `Continuous`
- Circle Collider 2D
  - Radius: `0.25`
- Physics Material 2D
  - Friction: `0`
  - Bounciness: `1.0`
- Add Script: `PuckController.cs`
- Trail Renderer (optional)

**Tag:** Create and assign `Puck`

---

### Paddles (Sprites)

**Components:**
- Sprite Renderer (цветной круг)
- Rigidbody2D
  - Body Type: `Kinematic`
  - Gravity Scale: `0`
- Circle Collider 2D
  - Radius: `0.5`
- Physics Material 2D
  - Friction: `0`
  - Bounciness: `0.9`
- Add Script: `PaddleController.cs`

**Paddle1 Settings:**
- Player Number: `1`
- Movement Speed: `15`
- Min Y: `-4`
- Max Y: `-0.5` (ограничение половиной стола)

**Paddle2 Settings:**
- Player Number: `2`
- Movement Speed: `15`
- Min Y: `0.5`
- Max Y: `4`

**Tag:** Create and assign `Paddle`

---

### Walls (Empty with BoxCollider2D)

**Components:**
- Box Collider 2D
  - Size and position accordingly
- Physics Material 2D
  - Friction: `0`
  - Bounciness: `1.0`

**Tag:** Create and assign `Wall`

**Positions:**
- Left Wall: X = -9, Size = (0.5, 10)
- Right Wall: X = 9, Size = (0.5, 10)
- Top Wall: Position above top goal
- Bottom Wall: Position below bottom goal

---

### Goals (Trigger zones)

**Components:**
- Box Collider 2D
  - Is Trigger: ✓
  - Size: (3, 0.5)
- Add Script: `GoalDetector.cs`

**Goal1 (Player 1 scores here - top):**
- Position: Y = 4.5
- Scoring Player: `1`
- Goal Color: Blue

**Goal2 (Player 2 scores here - bottom):**
- Position: Y = -4.5
- Scoring Player: `2`
- Goal Color: Red

---

### UI Setup

**Canvas Settings:**
- Render Mode: `Screen Space - Overlay`
- Canvas Scaler:
  - UI Scale Mode: `Scale With Screen Size`
  - Reference Resolution: `1920 x 1080`

**Player Scores:**
- Font Size: `128`
- Alignment: Center
- Color: White

**Player1Score:**
- Position: Left side, top
- Anchor: Top-Left

**Player2Score:**
- Position: Right side, top
- Anchor: Top-Right

**GameOverPanel:**
- Initially disabled
- Background: Semi-transparent black
- Contains: WinnerText, RestartButton, QuitButton

---

## ⚙️ Шаг 5: Project Settings

### Physics 2D

```
Edit → Project Settings → Physics 2D

- Gravity: Y = 0 (no gravity!)
- Bounce Threshold: 0.1
- Default Physics Material:
  - Friction: 0
  - Bounciness: 1.0
```

### Tags

Create these tags:
- `Puck`
- `Paddle`
- `Wall`
- `Goal`

### Layers (optional)

```
0: Default
8: Paddle
9: Puck
10: Wall
```

### Input System

```
Edit → Project Settings → Player
Active Input Handling: Input System Package (New)
```

---

## 🎯 Шаг 6: Скрипты

Скопируйте все скрипты из папки `Scripts/` в `Assets/Scripts/`:

1. `GameManager.cs` → на GameObject GameManager
2. `PaddleController.cs` → на каждую биту
3. `PuckController.cs` → на шайбу
4. `GoalDetector.cs` → на каждую зону гола

---

## 🎨 Шаг 7: Визуальные элементы

### Создание спрайтов

**Способ 1 - Простые фигуры:**
```
GameObject → 2D Object → Sprites → Circle
Измените цвет в Sprite Renderer
```

**Способ 2 - Импорт картинок:**
```
Перетащите PNG файлы в Assets/Sprites/
Texture Type: Sprite (2D and UI)
```

**Рекомендуемые цвета:**
- Table: Dark blue (#1e3a5f)
- Paddle1: Cyan (#4ecdc4)
- Paddle2: Red (#ff6b6b)
- Puck: White (#ffffff)

---

## 🔧 Шаг 8: Build Settings

```
File → Build Settings

Platform: Windows
Architecture: x86_64

Add Open Scenes:
- MainGame

Player Settings:
- Company Name: ZerqCraft
- Product Name: Air Hockey
- Default Icon: Set your icon
- Default Cursor: None
- Fullscreen Mode: Fullscreen Window
- Default Screen: 1920 x 1080
- Run In Background: ✓
- Display Resolution Dialog: Disabled
- Resizable Window: ✗

Quality:
- V Sync Count: Every V Blank
- Anti Aliasing: 4x Multi Sampling

Build
```

---

## ✅ Тестирование

### В редакторе (с мышкой):

1. Press Play
2. Кликните и двигайте мышь в каждой половине
3. Проверьте столкновения
4. Проверьте голы

### С сенсорным экраном:

1. Build проект
2. Запустите на устройстве с touch screen
3. Проверьте multi-touch (два пальца одновременно)

---

## 🐛 Решение проблем

**Paddles не двигаются:**
- Проверьте что Input System установлен
- Убедитесь что Enhanced Touch Support включен в коде

**Puck застревает в стенах:**
- Collision Detection → Continuous
- Проверьте толщину стен (минимум 0.5)

**Touch не определяется:**
- В Build проверьте что это Windows Build
- Убедитесь что `using UnityEngine.InputSystem.EnhancedTouch;`

**Физика странная:**
- Gravity = 0 в Physics 2D
- Friction = 0 на всех материалах
- Bounciness = 1.0

---

## 📦 Финальный билд

После сборки структура:

```
Air Hockey/
├── Air Hockey.exe           (~40MB)
├── UnityCrashHandler64.exe
├── UnityPlayer.dll
└── Air Hockey_Data/
    ├── Managed/
    ├── Resources/
    └── ...
```

---

## 🎉 Готово!

Ваша игра Air Hockey готова к использованию! 🏒

Добавьте `Air Hockey.exe` в ваш лаунчер и наслаждайтесь игрой!
