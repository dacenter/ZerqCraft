"""
Telegram бот для подачи заявок на повышенную государственную
академическую стипендию СГТУ им. Гагарина Ю.А.

Запуск: python main.py
"""
import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from bot.config import BOT_TOKEN
from bot.database import Database
from bot.handlers import student_router, admin_router

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bot.log", encoding="utf-8"),
    ]
)

logger = logging.getLogger(__name__)


async def on_startup(bot: Bot):
    """Действия при запуске бота"""
    # Инициализируем базу данных
    db = Database()
    await db.init()
    logger.info("Database initialized")

    # Получаем информацию о боте
    bot_info = await bot.get_me()
    logger.info(f"Bot started: @{bot_info.username}")


async def on_shutdown(bot: Bot):
    """Действия при остановке бота"""
    logger.info("Bot shutting down...")


async def main():
    """Главная функция"""
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN not set! Create .env file with BOT_TOKEN=your_token")
        sys.exit(1)

    # Создаём бота и диспетчер
    bot = Bot(token=BOT_TOKEN, parse_mode="Markdown")
    dp = Dispatcher(storage=MemoryStorage())

    # Регистрируем роутеры
    dp.include_router(admin_router)  # Админ роутер первый для приоритета
    dp.include_router(student_router)

    # Регистрируем хуки
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    logger.info("Starting bot...")

    try:
        # Удаляем webhook и запускаем polling
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
