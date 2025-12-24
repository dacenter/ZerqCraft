#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Telegram Userbot с ИИ автоответчиком
API: http://api.onlysq.ru/ai/v2
Модель: gemini-3-flash
"""

import os
import json
import ssl
import base64
import asyncio
import aiohttp
import aiofiles
from pathlib import Path
from datetime import datetime
from telethon import TelegramClient, events
from telethon.tl.types import Message, MessageMediaPhoto, MessageMediaDocument
from dotenv import load_dotenv

load_dotenv()

# Конфигурация
API_ID = int(os.getenv("API_ID", "0"))
API_HASH = os.getenv("API_HASH", "")
PHONE = os.getenv("PHONE", "")
AI_API_URL = "http://api.onlysq.ru/ai/v2"
AI_MODEL = "gemini-3-flash"
DB_FILE = "database.json"
SESSION_NAME = "userbot_session"
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

у тебя есть база знаний. если вопрос совпадает или похож - отвечай по этой базе:

{content}

если вопрос не из базы знаний - отвечай своими словами как обычно."""
        except Exception as e:
            print(f"Ошибка загрузки базы знаний: {e}")
    return ""


# Системный промпт для ИИ
SYSTEM_PROMPT = """ты обычный человек в телеграме. пиши с маленькой буквы, без лишних формальностей.
отвечай коротко и по делу как живой человек в чате. не используй команды и не пиши как бот.
если тебе прислали фото - опиши что видишь или прокомментируй.
если тебе прислали голосовое - отвечай на его содержание.""" + load_knowledge()


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


class AIClient:
    """Клиент для работы с ИИ API"""

    def __init__(self):
        # Отключаем проверку SSL
        self.ssl_context = ssl.create_default_context()
        self.ssl_context.check_hostname = False
        self.ssl_context.verify_mode = ssl.CERT_NONE

        self.connector = aiohttp.TCPConnector(ssl=False)

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
            async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
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
                        return "не могу ответить сейчас"
        except Exception as e:
            print(f"Ошибка запроса к AI: {e}")
            return "что-то пошло не так, попробуй позже"


class UserBot:
    """Telegram Userbot с ИИ"""

    def __init__(self):
        self.client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
        self.db = Database(DB_FILE)
        self.ai = AIClient()
        self.me = None

    async def start(self):
        """Запуск бота"""
        await self.client.start(phone=PHONE)
        self.me = await self.client.get_me()
        print(f"Userbot запущен как: {self.me.first_name} (@{self.me.username})")

        # Регистрируем обработчики
        self.client.add_event_handler(self.handle_message, events.NewMessage(incoming=True))

        print("Слушаю сообщения...")
        await self.client.run_until_disconnected()

    async def download_media_as_base64(self, message: Message) -> str:
        """Скачать медиа и конвертировать в base64"""
        try:
            data = await self.client.download_media(message, bytes)
            if data:
                return base64.b64encode(data).decode("utf-8")
        except Exception as e:
            print(f"Ошибка скачивания медиа: {e}")
        return None

    async def handle_voice(self, message: Message) -> str:
        """Обработка голосового сообщения"""
        try:
            # Скачиваем голосовое
            voice_data = await self.client.download_media(message, bytes)
            if voice_data:
                voice_base64 = base64.b64encode(voice_data).decode("utf-8")

                # Отправляем на распознавание в ИИ
                messages = [
                    {"role": "system", "content": "расшифруй это голосовое сообщение и скажи что там говорят"},
                    {"role": "user", "content": f"[голосовое сообщение: audio/ogg base64]"}
                ]

                # Пробуем отправить аудио на распознавание
                payload = {
                    "model": AI_MODEL,
                    "messages": messages,
                    "audio": voice_base64
                }

                async with aiohttp.ClientSession() as session:
                    async with session.post(AI_API_URL, json=payload, ssl=False) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if isinstance(data, dict):
                                return data.get("response") or data.get("text") or data.get("content", "голосовое сообщение")

                return "голосовое сообщение"
        except Exception as e:
            print(f"Ошибка обработки голосового: {e}")
        return "голосовое сообщение"

    async def handle_message(self, event: events.NewMessage.Event):
        """Обработка входящего сообщения"""
        message = event.message
        sender = await event.get_sender()
        chat = await event.get_chat()

        # Пропускаем свои сообщения
        if sender and sender.id == self.me.id:
            return

        # Пропускаем каналы и большие группы (опционально)
        # if event.is_channel:
        #     return

        chat_id = event.chat_id
        user_content = ""
        image_base64 = None

        # Обработка разных типов сообщений
        if message.voice or message.audio:
            # Голосовое сообщение
            user_content = await self.handle_voice(message)
            user_content = f"[голосовое сообщение]: {user_content}"

        elif message.photo:
            # Фото
            image_base64 = await self.download_media_as_base64(message)
            user_content = message.text or "[фото без подписи]"
            if image_base64:
                user_content = f"[пользователь отправил фото] {user_content}"

        elif message.document:
            # Документ/файл
            doc = message.document
            filename = ""
            for attr in doc.attributes:
                if hasattr(attr, "file_name"):
                    filename = attr.file_name
                    break
            user_content = f"[файл: {filename}] {message.text or ''}"

        elif message.sticker:
            # Стикер
            user_content = "[стикер]"

        elif message.text:
            # Обычное текстовое сообщение
            user_content = message.text

        else:
            # Другое
            user_content = "[медиа сообщение]"

        if not user_content.strip():
            return

        # Получаем историю чата
        history = self.db.get_history(chat_id)

        # Формируем сообщения для ИИ
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for msg in history:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        messages.append({"role": "user", "content": user_content})

        # Сохраняем сообщение пользователя
        await self.db.add_message(chat_id, "user", user_content)

        # Показываем "печатает..."
        async with self.client.action(chat_id, "typing"):
            # Получаем ответ от ИИ
            response = await self.ai.ask(messages, image_base64)

        # Сохраняем ответ
        await self.db.add_message(chat_id, "assistant", response)

        # Отправляем ответ
        try:
            await event.respond(response)
            print(f"[{chat_id}] {user_content[:50]}... -> {response[:50]}...")
        except Exception as e:
            print(f"Ошибка отправки: {e}")


async def main():
    if not API_ID or not API_HASH:
        print("Ошибка: Установите API_ID и API_HASH в .env файле")
        print("Получить можно тут: https://my.telegram.org/apps")
        return

    bot = UserBot()
    await bot.start()


if __name__ == "__main__":
    asyncio.run(main())
