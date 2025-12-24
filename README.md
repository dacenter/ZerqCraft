# ZerqCraft Telegram Userbot

Telegram userbot с ИИ автоответчиком на базе gemini-3-flash.

## Возможности

- Автоматически отвечает на все входящие сообщения от ИИ
- Обрабатывает голосовые сообщения
- Анализирует фотографии
- Отвечает как обычный человек (с маленькой буквы, без формальностей)
- JSON база данных для истории чатов

## Установка

1. Получите API credentials на https://my.telegram.org/apps

2. Создайте `.env` файл:
```bash
cp .env.example .env
```

3. Заполните `.env`:
```
API_ID=ваш_api_id
API_HASH=ваш_api_hash
PHONE=+79991234567
```

4. Установите зависимости:
```bash
pip install -r requirements.txt
```

5. Запустите:
```bash
python main.py
```

При первом запуске потребуется ввести код подтверждения из Telegram.

## API

- URL: `http://api.onlysq.ru/ai/v2`
- Модель: `gemini-3-flash`
