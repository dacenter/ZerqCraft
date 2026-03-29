"""
Хендлеры для студентов - упрощённая версия с AI анализом
"""
import os
import json
import logging
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, ContentType
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.config import ALLOWED_STUDENTS, DOCUMENTS_PATH
from bot.database import Database
from bot.utils.keyboards import Keyboards
from bot.utils.ai_analyzer import DocumentAnalyzer, format_analysis_result

router = Router()
db = Database()
logger = logging.getLogger(__name__)


class StudentStates(StatesGroup):
    """Состояния студента"""
    waiting_for_name = State()
    waiting_for_documents = State()


# ===== СТАРТ И РЕГИСТРАЦИЯ =====

@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    """Обработка команды /start"""
    await state.clear()

    student = await db.get_student_by_telegram_id(message.from_user.id)

    if student:
        await message.answer(
            f"👋 Привет, *{student['full_name']}*!\n\n"
            "Я бот для подачи заявок на повышенную стипендию СГТУ.\n\n"
            "📎 *Отправьте мне документы* (ZIP-архив или отдельные файлы):\n"
            "• Таблица достижений (PDF/фото)\n"
            "• Грамоты и сертификаты\n"
            "• Рекомендательные письма\n\n"
            "🤖 AI автоматически проанализирует документы, "
            "сверит грамоты с таблицей и рассчитает баллы.",
            parse_mode="Markdown",
            reply_markup=Keyboards.main_menu()
        )
    else:
        await message.answer(
            "👋 Добро пожаловать!\n\n"
            "Я бот для подачи заявок на повышенную "
            "государственную академическую стипендию СГТУ.\n\n"
            "📝 Для начала введите ваше *ФИО полностью* "
            "(Фамилия Имя Отчество):",
            parse_mode="Markdown"
        )
        await state.set_state(StudentStates.waiting_for_name)


@router.message(StudentStates.waiting_for_name)
async def process_name(message: Message, state: FSMContext):
    """Обработка ввода ФИО"""
    full_name = message.text.strip()

    if full_name not in ALLOWED_STUDENTS:
        await message.answer(
            "⛔ *Доступ запрещён*\n\n"
            "Ваше ФИО не найдено в списке студентов.\n\n"
            "Если вы считаете это ошибкой - обратитесь в деканат.\n"
            "Попробуйте ввести ФИО ещё раз:",
            parse_mode="Markdown"
        )
        return

    try:
        await db.add_student(
            telegram_id=message.from_user.id,
            full_name=full_name,
            username=message.from_user.username
        )

        await state.clear()
        await message.answer(
            f"✅ *Регистрация успешна!*\n\n"
            f"Добро пожаловать, *{full_name}*!\n\n"
            "📎 Теперь отправьте мне документы для анализа:\n"
            "• ZIP-архив со всеми документами\n"
            "• Или отдельные файлы (фото, PDF)\n\n"
            "🤖 AI проанализирует их и рассчитает баллы.",
            parse_mode="Markdown",
            reply_markup=Keyboards.main_menu()
        )

    except Exception as e:
        logger.error(f"Registration error: {e}")
        await message.answer(f"❌ Ошибка: {e}\n\nПопробуйте /start")


# ===== ГЛАВНОЕ МЕНЮ =====

@router.message(F.text == "📎 Отправить документы")
async def request_documents(message: Message, state: FSMContext):
    """Запрос документов"""
    student = await db.get_student_by_telegram_id(message.from_user.id)
    if not student:
        await message.answer("Пожалуйста, зарегистрируйтесь: /start")
        return

    await message.answer(
        "📎 *Отправьте документы для анализа*\n\n"
        "Вы можете отправить:\n"
        "• 📦 *ZIP-архив* со всеми документами (рекомендуется)\n"
        "• 📄 *PDF файлы* с таблицей и грамотами\n"
        "• 🖼 *Фотографии* грамот и сертификатов\n\n"
        "После отправки нажмите кнопку *'✅ Готово - Анализировать'*",
        parse_mode="Markdown",
        reply_markup=Keyboards.document_upload()
    )
    await state.set_state(StudentStates.waiting_for_documents)
    await state.update_data(files=[])


@router.message(StudentStates.waiting_for_documents, F.content_type.in_({
    ContentType.PHOTO, ContentType.DOCUMENT
}))
async def receive_document(message: Message, state: FSMContext, bot: Bot):
    """Получение документа"""
    data = await state.get_data()
    files = data.get("files", [])

    # Получаем файл
    if message.photo:
        file = await bot.get_file(message.photo[-1].file_id)
        filename = f"photo_{len(files)}.jpg"
        mime_type = "image/jpeg"
    else:
        file = await bot.get_file(message.document.file_id)
        filename = message.document.file_name or f"doc_{len(files)}"
        mime_type = message.document.mime_type or "application/octet-stream"

    # Скачиваем файл
    file_bytes = await bot.download_file(file.file_path)
    file_data = file_bytes.read()

    files.append({
        "data": file_data,
        "filename": filename,
        "mime_type": mime_type,
        "file_id": message.photo[-1].file_id if message.photo else message.document.file_id
    })

    await state.update_data(files=files)

    await message.answer(
        f"✅ Получен: *{filename}*\n"
        f"📎 Всего файлов: *{len(files)}*\n\n"
        "Отправьте ещё файлы или нажмите *'✅ Готово'*",
        parse_mode="Markdown",
        reply_markup=Keyboards.document_upload()
    )


@router.message(F.text == "✅ Готово - Анализировать")
async def analyze_documents(message: Message, state: FSMContext):
    """Запуск анализа документов"""
    student = await db.get_student_by_telegram_id(message.from_user.id)
    if not student:
        await message.answer("Ошибка. Начните с /start")
        return

    data = await state.get_data()
    files = data.get("files", [])

    if not files:
        await message.answer(
            "❌ Вы не отправили ни одного документа!\n\n"
            "Сначала отправьте файлы, затем нажмите 'Готово'.",
            reply_markup=Keyboards.document_upload()
        )
        return

    # Отправляем сообщение о начале анализа
    status_msg = await message.answer(
        "🔄 *Анализирую документы...*\n\n"
        "🤖 AI проверяет:\n"
        "• Таблицу достижений\n"
        "• Грамоты и сертификаты\n"
        "• Соответствие данных\n\n"
        "Это может занять некоторое время...",
        parse_mode="Markdown",
        reply_markup=Keyboards.main_menu()
    )

    try:
        # Создаём анализатор и запускаем
        analyzer = DocumentAnalyzer()

        # Подготавливаем файлы (убираем bytes из state для сохранения)
        files_for_analysis = [
            {"data": f["data"], "filename": f["filename"], "mime_type": f["mime_type"]}
            for f in files
        ]

        result = await analyzer.analyze_documents(files_for_analysis)

        # Сохраняем заявку в БД
        app_id = await db.create_application(
            student_id=student["id"],
            scholarship_type=result.get("scholarship_type", "unknown")
        )

        # Сохраняем результат анализа
        total_score = result.get("total_score", 0)
        verified_score = result.get("verified_score", 0)
        await db.update_application_score(app_id, verified_score)

        # Сохраняем JSON результата как комментарий
        await db.update_application_status(
            app_id,
            "pending",
            json.dumps(result, ensure_ascii=False, indent=2)[:1000]
        )

        # Сохраняем файлы
        os.makedirs(f"{DOCUMENTS_PATH}/{app_id}", exist_ok=True)
        for i, f in enumerate(files):
            ext = f["filename"].split(".")[-1] if "." in f["filename"] else "bin"
            with open(f"{DOCUMENTS_PATH}/{app_id}/{i}.{ext}", "wb") as fp:
                fp.write(f["data"])

            # Сохраняем в БД
            await db.add_document(
                application_id=app_id,
                document_type="uploaded",
                file_id=f.get("file_id", ""),
                file_path=f"{DOCUMENTS_PATH}/{app_id}/{i}.{ext}",
                description=f["filename"]
            )

        # Форматируем и отправляем результат
        formatted_result = format_analysis_result(result)

        await status_msg.edit_text(
            f"✅ *Анализ завершён!*\n\n"
            f"📋 Заявка *№{app_id}* создана\n\n"
            f"{formatted_result}\n\n"
            "Заявка отправлена на рассмотрение администратору.",
            parse_mode="Markdown"
        )

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        await status_msg.edit_text(
            f"❌ *Ошибка анализа*\n\n"
            f"```{str(e)[:200]}```\n\n"
            "Попробуйте отправить документы ещё раз.",
            parse_mode="Markdown"
        )

    await state.clear()


# ===== МОИ ЗАЯВКИ =====

@router.message(F.text == "📋 Мои заявки")
async def my_applications(message: Message):
    """Просмотр заявок студента"""
    student = await db.get_student_by_telegram_id(message.from_user.id)
    if not student:
        await message.answer("Пожалуйста, зарегистрируйтесь: /start")
        return

    applications = await db.get_student_applications(student["id"])

    if not applications:
        await message.answer(
            "📋 У вас пока нет заявок.\n\n"
            "Отправьте документы для создания заявки.",
            reply_markup=Keyboards.main_menu()
        )
        return

    status_emoji = {
        "pending": "⏳",
        "in_review": "🔍",
        "approved": "✅",
        "rejected": "❌"
    }

    status_names = {
        "pending": "На рассмотрении",
        "in_review": "Рассматривается",
        "approved": "Одобрена",
        "rejected": "Отклонена"
    }

    lines = ["📋 *Ваши заявки:*\n"]
    for app in applications:
        emoji = status_emoji.get(app["status"], "📋")
        status = status_names.get(app["status"], app["status"])
        score = app["total_score"]
        date = app["created_at"][:10] if app["created_at"] else ""

        lines.append(
            f"{emoji} *№{app['id']}* | {score} баллов\n"
            f"   Статус: {status}\n"
            f"   Дата: {date}"
        )

    await message.answer(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=Keyboards.main_menu()
    )


# ===== ПОМОЩЬ =====

@router.message(F.text == "❓ Помощь")
async def show_help(message: Message):
    """Показать справку"""
    await message.answer(
        "❓ *Как пользоваться ботом*\n\n"
        "*1. Подготовьте документы:*\n"
        "• Таблица достижений (по шаблону)\n"
        "• Грамоты/дипломы/сертификаты\n"
        "• Рекомендательные письма (если есть)\n\n"
        "*2. Отправьте документы:*\n"
        "• Лучше всего - ZIP архив со всеми файлами\n"
        "• Или отправьте файлы по одному\n\n"
        "*3. Дождитесь анализа:*\n"
        "• AI проверит все документы\n"
        "• Сверит таблицу с грамотами\n"
        "• Рассчитает баллы\n\n"
        "*4. Получите результат:*\n"
        "• Предварительные баллы\n"
        "• Список замечаний (если есть)\n"
        "• Заявка уйдёт на проверку админу\n\n"
        "⚠️ *Важно:*\n"
        "• Достижения только за текущий год\n"
        "• Каждое достижение должно быть подтверждено\n"
        "• Оценки за 2 семестра - только 4 и 5",
        parse_mode="Markdown",
        reply_markup=Keyboards.main_menu()
    )


# ===== ОТМЕНА =====

@router.message(F.text == "❌ Отмена")
async def cancel_action(message: Message, state: FSMContext):
    """Отмена текущего действия"""
    await state.clear()
    await message.answer(
        "Действие отменено.",
        reply_markup=Keyboards.main_menu()
    )


# ===== ОБРАБОТКА ФАЙЛОВ ВНЕ СОСТОЯНИЯ =====

@router.message(StateFilter(None), F.content_type.in_({
    ContentType.PHOTO, ContentType.DOCUMENT
}))
async def receive_document_direct(message: Message, state: FSMContext, bot: Bot):
    """Получение документа без предварительного выбора"""
    student = await db.get_student_by_telegram_id(message.from_user.id)
    if not student:
        await message.answer("Пожалуйста, зарегистрируйтесь: /start")
        return

    # Переводим в состояние загрузки и обрабатываем файл
    await state.set_state(StudentStates.waiting_for_documents)
    await state.update_data(files=[])

    # Вызываем обработчик документов
    await receive_document(message, state, bot)
