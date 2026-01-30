"""
Хендлеры для студентов
"""
import os
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, ContentType
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.config import ALLOWED_STUDENTS, SCHOLARSHIP_TYPES, DOCUMENTS_PATH
from bot.database import Database
from bot.utils.keyboards import Keyboards
from bot.utils.scoring import ScoringSystem, ACHIEVEMENT_NAMES

router = Router()
db = Database()


class RegistrationStates(StatesGroup):
    """Состояния регистрации"""
    waiting_for_name = State()


class ApplicationStates(StatesGroup):
    """Состояния подачи заявки"""
    selecting_scholarship = State()
    uploading_documents = State()
    waiting_for_document = State()
    selecting_achievements = State()
    waiting_for_description = State()


# ===== СТАРТ И РЕГИСТРАЦИЯ =====

@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    """Обработка команды /start"""
    await state.clear()

    # Проверяем, зарегистрирован ли пользователь
    student = await db.get_student_by_telegram_id(message.from_user.id)

    if student:
        await message.answer(
            f"👋 Привет, *{student['full_name']}*!\n\n"
            "Вы можете подать заявку на повышенную государственную "
            "академическую стипендию СГТУ им. Гагарина Ю.А.\n\n"
            "Выберите действие:",
            parse_mode="Markdown",
            reply_markup=Keyboards.main_menu()
        )
    else:
        await message.answer(
            "👋 Добро пожаловать в бот подачи заявок на повышенную "
            "государственную академическую стипендию!\n\n"
            "📝 Для начала работы введите ваше *ФИО полностью* "
            "(Фамилия Имя Отчество):",
            parse_mode="Markdown",
            reply_markup=Keyboards.cancel_button()
        )
        await state.set_state(RegistrationStates.waiting_for_name)


@router.message(RegistrationStates.waiting_for_name)
async def process_name(message: Message, state: FSMContext):
    """Обработка ввода ФИО"""
    if message.text == "❌ Отмена":
        await state.clear()
        await message.answer(
            "Регистрация отменена. Нажмите /start для начала.",
            reply_markup=None
        )
        return

    full_name = message.text.strip()

    # Проверяем, есть ли студент в списке разрешённых
    if full_name not in ALLOWED_STUDENTS:
        await message.answer(
            "⛔ *Доступ запрещён*\n\n"
            "Ваше ФИО не найдено в списке студентов, "
            "допущенных к подаче заявок.\n\n"
            "Если вы считаете, что это ошибка, обратитесь в деканат.\n\n"
            "Попробуйте ввести ФИО ещё раз:",
            parse_mode="Markdown"
        )
        return

    # Регистрируем студента
    try:
        await db.add_student(
            telegram_id=message.from_user.id,
            full_name=full_name,
            username=message.from_user.username
        )

        await state.clear()
        await message.answer(
            f"✅ Регистрация успешна!\n\n"
            f"Добро пожаловать, *{full_name}*!\n\n"
            "Теперь вы можете подать заявку на повышенную стипендию.",
            parse_mode="Markdown",
            reply_markup=Keyboards.main_menu()
        )

        # Сохраняем сообщение в историю
        student = await db.get_student_by_telegram_id(message.from_user.id)
        if student:
            await db.save_message(
                student_id=student["id"],
                message_text=f"Регистрация: {full_name}",
                message_type="text",
                direction="incoming"
            )

    except Exception as e:
        await message.answer(
            f"❌ Ошибка регистрации: {e}\n\nПопробуйте снова /start"
        )


# ===== ГЛАВНОЕ МЕНЮ =====

@router.message(F.text == "📝 Новая заявка")
async def new_application(message: Message, state: FSMContext):
    """Создание новой заявки"""
    student = await db.get_student_by_telegram_id(message.from_user.id)
    if not student:
        await message.answer("Пожалуйста, зарегистрируйтесь: /start")
        return

    # Проверяем, нет ли уже активной заявки
    current_app = await db.get_current_application(student["id"])
    if current_app:
        await message.answer(
            "⚠️ У вас уже есть активная заявка.\n"
            "Дождитесь её рассмотрения или отмените через меню 'Мои заявки'.",
            reply_markup=Keyboards.main_menu()
        )
        return

    await message.answer(
        "📝 *Новая заявка на стипендию*\n\n"
        "Выберите тип повышенной государственной академической стипендии:",
        parse_mode="Markdown",
        reply_markup=Keyboards.scholarship_types()
    )
    await state.set_state(ApplicationStates.selecting_scholarship)


@router.callback_query(F.data.startswith("scholarship:"), ApplicationStates.selecting_scholarship)
async def select_scholarship_type(callback: CallbackQuery, state: FSMContext):
    """Выбор типа стипендии"""
    scholarship_type = callback.data.split(":")[1]
    student = await db.get_student_by_telegram_id(callback.from_user.id)

    if not student:
        await callback.answer("Ошибка. Начните с /start")
        return

    # Создаём заявку
    app_id = await db.create_application(student["id"], scholarship_type)

    await state.update_data(
        application_id=app_id,
        scholarship_type=scholarship_type,
        documents_count=0
    )

    type_name = ScoringSystem.get_scholarship_types().get(scholarship_type, scholarship_type)

    await callback.message.edit_text(
        f"✅ Заявка создана!\n\n"
        f"*Тип стипендии:* {type_name}\n\n"
        f"📎 Теперь загрузите документы:\n"
        f"1️⃣ *Таблица достижений* (файл Word/PDF с вашими данными)\n"
        f"2️⃣ *Грамоты/сертификаты* (фото или сканы)\n"
        f"3️⃣ *Рекомендательные письма* (если есть)\n\n"
        f"Выберите тип документа для загрузки:",
        parse_mode="Markdown",
        reply_markup=Keyboards.document_types()
    )
    await state.set_state(ApplicationStates.uploading_documents)


@router.callback_query(F.data.startswith("doc_type:"), ApplicationStates.uploading_documents)
async def select_document_type(callback: CallbackQuery, state: FSMContext):
    """Выбор типа документа"""
    doc_type = callback.data.split(":")[1]

    if doc_type == "finish":
        # Завершаем загрузку документов
        data = await state.get_data()
        docs_count = data.get("documents_count", 0)

        if docs_count == 0:
            await callback.answer("Загрузите хотя бы один документ!", show_alert=True)
            return

        await callback.message.edit_text(
            "📊 *Теперь укажите ваши достижения*\n\n"
            "Выберите достижения из списка, чтобы рассчитать предварительные баллы:",
            parse_mode="Markdown",
            reply_markup=Keyboards.achievement_selector(data["scholarship_type"])
        )
        await state.set_state(ApplicationStates.selecting_achievements)
        await state.update_data(achievements=[])
        return

    doc_type_names = {
        "table": "таблицу достижений",
        "certificate": "грамоту/сертификат",
        "recommendation": "рекомендательное письмо"
    }

    await state.update_data(current_doc_type=doc_type)

    await callback.message.edit_text(
        f"📤 Отправьте {doc_type_names.get(doc_type, 'документ')}.\n\n"
        f"Принимаются: фото, PDF, Word документы.",
        parse_mode="Markdown"
    )
    await state.set_state(ApplicationStates.waiting_for_document)


@router.message(ApplicationStates.waiting_for_document, F.content_type.in_({
    ContentType.PHOTO, ContentType.DOCUMENT
}))
async def receive_document(message: Message, state: FSMContext, bot: Bot):
    """Получение документа"""
    data = await state.get_data()
    app_id = data.get("application_id")
    doc_type = data.get("current_doc_type", "other")

    student = await db.get_student_by_telegram_id(message.from_user.id)
    if not student:
        return

    # Получаем file_id
    if message.photo:
        file_id = message.photo[-1].file_id
        file_type = "photo"
    else:
        file_id = message.document.file_id
        file_type = "document"

    # Сохраняем документ в БД
    doc_id = await db.add_document(
        application_id=app_id,
        document_type=doc_type,
        file_id=file_id,
        description=message.caption
    )

    # Сохраняем файл локально
    try:
        os.makedirs(f"{DOCUMENTS_PATH}/{app_id}", exist_ok=True)
        file = await bot.get_file(file_id)
        ext = file.file_path.split(".")[-1] if "." in file.file_path else "jpg"
        local_path = f"{DOCUMENTS_PATH}/{app_id}/{doc_id}.{ext}"
        await bot.download_file(file.file_path, local_path)
    except Exception:
        pass  # Файл сохранится по file_id

    # Обновляем счётчик документов
    docs_count = data.get("documents_count", 0) + 1
    await state.update_data(documents_count=docs_count)

    # Сохраняем в историю сообщений
    await db.save_message(
        student_id=student["id"],
        message_text=f"Документ: {doc_type}",
        file_id=file_id,
        message_type=file_type,
        direction="incoming"
    )

    doc_type_names = {
        "table": "Таблица достижений",
        "certificate": "Грамота/сертификат",
        "recommendation": "Рекомендательное письмо"
    }

    await message.answer(
        f"✅ *{doc_type_names.get(doc_type, 'Документ')}* получен!\n\n"
        f"📎 Загружено документов: *{docs_count}*\n\n"
        f"Выберите следующее действие:",
        parse_mode="Markdown",
        reply_markup=Keyboards.document_types()
    )
    await state.set_state(ApplicationStates.uploading_documents)


@router.callback_query(F.data.startswith("ach:"), ApplicationStates.selecting_achievements)
async def select_achievement(callback: CallbackQuery, state: FSMContext):
    """Выбор достижения"""
    achievement_key = callback.data.split(":")[1]
    data = await state.get_data()

    if achievement_key == "done":
        # Завершаем выбор достижений
        achievements = data.get("achievements", [])
        app_id = data.get("application_id")
        scholarship_type = data.get("scholarship_type")

        # Сохраняем достижения и считаем баллы
        total_score = 0
        for ach in achievements:
            score = ScoringSystem.get_score(scholarship_type, ach["type"])
            await db.add_achievement(
                application_id=app_id,
                achievement_type=ach["type"],
                score=score,
                description=ach.get("description")
            )
            total_score += score

        await db.update_application_score(app_id, total_score)

        # Формируем отчёт
        report_lines = ["📊 *Предварительный расчёт баллов:*\n"]
        for ach in achievements:
            name = ScoringSystem.get_achievement_name(ach["type"])
            score = ScoringSystem.get_score(scholarship_type, ach["type"])
            report_lines.append(f"• {name}: *{score}* б.")

        report_lines.append(f"\n💰 *Итого: {total_score} баллов*")
        report_lines.append(
            f"\n✅ Ваша заявка отправлена на рассмотрение!\n"
            f"Ожидайте ответа от администратора."
        )

        await callback.message.edit_text(
            "\n".join(report_lines),
            parse_mode="Markdown"
        )

        await state.clear()
        await callback.message.answer(
            "Главное меню:",
            reply_markup=Keyboards.main_menu()
        )
        return

    # Добавляем достижение
    achievements = data.get("achievements", [])
    scholarship_type = data.get("scholarship_type")

    # Проверяем, не добавлено ли уже
    if any(a["type"] == achievement_key for a in achievements):
        await callback.answer("Это достижение уже добавлено!", show_alert=True)
        return

    achievements.append({"type": achievement_key})
    await state.update_data(achievements=achievements)

    # Считаем текущие баллы
    current_score = sum(
        ScoringSystem.get_score(scholarship_type, a["type"])
        for a in achievements
    )

    name = ScoringSystem.get_achievement_name(achievement_key)
    await callback.answer(f"✅ Добавлено: {name}")

    await callback.message.edit_text(
        f"📊 *Выбор достижений*\n\n"
        f"Добавлено: *{len(achievements)}* достижений\n"
        f"Текущий балл: *{current_score}*\n\n"
        f"Продолжайте выбирать или нажмите 'Готово':",
        parse_mode="Markdown",
        reply_markup=Keyboards.achievement_selector(scholarship_type)
    )


@router.callback_query(F.data.startswith("ach_page:"))
async def achievement_page(callback: CallbackQuery, state: FSMContext):
    """Пагинация достижений"""
    _, scholarship_type, page = callback.data.split(":")
    page = int(page)

    await callback.message.edit_reply_markup(
        reply_markup=Keyboards.achievement_selector(scholarship_type, page)
    )


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
            "Нажмите '📝 Новая заявка' чтобы создать.",
            reply_markup=Keyboards.main_menu()
        )
        return

    status_names = {
        "pending": "⏳ На рассмотрении",
        "in_review": "🔍 Рассматривается",
        "approved": "✅ Одобрена",
        "rejected": "❌ Отклонена"
    }

    type_names = ScoringSystem.get_scholarship_types()

    lines = ["📋 *Ваши заявки:*\n"]
    for app in applications:
        status = status_names.get(app["status"], app["status"])
        type_name = type_names.get(app["scholarship_type"], app["scholarship_type"])
        score = app["total_score"]
        date = app["created_at"][:10] if app["created_at"] else ""

        lines.append(
            f"*№{app['id']}* | {type_name}\n"
            f"   {status} | {score} баллов\n"
            f"   📅 {date}\n"
        )

        if app.get("admin_comment"):
            lines.append(f"   💬 Комментарий: {app['admin_comment']}\n")

    await message.answer(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=Keyboards.main_menu()
    )


# ===== ТАБЛИЦА БАЛЛОВ =====

@router.message(F.text == "📊 Таблица баллов")
async def show_scoring_table(message: Message):
    """Показать таблицу баллов"""
    await message.answer(
        "📊 *Таблица баллов по типам стипендий*\n\n"
        "Выберите тип стипендии для просмотра баллов:",
        parse_mode="Markdown",
        reply_markup=Keyboards.scholarship_types()
    )


@router.callback_query(F.data.startswith("scholarship:"), StateFilter(None))
async def show_scholarship_scores(callback: CallbackQuery):
    """Показать баллы для типа стипендии"""
    scholarship_type = callback.data.split(":")[1]
    table = ScoringSystem.format_scoring_table(scholarship_type)
    type_name = ScoringSystem.get_scholarship_types().get(scholarship_type, "")

    await callback.message.edit_text(
        f"{type_name}\n\n{table}",
        parse_mode="Markdown"
    )


# ===== ПОМОЩЬ =====

@router.message(F.text == "❓ Помощь")
async def show_help(message: Message):
    """Показать справку"""
    await message.answer(
        "❓ *Справка по боту*\n\n"
        "*Как подать заявку:*\n"
        "1️⃣ Нажмите '📝 Новая заявка'\n"
        "2️⃣ Выберите тип стипендии\n"
        "3️⃣ Загрузите документы:\n"
        "   • Таблицу достижений (по шаблону)\n"
        "   • Грамоты и сертификаты\n"
        "   • Рекомендательные письма\n"
        "4️⃣ Укажите ваши достижения\n"
        "5️⃣ Дождитесь проверки администратором\n\n"
        "*Типы стипендий:*\n"
        "🔬 Научная деятельность\n"
        "🏆 Спортивные достижения\n"
        "🎨 Творческая деятельность\n"
        "👥 Общественная деятельность\n\n"
        "*Важно:*\n"
        "• Все документы должны быть по шаблону\n"
        "• Оценки за 2 семестра - только 4 и 5\n"
        "• Достижения только за текущий учебный год\n\n"
        "По вопросам обращайтесь в деканат.",
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


# ===== ОБРАБОТКА ВСЕХ ОСТАЛЬНЫХ СООБЩЕНИЙ =====

@router.message(StateFilter(None))
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    student = await db.get_student_by_telegram_id(message.from_user.id)

    if not student:
        await message.answer(
            "Для начала работы нажмите /start"
        )
        return

    # Сохраняем сообщение в историю
    file_id = None
    msg_type = "text"

    if message.photo:
        file_id = message.photo[-1].file_id
        msg_type = "photo"
    elif message.document:
        file_id = message.document.file_id
        msg_type = "document"

    await db.save_message(
        student_id=student["id"],
        message_text=message.text or message.caption,
        file_id=file_id,
        message_type=msg_type,
        direction="incoming"
    )

    await message.answer(
        "Используйте кнопки меню для навигации.",
        reply_markup=Keyboards.main_menu()
    )
