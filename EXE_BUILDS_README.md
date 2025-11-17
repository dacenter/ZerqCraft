# 🎮 ZerqCraft - Готовые .exe билды для лаунчера

Этот README описывает структуру проектов для создания .exe файлов игр.

---

## 📂 Структура веток

Проект разделен на **2 ветки** с разными технологиями:

### Ветка 1: `claude/exe-builds-*` (Electron) ⚡
**Технология:** Electron (HTML5 → .exe)
**Игры:**
- 🍎 Fruit Slash
- 🎨 Color Splash
- 🫧 Bubble Pop
- 🎹 Piano Hero

**Особенности:**
- ✅ Быстрая разработка (HTML/CSS/JS)
- ✅ Легко обновлять
- ✅ Кроссплатформенность
- ⚠️ Размер файла ~60-80MB на игру
- ✅ Идеально для 2D игр с простой физикой

---

### Ветка 2: `claude/unity-games-*` (Unity) 🎯
**Технология:** Unity Engine → Windows Build
**Игры:**
- 🏒 Air Hockey
- 🔨 Whack-a-Mole
- 🚀 Space Defender
- 🧩 Memory Match

**Особенности:**
- ✅ Высокая производительность
- ✅ Сложная физика (Physics2D)
- ✅ 3D графика и эффекты
- ✅ Меньший размер ~30-50MB на игру
- ⚠️ Требует Unity для сборки

---

## 🚀 Быстрый старт

### Для Electron игр (HTML5):

```bash
# Переключиться на ветку
git checkout claude/exe-builds-01BTVKuXwZKxRzJypeHDBrDv

# Установить Node.js (если нет)
https://nodejs.org/

# Собрать игру
cd electron-builds/fruit-slash
npm install
npm run build:win

# Готовый .exe в папке builds/
```

### Для Unity игр:

```bash
# Переключиться на ветку
git checkout claude/unity-games-01BTVKuXwZKxRzJypeHDBrDv

# Установить Unity Hub (если нет)
https://unity.com/download

# Открыть проект
Unity Hub → Add → unity-games/air-hockey

# Собрать
File → Build Settings → Build
```

---

## 📋 Полный список игр

| # | Игра | Технология | Размер | Игроки | Жанр |
|---|------|------------|--------|--------|------|
| 1 | Fruit Slash | Electron | ~70MB | 1-4 | Аркада |
| 2 | Air Hockey | Unity | ~40MB | 2 | Спорт |
| 3 | Color Splash | Electron | ~60MB | 1-6 | Творчество |
| 4 | Piano Hero | Electron | ~65MB | 1-2 | Музыка |
| 5 | Memory Match | Unity | ~35MB | 1-4 | Головоломка |
| 6 | Whack-a-Mole | Unity | ~40MB | 1-4 | Реакция |
| 7 | Bubble Pop | Electron | ~65MB | 1-6 | Казуальная |
| 8 | Space Defender | Unity | ~45MB | 1-4 | Шутер |

**Итого:** ~420MB для всех 8 игр

---

## 🔧 Сборка всех игр

### Автоматическая сборка (рекомендуется)

Создайте скрипт `build-all.bat`:

```batch
@echo off
echo Building Electron games...

cd electron-builds\fruit-slash
call npm install
call npm run build:win

cd ..\color-splash
call npm install
call npm run build:win

cd ..\bubble-pop
call npm install
call npm run build:win

cd ..\piano-hero
call npm install
call npm run build:win

echo Electron builds complete!
echo.
echo Now build Unity games manually in Unity Editor
echo Check unity-games/README.md for instructions
pause
```

### Ручная сборка

**Electron:**
```bash
cd electron-builds/<game-name>
npm install
npm run build:win
```

**Unity:**
```
1. Open in Unity
2. File → Build Settings → Build
3. Repeat for each game
```

---

## 📁 Результат сборки

После полной сборки:

```
builds/
├── Electron/
│   ├── Fruit Slash Setup 1.0.0.exe
│   ├── Color Splash Setup 1.0.0.exe
│   ├── Bubble Pop Setup 1.0.0.exe
│   └── Piano Hero Setup 1.0.0.exe
└── Unity/
    ├── Air Hockey.exe
    ├── Whack-a-Mole.exe
    ├── Space Defender.exe
    └── Memory Match.exe
```

---

## 🎯 Интеграция с лаунчером

### Конфигурационный файл

Используйте `launcher/games.json` для настройки вашего лаунчера:

```json
{
  "games": [
    {
      "id": "fruit-slash",
      "name": "Fruit Slash",
      "executable": "builds/Electron/Fruit Slash.exe",
      "engine": "Electron",
      ...
    }
  ]
}
```

### Запуск из лаунчера

**Простой запуск:**
```csharp
// C# пример для вашего лаунчера
Process.Start("builds/Electron/Fruit Slash.exe");
```

**С параметрами:**
```csharp
ProcessStartInfo startInfo = new ProcessStartInfo();
startInfo.FileName = "builds/Unity/Air Hockey.exe";
startInfo.Arguments = "--fullscreen";
Process.Start(startInfo);
```

---

## 🎨 Кастомизация

### Иконки игр

Замените иконки в:
- **Electron:** `electron-builds/<game>/assets/icon.ico`
- **Unity:** Player Settings → Default Icon

### Экран загрузки (Unity)

```
Player Settings → Splash Image
- Show Splash Screen: ✗ (или настройте свой)
```

### Цвета и стили

- **Electron:** Редактируйте CSS в `index.html`
- **Unity:** Редактируйте материалы и UI в редакторе

---

## 📊 Производительность

### Требования к системе

**Минимальные:**
- OS: Windows 10
- RAM: 4GB
- GPU: Integrated Graphics
- Touch: 5-point multi-touch

**Рекомендуемые:**
- OS: Windows 11
- RAM: 8GB
- GPU: Dedicated Graphics
- Touch: 10-point multi-touch
- Screen: 50" 4K touchscreen

### FPS

- **Electron игры:** 60 FPS (ограничено браузером)
- **Unity игры:** 60-120 FPS (настраиваемо)

---

## 🔒 Безопасность

### Electron

По умолчанию отключены:
- Node Integration
- Remote Module
- Dev Tools (в production build)

### Unity

```
Player Settings → Other Settings
- Strip Engine Code: ✓ (уменьшает размер)
- Managed Stripping Level: Medium
```

---

## 📝 Обновления игр

### Electron - Быстрые обновления

1. Измените код в `game.js`
2. `npm run build:win`
3. Замените .exe в лаунчере

### Unity - Полный rebuild

1. Измените в Unity Editor
2. File → Build
3. Замените папку игры

---

## 🐛 Отладка

### Electron

```bash
# Запуск в dev режиме
cd electron-builds/<game>
npm start

# Dev Tools откроются автоматически
```

### Unity

```
Build Settings → Development Build ✓
Script Debugging ✓
```

Логи в: `%AppData%\..\LocalLow\<Company>\<Product>\output_log.txt`

---

## ⚡ Оптимизация

### Electron

- Минифицируйте JavaScript
- Оптимизируйте изображения
- Используйте WebGL для графики

### Unity

- **Texture Compression:** DXT5
- **Audio Compression:** Vorbis
- **Scripting Backend:** IL2CPP
- **Code Stripping:** High

---

## 📞 Поддержка

**Проблемы с Electron:**
- См. `electron-builds/BUILD_INSTRUCTIONS.md`
- Документация: https://www.electronjs.org/docs

**Проблемы с Unity:**
- См. `unity-games/README.md`
- Документация: https://docs.unity3d.com/

---

## ✅ Чеклист готовности

Перед релизом проверьте:

**Общее:**
- [ ] Все 8 игр собраны
- [ ] Иконки установлены
- [ ] Нет критических багов
- [ ] FPS стабильные 60+

**Electron:**
- [ ] Dev Tools отключены
- [ ] Правильное разрешение
- [ ] ESC закрывает игру

**Unity:**
- [ ] Нет missing scripts
- [ ] Все ассеты импортированы
- [ ] Fullscreen работает
- [ ] Touch input работает

**Лаунчер:**
- [ ] games.json настроен
- [ ] Все пути правильные
- [ ] Иконки отображаются
- [ ] Описания на русском

---

## 🎉 Готово!

Теперь у вас есть **8 готовых .exe игр** для вашей 50" touch панели!

Структура:
- **4 Electron игры** - легкие, быстро обновляемые
- **4 Unity игры** - производительные, с продвинутой физикой

**Общий размер:** ~420MB
**Общее время сборки:** ~30-60 минут

Наслаждайтесь! 🎮✨
