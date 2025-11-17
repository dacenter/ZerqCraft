# 🎮 Unity Games - ZerqCraft

Unity проекты для более производительных и физически точных игр.

## 🎯 Игры на Unity

1. **🏒 Air Hockey** - Воздушный хоккей с реалистичной физикой
2. **🔨 Whack-a-Mole** - Быстрая аркада с 3D моделями
3. **🚀 Space Defender** - Космический шутер с волнами врагов
4. **🧩 Memory Match** - Карточная игра с анимированными 3D картами

---

## 📦 Требования

- **Unity Hub** - https://unity.com/download
- **Unity 2022.3 LTS** (рекомендуется) или новее
- **Windows Build Support** (IL2CPP)
- **Visual Studio Community** (для редактирования C# кода)

---

## 🚀 Создание Unity проектов

### Метод 1: Импорт готовых скриптов

Каждая папка содержит базовые скрипты. Чтобы создать проект:

```
1. Откройте Unity Hub
2. New Project → 2D или 3D (зависит от игры)
3. Название: <game-name>
4. Локация: unity-games/<game-name>/
5. Create Project

6. Скопируйте Scripts/ в Assets/Scripts/
7. Создайте сцену согласно SETUP.md в каждой игре
```

### Метод 2: Полностью готовые проекты

Если вам нужны готовые Unity проекты (.unitypackage), они будут добавлены позже.

---

## 📁 Структура проекта Unity

```
air-hockey/
├── Assets/
│   ├── Scenes/
│   │   └── MainGame.unity
│   ├── Scripts/
│   │   ├── GameManager.cs
│   │   ├── PaddleController.cs
│   │   ├── PuckController.cs
│   │   └── TouchInputManager.cs
│   ├── Prefabs/
│   │   ├── Puck.prefab
│   │   ├── Paddle.prefab
│   │   └── GoalZone.prefab
│   ├── Materials/
│   └── Sprites/
├── ProjectSettings/
├── Packages/
└── SETUP.md
```

---

## 🎮 Особенности каждой игры

### Air Hockey (🏒)

**Технологии:**
- Unity Physics2D для реалистичного движения
- Multi-touch input через новый Input System
- Particle effects для голов и столкновений

**Основные скрипты:**
- `GameManager.cs` - управление игрой, счет
- `PaddleController.cs` - управление битами через touch
- `PuckController.cs` - физика шайбы
- `GoalDetector.cs` - определение голов

---

### Whack-a-Mole (🔨)

**Технологии:**
- 3D модели кротов с анимациями
- Raycast для определения касаний
- Spawn system для появления кротов

**Основные скрипты:**
- `MoleManager.cs` - управление появлением кротов
- `MoleController.cs` - анимация и состояния крота
- `TouchRaycast.cs` - определение касаний
- `ScoreManager.cs` - счет и таймер

---

### Space Defender (🚀)

**Технологии:**
- Object pooling для пуль и врагов
- Wave system для увеличения сложности
- Particle systems для взрывов

**Основные скрипты:**
- `ShipController.cs` - управление кораблем игрока
- `EnemySpawner.cs` - система волн
- `BulletPool.cs` - пул пуль
- `EnemyAI.cs` - поведение врагов

---

### Memory Match (🧩)

**Технологии:**
- 3D карты с flip анимациями
- DOTween для плавных поворотов
- Grid layout system

**Основные скрипты:**
- `CardManager.cs` - управление картами
- `CardController.cs` - переворот и состояния карты
- `MatchChecker.cs` - проверка совпадений
- `GridGenerator.cs` - генерация сетки карт

---

## 🔧 Настройка Build Settings

### Player Settings

```
Company Name: ZerqCraft
Product Name: <Game Name>
Default Icon: Set icon.png
Default Cursor: None (для touch)

Resolution and Presentation:
- Fullscreen Mode: Fullscreen Window
- Default Screen Width: 1920
- Default Screen Height: 1080
- Run In Background: ✓
- Display Resolution Dialog: Disabled
- Resizable Window: ✗

Other Settings:
- Color Space: Linear (для лучшей графики)
- Auto Graphics API: ✓
- Scripting Backend: IL2CPP (производительность)
- API Compatibility: .NET Framework
```

### Build Settings

```
Platform: Windows
Architecture: x86_64
Development Build: ✗ (для финального билда)
Script Debugging: ✗
Compression Method: LZ4 (быстрый) или Default
```

---

## 🎨 Ресурсы

### Где найти ассеты

**Бесплатные:**
- Unity Asset Store - https://assetstore.unity.com/
- Kenney.nl - https://kenney.nl/ (sprites, звуки)
- Freesound.org - звуковые эффекты

**Рекомендуемые пакеты:**
- DOTween - анимации (Free)
- TextMesh Pro - красивый текст (встроен)
- Particle Pack - эффекты (Asset Store)

---

## 📝 Пошаговая настройка (Air Hockey пример)

### 1. Создайте проект

```
Unity Hub → New Project
Template: 2D
Name: AirHockey
Location: unity-games/air-hockey/
```

### 2. Импортируйте Input System

```
Window → Package Manager
Search: Input System
Install
```

### 3. Создайте сцену

```
Hierarchy → Right Click
- Create Empty → "GameManager" (добавьте GameManager.cs)
- 2D Object → Sprite → "Table" (фон стола)
- 2D Object → Sprite → "Paddle1" (синяя бита)
- 2D Object → Sprite → "Paddle2" (красная бита)
- 2D Object → Sprite → "Puck" (шайба)
- UI → Canvas → Score Display
```

### 4. Добавьте компоненты

**Puck:**
- Rigidbody2D (Mass: 0.5, Gravity: 0, Linear Drag: 0.5)
- CircleCollider2D (Radius: 0.5)
- PuckController.cs

**Paddles:**
- Rigidbody2D (Kinematic)
- CircleCollider2D
- PaddleController.cs

### 5. Настройте Physics2D

```
Edit → Project Settings → Physics 2D
- Gravity: 0 (нет гравитации)
- Bounce Threshold: 0.1
```

### 6. Build

```
File → Build Settings
- Add Open Scenes
- Platform: Windows
- Build
```

---

## 🐛 Частые проблемы

### Touch не работает

```cs
// Убедитесь что используете:
using UnityEngine.InputSystem;

// А не старый:
// using UnityEngine.Input;
```

### Физика странная

```
Проверьте:
1. Rigidbody2D → Collision Detection: Continuous
2. Friction у материалов: 0
3. Bounciness: 0.9-1.0
```

### Билд не запускается

```
1. Проверьте что все сцены добавлены в Build Settings
2. Убедитесь что нет ошибок в Console
3. Попробуйте Mono вместо IL2CPP
```

---

## 📦 Финальная сборка

После настройки всех 4 игр:

```
Builds/
├── Air Hockey/
│   ├── Air Hockey.exe
│   ├── UnityCrashHandler64.exe
│   ├── UnityPlayer.dll
│   └── Air Hockey_Data/
├── Whack-a-Mole/
├── Space Defender/
└── Memory Match/
```

Каждая игра ~30-50MB.

---

## ✅ Чеклист готовности

- [ ] Все скрипты без ошибок
- [ ] Touch input работает
- [ ] UI отображается корректно
- [ ] Счет сохраняется
- [ ] ESC закрывает игру
- [ ] Fullscreen включен
- [ ] Иконка установлена
- [ ] Билд < 100MB

---

## 🎉 Готово!

Теперь у вас 4 Unity игры + 4 Electron = **8 готовых .exe файлов** для вашего лаунчера!
