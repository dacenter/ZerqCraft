# 📦 Инструкция по сборке .exe файлов

## Electron Games (HTML5)

Эти игры упакованы в Electron для работы как нативные .exe приложения:
- 🍎 **Fruit Slash**
- 🎨 **Color Splash**
- 🫧 **Bubble Pop**
- 🎹 **Piano Hero**

### Требования

```bash
# Установите Node.js (v18 или новее)
https://nodejs.org/

# Проверьте установку
node --version
npm --version
```

### Сборка отдельной игры

```bash
# Перейдите в папку игры
cd electron-builds/fruit-slash

# Установите зависимости
npm install

# Запуск в режиме разработки
npm start

# Сборка .exe файла
npm run build:win

# Сборка только x64
npm run build:win64

# Сборка только x32
npm run build:win32
```

### Сборка всех Electron игр

```bash
# Из корня проекта
cd electron-builds

# Установить зависимости для всех
npm install --prefix fruit-slash
npm install --prefix color-splash
npm install --prefix bubble-pop
npm install --prefix piano-hero

# Собрать все
npm run build:win --prefix fruit-slash
npm run build:win --prefix color-splash
npm run build:win --prefix bubble-pop
npm run build:win --prefix piano-hero
```

### Готовые .exe файлы

После сборки найдёте в папке `builds/`:

```
builds/
├── Fruit Slash Setup 1.0.0.exe
├── Color Splash Setup 1.0.0.exe
├── Bubble Pop Setup 1.0.0.exe
└── Piano Hero Setup 1.0.0.exe
```

---

## Unity Games (C#)

Эти игры созданы в Unity для более сложной физики и 3D графики:
- 🏒 **Air Hockey**
- 🔨 **Whack-a-Mole**
- 🚀 **Space Defender**
- 🧩 **Memory Match**

### Требования

```
Unity Hub: https://unity.com/download
Unity Version: 2022.3 LTS (или новее)

Модули:
- Windows Build Support (IL2CPP)
- Windows Build Support (Mono)
```

### Открытие проекта

```bash
1. Запустите Unity Hub
2. Add → Navigate to unity-games/<game-name>
3. Open Project
```

### Сборка Unity игры

```
1. File → Build Settings
2. Platform: Windows
3. Architecture: x86_64 (64-bit)
4. Target: Standalone
5. Click "Build"
6. Выберите путь: ../../builds/
```

### Оптимизация Unity билда

В Player Settings:
```
- Resolution: 1920x1080 (or 3840x2160 for 4K)
- Fullscreen Mode: Fullscreen Window
- Display Resolution Dialog: Disabled
- Run In Background: Enabled
- API Compatibility Level: .NET Framework
- Scripting Backend: IL2CPP (быстрее) или Mono (меньше размер)
```

---

## 🚀 Конфигурация для лаунчера

После сборки всех игр, создайте файл `games.json` для вашего лаунчера:

```json
{
  "games": [
    {
      "id": "fruit-slash",
      "name": "Fruit Slash",
      "icon": "fruit-slash.png",
      "executable": "builds/Fruit Slash.exe",
      "description": "Рубите фрукты пальцами!",
      "players": "1-4",
      "genre": "Arcade",
      "engine": "Electron"
    },
    {
      "id": "air-hockey",
      "name": "Air Hockey",
      "icon": "air-hockey.png",
      "executable": "builds/Air Hockey.exe",
      "description": "Воздушный хоккей для двоих",
      "players": "2",
      "genre": "Sport",
      "engine": "Unity"
    }
  ]
}
```

---

## 📝 Примечания

### Размеры файлов

**Electron приложения:**
- ~50-80 MB каждое (включая Chromium runtime)

**Unity приложения:**
- ~30-50 MB каждое (зависит от ассетов)

### Производительность

**Electron:**
- ✅ Идеально для 2D игр
- ✅ Легко обновлять
- ⚠️ Больший размер

**Unity:**
- ✅ Лучше для физики
- ✅ Нативная производительность
- ✅ Меньший размер
- ⚠️ Дольше компилируется

---

## 🔧 Устранение проблем

### Electron

**Проблема:** `electron-builder: command not found`
```bash
npm install -g electron-builder
```

**Проблема:** Ошибка при сборке иконки
```bash
# Убедитесь что assets/icon.ico существует
# Или закомментируйте строку "icon" в package.json
```

### Unity

**Проблема:** Missing MonoBehaviour scripts
```
Reimport all assets: Assets → Reimport All
```

**Проблема:** IL2CPP build error
```
Переключитесь на Mono backend в Player Settings
```

---

## 📦 Готовые builds

После всех сборок структура:

```
builds/
├── Fruit Slash.exe          (Electron)
├── Color Splash.exe         (Electron)
├── Bubble Pop.exe           (Electron)
├── Piano Hero.exe           (Electron)
├── Air Hockey.exe           (Unity)
├── Whack-a-Mole.exe         (Unity)
├── Space Defender.exe       (Unity)
└── Memory Match.exe         (Unity)
```

Общий размер: ~400-500 MB для всех 8 игр.

---

## ✅ Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Собрать все Electron игры
npm run build:all

# 3. Открыть Unity проекты и собрать вручную

# 4. Все .exe будут в папке builds/
```

---

Готово! Все игры можно запускать через ваш лаунчер 🎮
