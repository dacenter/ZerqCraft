"""
Хендлеры для администратора
"""
import io
from datetime import datetime
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, InputFile
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.config import ADMIN_ID
from bot.database import Database
from bot.utils.keyboards import Keyboards
from bot.utils.scoring import ScoringSystem

router = Router()
db = Database()


class AdminStates(StatesGroup):
    """Состояния админ-панели"""
    searching = State()
    adding_comment = State()
    setting_score = State()
    messaging_student = State()
    adding_note = State()


def admin_only(func):
    """Декоратор для проверки прав админа"""
    async def wrapper(message_or_callback, *args, **kwargs):
        user_id = (
            message_or_callback.from_user.id
            if hasattr(message_or_callback, "from_user")
            else message_or_callback.message.from_user.id
        )
        if user_id != ADMIN_ID:
            return
        return await func(message_or_callback, *args, **kwargs)
    return wrapper


# ===== КОМАНДА АДМИНА =====

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Админ-панель"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ Доступ запрещён")
        return

    stats = await db.get_statistics()

    await message.answer(
        f"👨‍💼 *Панель администратора*\n\n"
        f"📊 *Статистика:*\n"
        f"• Студентов: {stats['total_students']}\n"
        f"• Заявок: {stats['total_applications']}\n"
        f"• Документов: {stats['total_documents']}\n"
        f"• Средний балл: {stats['avg_score']}\n\n"
        f"*По статусам:*\n"
        f"• ⏳ На рассмотрении: {stats['status_counts'].get('pending', 0)}\n"
        f"• 🔍 Рассматривается: {stats['status_counts'].get('in_review', 0)}\n"
        f"• ✅ Одобрено: {stats['status_counts'].get('approved', 0)}\n"
        f"• ❌ Отклонено: {stats['status_counts'].get('rejected', 0)}",
        parse_mode="Markdown",
        reply_markup=Keyboards.admin_main_menu()
    )


# ===== СТАТИСТИКА =====

@router.message(F.text == "📊 Статистика")
async def show_statistics(message: Message):
    """Показать статистику"""
    if message.from_user.id != ADMIN_ID:
        return

    stats = await db.get_statistics()

    await message.answer(
        f"📊 *Подробная статистика*\n\n"
        f"👥 *Пользователи:*\n"
        f"• Всего студентов: {stats['total_students']}\n\n"
        f"📋 *Заявки:*\n"
        f"• Всего: {stats['total_applications']}\n"
        f"• ⏳ На рассмотрении: {stats['status_counts'].get('pending', 0)}\n"
        f"• 🔍 Рассматривается: {stats['status_counts'].get('in_review', 0)}\n"
        f"• ✅ Одобрено: {stats['status_counts'].get('approved', 0)}\n"
        f"• ❌ Отклонено: {stats['status_counts'].get('rejected', 0)}\n\n"
        f"📎 *Документы:*\n"
        f"• Всего загружено: {stats['total_documents']}\n\n"
        f"💰 *Баллы:*\n"
        f"• Средний балл: {stats['avg_score']}",
        parse_mode="Markdown",
        reply_markup=Keyboards.admin_main_menu()
    )


# ===== ВСЕ ЗАЯВКИ =====

@router.message(F.text == "📋 Все заявки")
async def all_applications(message: Message, state: FSMContext):
    """Показать все заявки"""
    if message.from_user.id != ADMIN_ID:
        return

    applications = await db.get_all_applications()

    if not applications:
        await message.answer(
            "📋 Заявок пока нет.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    await state.update_data(applications_list=applications)

    await message.answer(
        f"📋 *Все заявки ({len(applications)}):*\n\n"
        f"Нажмите на заявку для просмотра:",
        parse_mode="Markdown",
        reply_markup=Keyboards.applications_list(applications)
    )


# ===== ФИЛЬТРЫ ПО СТАТУСУ =====

@router.message(F.text == "⏳ На рассмотрении")
async def pending_applications(message: Message, state: FSMContext):
    """Заявки на рассмотрении"""
    if message.from_user.id != ADMIN_ID:
        return

    applications = await db.get_all_applications(status="pending")

    if not applications:
        await message.answer(
            "⏳ Нет заявок на рассмотрении.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    await state.update_data(applications_list=applications)

    await message.answer(
        f"⏳ *Заявки на рассмотрении ({len(applications)}):*",
        parse_mode="Markdown",
        reply_markup=Keyboards.applications_list(applications)
    )


@router.message(F.text == "✅ Одобренные")
async def approved_applications(message: Message, state: FSMContext):
    """Одобренные заявки"""
    if message.from_user.id != ADMIN_ID:
        return

    applications = await db.get_all_applications(status="approved")

    if not applications:
        await message.answer(
            "✅ Нет одобренных заявок.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    await state.update_data(applications_list=applications)

    await message.answer(
        f"✅ *Одобренные заявки ({len(applications)}):*",
        parse_mode="Markdown",
        reply_markup=Keyboards.applications_list(applications)
    )


@router.message(F.text == "❌ Отклонённые")
async def rejected_applications(message: Message, state: FSMContext):
    """Отклонённые заявки"""
    if message.from_user.id != ADMIN_ID:
        return

    applications = await db.get_all_applications(status="rejected")

    if not applications:
        await message.answer(
            "❌ Нет отклонённых заявок.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    await state.update_data(applications_list=applications)

    await message.answer(
        f"❌ *Отклонённые заявки ({len(applications)}):*",
        parse_mode="Markdown",
        reply_markup=Keyboards.applications_list(applications)
    )


# ===== СТУДЕНТЫ =====

@router.message(F.text == "👥 Студенты")
async def all_students(message: Message, state: FSMContext):
    """Показать всех студентов"""
    if message.from_user.id != ADMIN_ID:
        return

    students = await db.get_all_students()

    if not students:
        await message.answer(
            "👥 Студентов пока нет.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    await state.update_data(students_list=students)

    await message.answer(
        f"👥 *Зарегистрированные студенты ({len(students)}):*",
        parse_mode="Markdown",
        reply_markup=Keyboards.student_list(students)
    )


# ===== ПОИСК =====

@router.message(F.text == "🔍 Поиск")
async def start_search(message: Message, state: FSMContext):
    """Начать поиск"""
    if message.from_user.id != ADMIN_ID:
        return

    await message.answer(
        "🔍 Введите ФИО студента для поиска:",
        reply_markup=Keyboards.cancel_button()
    )
    await state.set_state(AdminStates.searching)


@router.message(AdminStates.searching)
async def process_search(message: Message, state: FSMContext):
    """Обработка поиска"""
    if message.text == "❌ Отмена":
        await state.clear()
        await message.answer(
            "Поиск отменён.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    query = message.text.strip()
    students = await db.search_students(query)

    if not students:
        await message.answer(
            f"🔍 По запросу «{query}» ничего не найдено.\n\n"
            "Попробуйте другой запрос или нажмите Отмена.",
            reply_markup=Keyboards.cancel_button()
        )
        return

    await state.clear()
    await state.update_data(students_list=students)

    await message.answer(
        f"🔍 *Результаты поиска ({len(students)}):*",
        parse_mode="Markdown",
        reply_markup=Keyboards.student_list(students)
    )


# ===== ЭКСПОРТ =====

@router.message(F.text == "📤 Экспорт")
async def export_data(message: Message):
    """Экспорт данных"""
    if message.from_user.id != ADMIN_ID:
        return

    applications = await db.get_all_applications()

    if not applications:
        await message.answer(
            "Нет данных для экспорта.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    # Формируем CSV
    lines = ["ФИО;Тип стипендии;Статус;Баллы;Дата;Комментарий"]

    status_names = {
        "pending": "На рассмотрении",
        "in_review": "Рассматривается",
        "approved": "Одобрена",
        "rejected": "Отклонена"
    }

    type_names = {
        "scientific": "Научная",
        "sport": "Спортивная",
        "creative": "Творческая",
        "public": "Общественная"
    }

    for app in applications:
        name = app.get("full_name", "")
        s_type = type_names.get(app["scholarship_type"], app["scholarship_type"])
        status = status_names.get(app["status"], app["status"])
        score = app["total_score"]
        date = app["created_at"][:10] if app["created_at"] else ""
        comment = (app.get("admin_comment") or "").replace(";", ",")

        lines.append(f"{name};{s_type};{status};{score};{date};{comment}")

    csv_content = "\n".join(lines)

    # Отправляем файл
    file_bytes = io.BytesIO(csv_content.encode("utf-8-sig"))
    file_bytes.name = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    await message.answer_document(
        InputFile(file_bytes),
        caption="📤 Экспорт заявок",
        reply_markup=Keyboards.admin_main_menu()
    )


# ===== ПАГИНАЦИЯ =====

@router.callback_query(F.data.startswith("apps_page:"))
async def applications_page(callback: CallbackQuery, state: FSMContext):
    """Пагинация заявок"""
    if callback.from_user.id != ADMIN_ID:
        return

    page = int(callback.data.split(":")[1])
    data = await state.get_data()
    applications = data.get("applications_list", [])

    await callback.message.edit_reply_markup(
        reply_markup=Keyboards.applications_list(applications, page)
    )


@router.callback_query(F.data.startswith("students_page:"))
async def students_page(callback: CallbackQuery, state: FSMContext):
    """Пагинация студентов"""
    if callback.from_user.id != ADMIN_ID:
        return

    page = int(callback.data.split(":")[1])
    data = await state.get_data()
    students = data.get("students_list", [])

    await callback.message.edit_reply_markup(
        reply_markup=Keyboards.student_list(students, page)
    )


# ===== ПРОСМОТР ЗАЯВКИ =====

@router.callback_query(F.data.startswith("app:"))
async def view_application(callback: CallbackQuery, state: FSMContext, bot: Bot):
    """Просмотр заявки"""
    if callback.from_user.id != ADMIN_ID:
        return

    app_id = int(callback.data.split(":")[1])
    app = await db.get_application(app_id)

    if not app:
        await callback.answer("Заявка не найдена", show_alert=True)
        return

    # Получаем студента
    applications = await db.get_all_applications()
    app_with_student = next((a for a in applications if a["id"] == app_id), None)

    student_name = app_with_student.get("full_name", "Неизвестно") if app_with_student else "Неизвестно"

    # Получаем документы и достижения
    documents = await db.get_application_documents(app_id)
    achievements = await db.get_application_achievements(app_id)

    status_names = {
        "pending": "⏳ На рассмотрении",
        "in_review": "🔍 Рассматривается",
        "approved": "✅ Одобрена",
        "rejected": "❌ Отклонена"
    }

    type_names = ScoringSystem.get_scholarship_types()

    doc_type_names = {
        "table": "📊 Таблица",
        "certificate": "🏅 Грамота",
        "recommendation": "📄 Рекомендация"
    }

    # Формируем информацию
    text = (
        f"📋 *Заявка №{app_id}*\n\n"
        f"👤 *Студент:* {student_name}\n"
        f"📝 *Тип:* {type_names.get(app['scholarship_type'], app['scholarship_type'])}\n"
        f"📊 *Статус:* {status_names.get(app['status'], app['status'])}\n"
        f"💰 *Баллы:* {app['total_score']}\n"
        f"📅 *Дата:* {app['created_at'][:10] if app['created_at'] else '-'}\n"
    )

    if app.get("admin_comment"):
        text += f"\n💬 *Комментарий:* {app['admin_comment']}\n"

    text += f"\n📎 *Документы ({len(documents)}):*\n"
    for doc in documents:
        doc_name = doc_type_names.get(doc["document_type"], doc["document_type"])
        doc_status = "✅" if doc["status"] == "accepted" else "⏳" if doc["status"] == "pending" else "❌"
        text += f"  {doc_status} {doc_name}"
        if doc.get("admin_comment"):
            text += f" - {doc['admin_comment']}"
        text += "\n"

    text += f"\n🏆 *Достижения ({len(achievements)}):*\n"
    for ach in achievements:
        name = ScoringSystem.get_achievement_name(ach["achievement_type"])
        text += f"  • {name}: {ach['score']} б.\n"

    await state.update_data(current_app_id=app_id)

    await callback.message.edit_text(
        text,
        parse_mode="Markdown",
        reply_markup=Keyboards.application_actions(app_id)
    )


# ===== ПРОСМОТР ДОКУМЕНТОВ =====

@router.callback_query(F.data.startswith("admin:docs:"))
async def view_documents(callback: CallbackQuery, bot: Bot):
    """Просмотр документов заявки"""
    if callback.from_user.id != ADMIN_ID:
        return

    app_id = int(callback.data.split(":")[2])
    documents = await db.get_application_documents(app_id)

    if not documents:
        await callback.answer("Документы не найдены", show_alert=True)
        return

    await callback.answer("Отправляю документы...")

    for doc in documents:
        doc_type_names = {
            "table": "📊 Таблица достижений",
            "certificate": "🏅 Грамота/Сертификат",
            "recommendation": "📄 Рекомендательное письмо"
        }

        caption = (
            f"*{doc_type_names.get(doc['document_type'], 'Документ')}*\n"
            f"ID: {doc['id']}\n"
        )
        if doc.get("description"):
            caption += f"Описание: {doc['description']}\n"
        if doc.get("admin_comment"):
            caption += f"Замечание: {doc['admin_comment']}"

        try:
            # Пробуем отправить как фото
            await bot.send_photo(
                callback.from_user.id,
                doc["file_id"],
                caption=caption,
                parse_mode="Markdown",
                reply_markup=Keyboards.document_review(doc["id"])
            )
        except Exception:
            # Если не фото - отправляем как документ
            try:
                await bot.send_document(
                    callback.from_user.id,
                    doc["file_id"],
                    caption=caption,
                    parse_mode="Markdown",
                    reply_markup=Keyboards.document_review(doc["id"])
                )
            except Exception as e:
                await bot.send_message(
                    callback.from_user.id,
                    f"❌ Ошибка загрузки документа #{doc['id']}: {e}"
                )


# ===== ОДОБРИТЬ/ОТКЛОНИТЬ ЗАЯВКУ =====

@router.callback_query(F.data.startswith("admin:approve:"))
async def approve_application(callback: CallbackQuery, bot: Bot):
    """Одобрить заявку"""
    if callback.from_user.id != ADMIN_ID:
        return

    app_id = int(callback.data.split(":")[2])

    await db.update_application_status(app_id, "approved")

    # Уведомляем студента
    applications = await db.get_all_applications()
    app = next((a for a in applications if a["id"] == app_id), None)

    if app:
        # Получаем telegram_id студента
        students = await db.get_all_students()
        student = next((s for s in students if s["id"] == app["student_id"]), None)

        if student:
            try:
                await bot.send_message(
                    student["telegram_id"],
                    f"✅ *Ваша заявка №{app_id} одобрена!*\n\n"
                    f"Итоговый балл: *{app['total_score']}*\n\n"
                    f"Поздравляем!",
                    parse_mode="Markdown"
                )
            except Exception:
                pass

    await callback.answer("✅ Заявка одобрена!", show_alert=True)
    await callback.message.edit_text(
        callback.message.text + "\n\n✅ *ОДОБРЕНО*",
        parse_mode="Markdown"
    )


@router.callback_query(F.data.startswith("admin:reject:"))
async def reject_application(callback: CallbackQuery, state: FSMContext):
    """Отклонить заявку"""
    if callback.from_user.id != ADMIN_ID:
        return

    app_id = int(callback.data.split(":")[2])
    await state.update_data(reject_app_id=app_id)

    await callback.message.answer(
        "❌ Введите причину отклонения заявки:",
        reply_markup=Keyboards.cancel_button()
    )
    await state.set_state(AdminStates.adding_comment)


@router.message(AdminStates.adding_comment)
async def process_rejection(message: Message, state: FSMContext, bot: Bot):
    """Обработка отклонения"""
    if message.text == "❌ Отмена":
        await state.clear()
        await message.answer(
            "Отменено.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    data = await state.get_data()
    app_id = data.get("reject_app_id")

    if not app_id:
        await state.clear()
        return

    comment = message.text.strip()
    await db.update_application_status(app_id, "rejected", comment)

    # Уведомляем студента
    applications = await db.get_all_applications()
    app = next((a for a in applications if a["id"] == app_id), None)

    if app:
        students = await db.get_all_students()
        student = next((s for s in students if s["id"] == app["student_id"]), None)

        if student:
            try:
                await bot.send_message(
                    student["telegram_id"],
                    f"❌ *Ваша заявка №{app_id} отклонена*\n\n"
                    f"Причина: {comment}\n\n"
                    f"Вы можете подать новую заявку после исправления замечаний.",
                    parse_mode="Markdown"
                )
            except Exception:
                pass

    await state.clear()
    await message.answer(
        f"❌ Заявка №{app_id} отклонена.\n"
        f"Причина: {comment}",
        reply_markup=Keyboards.admin_main_menu()
    )


# ===== КОММЕНТАРИЙ К ЗАЯВКЕ =====

@router.callback_query(F.data.startswith("admin:comment:"))
async def add_comment(callback: CallbackQuery, state: FSMContext):
    """Добавить комментарий"""
    if callback.from_user.id != ADMIN_ID:
        return

    app_id = int(callback.data.split(":")[2])
    await state.update_data(comment_app_id=app_id)

    await callback.message.answer(
        "💬 Введите комментарий к заявке:",
        reply_markup=Keyboards.cancel_button()
    )
    await state.set_state(AdminStates.adding_note)


@router.message(AdminStates.adding_note)
async def process_comment(message: Message, state: FSMContext):
    """Обработка комментария"""
    if message.text == "❌ Отмена":
        await state.clear()
        await message.answer(
            "Отменено.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    data = await state.get_data()
    app_id = data.get("comment_app_id")

    if not app_id:
        await state.clear()
        return

    comment = message.text.strip()
    await db.update_application_status(app_id, "in_review", comment)

    await state.clear()
    await message.answer(
        f"💬 Комментарий добавлен к заявке №{app_id}.",
        reply_markup=Keyboards.admin_main_menu()
    )


# ===== НАПИСАТЬ СТУДЕНТУ =====

@router.callback_query(F.data.startswith("admin:message:"))
async def message_student(callback: CallbackQuery, state: FSMContext):
    """Написать студенту"""
    if callback.from_user.id != ADMIN_ID:
        return

    app_id = int(callback.data.split(":")[2])
    await state.update_data(message_app_id=app_id)

    await callback.message.answer(
        "📨 Введите сообщение для студента:",
        reply_markup=Keyboards.cancel_button()
    )
    await state.set_state(AdminStates.messaging_student)


@router.message(AdminStates.messaging_student)
async def send_to_student(message: Message, state: FSMContext, bot: Bot):
    """Отправка сообщения студенту"""
    if message.text == "❌ Отмена":
        await state.clear()
        await message.answer(
            "Отменено.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    data = await state.get_data()
    app_id = data.get("message_app_id")

    if not app_id:
        await state.clear()
        return

    # Находим студента
    applications = await db.get_all_applications()
    app = next((a for a in applications if a["id"] == app_id), None)

    if not app:
        await state.clear()
        await message.answer(
            "Заявка не найдена.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    students = await db.get_all_students()
    student = next((s for s in students if s["id"] == app["student_id"]), None)

    if not student:
        await state.clear()
        await message.answer(
            "Студент не найден.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    try:
        await bot.send_message(
            student["telegram_id"],
            f"📨 *Сообщение от администратора*\n\n"
            f"По заявке №{app_id}:\n\n"
            f"{message.text}",
            parse_mode="Markdown"
        )

        # Сохраняем в историю
        await db.save_message(
            student_id=student["id"],
            message_text=message.text,
            message_type="text",
            direction="outgoing"
        )

        await message.answer(
            "✅ Сообщение отправлено студенту.",
            reply_markup=Keyboards.admin_main_menu()
        )
    except Exception as e:
        await message.answer(
            f"❌ Ошибка отправки: {e}",
            reply_markup=Keyboards.admin_main_menu()
        )

    await state.clear()


# ===== РЕЦЕНЗИРОВАНИЕ ДОКУМЕНТОВ =====

@router.callback_query(F.data.startswith("doc:accept:"))
async def accept_document(callback: CallbackQuery):
    """Принять документ"""
    if callback.from_user.id != ADMIN_ID:
        return

    doc_id = int(callback.data.split(":")[2])
    await db.update_document_status(doc_id, "accepted")
    await callback.answer("✅ Документ принят", show_alert=True)


@router.callback_query(F.data.startswith("doc:reject:"))
async def reject_document(callback: CallbackQuery):
    """Отклонить документ"""
    if callback.from_user.id != ADMIN_ID:
        return

    doc_id = int(callback.data.split(":")[2])
    await db.update_document_status(doc_id, "rejected")
    await callback.answer("❌ Документ отклонён", show_alert=True)


@router.callback_query(F.data.startswith("doc:note:"))
async def note_document(callback: CallbackQuery, state: FSMContext):
    """Добавить замечание к документу"""
    if callback.from_user.id != ADMIN_ID:
        return

    doc_id = int(callback.data.split(":")[2])
    await state.update_data(note_doc_id=doc_id)

    await callback.message.answer(
        "⚠️ Введите замечание к документу:\n\n"
        "(ошибки, несоответствия теме, проблемы с оформлением и т.д.)",
        reply_markup=Keyboards.cancel_button()
    )
    await state.set_state(AdminStates.adding_note)


@router.callback_query(F.data.startswith("doc:score:"))
async def score_document(callback: CallbackQuery, state: FSMContext):
    """Указать баллы за документ"""
    if callback.from_user.id != ADMIN_ID:
        return

    doc_id = int(callback.data.split(":")[2])
    await state.update_data(score_doc_id=doc_id)

    await callback.message.answer(
        "🔢 Введите количество баллов за этот документ:",
        reply_markup=Keyboards.cancel_button()
    )
    await state.set_state(AdminStates.setting_score)


@router.message(AdminStates.setting_score)
async def process_score(message: Message, state: FSMContext):
    """Обработка баллов"""
    if message.text == "❌ Отмена":
        await state.clear()
        await message.answer(
            "Отменено.",
            reply_markup=Keyboards.admin_main_menu()
        )
        return

    try:
        score = int(message.text.strip())
    except ValueError:
        await message.answer("Введите число!")
        return

    data = await state.get_data()
    doc_id = data.get("score_doc_id")

    if not doc_id:
        await state.clear()
        return

    await db.update_document_status(doc_id, "accepted", score=score)

    await state.clear()
    await message.answer(
        f"✅ Документу #{doc_id} присвоено {score} баллов.",
        reply_markup=Keyboards.admin_main_menu()
    )


# ===== ПРОСМОТР СТУДЕНТА =====

@router.callback_query(F.data.startswith("student:"))
async def view_student(callback: CallbackQuery, bot: Bot):
    """Просмотр информации о студенте"""
    if callback.from_user.id != ADMIN_ID:
        return

    student_id = int(callback.data.split(":")[1])
    students = await db.get_all_students()
    student = next((s for s in students if s["id"] == student_id), None)

    if not student:
        await callback.answer("Студент не найден", show_alert=True)
        return

    # Получаем заявки студента
    applications = await db.get_student_applications(student_id)

    # Получаем историю сообщений
    messages = await db.get_student_messages(student_id, limit=10)

    status_names = {
        "pending": "⏳ На рассмотрении",
        "in_review": "🔍 Рассматривается",
        "approved": "✅ Одобрена",
        "rejected": "❌ Отклонена"
    }

    text = (
        f"👤 *Студент:* {student['full_name']}\n"
        f"🆔 Telegram: @{student.get('username', '-')}\n"
        f"📅 Регистрация: {student['registered_at'][:10] if student['registered_at'] else '-'}\n\n"
    )

    text += f"📋 *Заявки ({len(applications)}):*\n"
    for app in applications:
        status = status_names.get(app["status"], app["status"])
        text += f"  • №{app['id']}: {status}, {app['total_score']} б.\n"

    text += f"\n💬 *Последние сообщения ({len(messages)}):*\n"
    for msg in messages[:5]:
        direction = "→" if msg["direction"] == "outgoing" else "←"
        msg_text = (msg.get("message_text") or "[файл]")[:30]
        text += f"  {direction} {msg_text}...\n"

    await callback.message.edit_text(
        text,
        parse_mode="Markdown"
    )


# ===== НАЗАД К СПИСКУ =====

@router.callback_query(F.data == "admin:back_list")
async def back_to_list(callback: CallbackQuery, state: FSMContext):
    """Вернуться к списку заявок"""
    if callback.from_user.id != ADMIN_ID:
        return

    data = await state.get_data()
    applications = data.get("applications_list", [])

    if not applications:
        applications = await db.get_all_applications()
        await state.update_data(applications_list=applications)

    await callback.message.edit_text(
        f"📋 *Заявки ({len(applications)}):*",
        parse_mode="Markdown",
        reply_markup=Keyboards.applications_list(applications)
    )
