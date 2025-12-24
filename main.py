#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Telegram Бот с ИИ - Виртуальный гид по Укеку
API: http://api.onlysq.ru/ai/v2
Модель: gemini-3-flash
"""

import os
import json
import base64
import asyncio
import aiohttp
import aiofiles
from pathlib import Path
from datetime import datetime
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, ContentType
from aiogram.enums import ChatAction
from dotenv import load_dotenv

load_dotenv()

# Конфигурация
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
AI_API_URL = "http://api.onlysq.ru/ai/v2"
AI_MODEL = "gemini-3-flash"
DB_FILE = "database.json"
KNOWLEDGE_FILE = "knowledge.txt"


def load_knowledge() -> str:
    """Загрузить базу знаний из файла"""
    knowledge_path = Path(KNOWLEDGE_FILE)
    if knowledge_path.exists():
        try:
            with open(knowledge_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return f"""

у тебя есть база знаний о городе Укек и проекте. отвечай на вопросы используя эту информацию:

{content}

если вопрос не из базы знаний - отвечай своими словами как обычно, но в контексте темы Укека."""
        except Exception as e:
            print(f"Ошибка загрузки базы знаний: {e}")
    return ""


# Системный промпт для ИИ
SYSTEM_PROMPT = """ты Серафим - виртуальный гид проекта "Укек", тебе 16 лет.
пиши с маленькой буквы, дружелюбно и просто, как подросток в чате.
ты знаешь всё о золотоордынском городе Укек и археологических раскопках.
отвечай коротко и интересно, можешь шутить.
если тебе прислали фото - прокомментируй его.
если спрашивают что-то не по теме - мягко возвращай к теме Укека.""" + load_knowledge()


class Database:
    """JSON база данных для истории чатов"""

    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
        self.data = self._load()

    def _load(self) -> dict:
        if self.filepath.exists():
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except:
                return {"chats": {}}
        return {"chats": {}}

    async def save(self):
        async with aiofiles.open(self.filepath, "w", encoding="utf-8") as f:
            await f.write(json.dumps(self.data, ensure_ascii=False, indent=2))

    def get_history(self, chat_id: int, limit: int = 10) -> list:
        chat_id = str(chat_id)
        if chat_id not in self.data["chats"]:
            self.data["chats"][chat_id] = []
        return self.data["chats"][chat_id][-limit:]

    async def add_message(self, chat_id: int, role: str, content: str):
        chat_id = str(chat_id)
        if chat_id not in self.data["chats"]:
            self.data["chats"][chat_id] = []

        self.data["chats"][chat_id].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })

        # Храним только последние 50 сообщений на чат
        if len(self.data["chats"][chat_id]) > 50:
            self.data["chats"][chat_id] = self.data["chats"][chat_id][-50:]

        await self.save()

    async def clear_history(self, chat_id: int):
        chat_id = str(chat_id)
        self.data["chats"][chat_id] = []
        await self.save()


class AIClient:
    """Клиент для работы с ИИ API"""

    async def ask(self, messages: list, image_base64: str = None) -> str:
        """Отправить запрос к ИИ"""

        payload = {
            "model": AI_MODEL,
            "messages": messages
        }

        # Если есть изображение, добавляем его
        if image_base64:
            payload["image"] = image_base64

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    AI_API_URL,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    ssl=False
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        # Пробуем разные форматы ответа
                        if isinstance(data, dict):
                            if "response" in data:
                                return data["response"]
                            if "content" in data:
                                return data["content"]
                            if "message" in data:
                                if isinstance(data["message"], dict):
                                    return data["message"].get("content", str(data))
                                return data["message"]
                            if "choices" in data and len(data["choices"]) > 0:
                                choice = data["choices"][0]
                                if "message" in choice:
                                    return choice["message"].get("content", "")
                                if "text" in choice:
                                    return choice["text"]
                            if "text" in data:
                                return data["text"]
                        return str(data)
                    else:
                        error_text = await resp.text()
                        print(f"AI API ошибка {resp.status}: {error_text}")
                        return "что-то пошло не так, попробуй ещё раз"
        except Exception as e:
            print(f"Ошибка запроса к AI: {e}")
            return "упс, что-то сломалось. попробуй позже"


# Инициализация
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
db = Database(DB_FILE)
ai = AIClient()


@dp.message(F.text == "/start")
async def cmd_start(message: Message):
    """Команда /start"""
    welcome = """привет! я Серафим, виртуальный гид проекта "Укек" 👋

расскажу тебе про золотоордынский город на берегу Волги, археологические раскопки и интересные находки.

можешь спрашивать что угодно про Укек, присылать фото или просто поболтать!

напиши /help чтобы узнать что я умею"""

    await message.answer(welcome)
    await db.clear_history(message.chat.id)


@dp.message(F.text == "/help")
async def cmd_help(message: Message):
    """Команда /help"""
    help_text = """что я умею:

📜 отвечать на вопросы про город Укек
🏛 рассказывать про археологические раскопки
🖼 комментировать фото которые ты присылаешь
💬 просто болтать

команды:
/start - начать сначала
/help - эта справка
/clear - очистить историю чата"""

    await message.answer(help_text)


@dp.message(F.text == "/clear")
async def cmd_clear(message: Message):
    """Команда /clear"""
    await db.clear_history(message.chat.id)
    await message.answer("история очищена, начинаем с чистого листа!")


@dp.message(F.photo)
async def handle_photo(message: Message):
    """Обработка фото"""
    await bot.send_chat_action(message.chat.id, ChatAction.TYPING)

    # Скачиваем фото
    photo = message.photo[-1]  # Берём самое большое
    file = await bot.get_file(photo.file_id)
    file_data = await bot.download_file(file.file_path)
    image_base64 = base64.b64encode(file_data.read()).decode("utf-8")

    caption = message.caption or "пользователь прислал фото"
    user_content = f"[фото] {caption}"

    # Получаем историю и формируем запрос
    history = db.get_history(message.chat.id)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_content})

    # Сохраняем и получаем ответ
    await db.add_message(message.chat.id, "user", user_content)
    response = await ai.ask(messages, image_base64)
    await db.add_message(message.chat.id, "assistant", response)

    await message.answer(response)


@dp.message(F.voice)
async def handle_voice(message: Message):
    """Обработка голосовых"""
    await bot.send_chat_action(message.chat.id, ChatAction.TYPING)

    # Скачиваем голосовое
    file = await bot.get_file(message.voice.file_id)
    file_data = await bot.download_file(file.file_path)
    voice_base64 = base64.b64encode(file_data.read()).decode("utf-8")

    # Пробуем распознать через AI
    try:
        payload = {
            "model": AI_MODEL,
            "messages": [{"role": "user", "content": "расшифруй голосовое сообщение"}],
            "audio": voice_base64
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(AI_API_URL, json=payload, ssl=False) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    transcript = data.get("response") or data.get("text") or "голосовое сообщение"
                else:
                    transcript = "голосовое сообщение"
    except:
        transcript = "голосовое сообщение"

    user_content = f"[голосовое]: {transcript}"

    # Получаем историю и формируем запрос
    history = db.get_history(message.chat.id)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_content})

    await db.add_message(message.chat.id, "user", user_content)
    response = await ai.ask(messages)
    await db.add_message(message.chat.id, "assistant", response)

    await message.answer(response)


@dp.message(F.text)
async def handle_text(message: Message):
    """Обработка текстовых сообщений"""
    # Пропускаем команды
    if message.text.startswith("/"):
        return

    await bot.send_chat_action(message.chat.id, ChatAction.TYPING)

    user_content = message.text

    # Получаем историю и формируем запрос
    history = db.get_history(message.chat.id)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_content})

    # Сохраняем и получаем ответ
    await db.add_message(message.chat.id, "user", user_content)
    response = await ai.ask(messages)
    await db.add_message(message.chat.id, "assistant", response)

    await message.answer(response)


async def main():
    if not BOT_TOKEN:
        print("Ошибка: Установите BOT_TOKEN в .env файле")
        print("Получить токен: напиши @BotFather в Telegram")
        return

    print("Бот запущен!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
