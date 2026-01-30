from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder


class Keyboards:
    """Клавиатуры для бота"""

    # ===== СТУДЕНТСКИЕ КЛАВИАТУРЫ =====

    @staticmethod
    def main_menu() -> ReplyKeyboardMarkup:
        """Главное меню студента"""
        builder = ReplyKeyboardBuilder()
        builder.row(
            KeyboardButton(text="📎 Отправить документы"),
        )
        builder.row(
            KeyboardButton(text="📋 Мои заявки"),
            KeyboardButton(text="❓ Помощь"),
        )
        return builder.as_markup(resize_keyboard=True)

    @staticmethod
    def document_upload() -> ReplyKeyboardMarkup:
        """Меню загрузки документов"""
        builder = ReplyKeyboardBuilder()
        builder.row(
            KeyboardButton(text="✅ Готово - Анализировать"),
        )
        builder.row(
            KeyboardButton(text="❌ Отмена"),
        )
        return builder.as_markup(resize_keyboard=True)

    @staticmethod
    def cancel_button() -> ReplyKeyboardMarkup:
        """Кнопка отмены"""
        builder = ReplyKeyboardBuilder()
        builder.row(KeyboardButton(text="❌ Отмена"))
        return builder.as_markup(resize_keyboard=True)

    # ===== АДМИНСКИЕ КЛАВИАТУРЫ =====

    @staticmethod
    def admin_main_menu() -> ReplyKeyboardMarkup:
        """Главное меню админа"""
        builder = ReplyKeyboardBuilder()
        builder.row(
            KeyboardButton(text="📊 Статистика"),
            KeyboardButton(text="📋 Все заявки"),
        )
        builder.row(
            KeyboardButton(text="👥 Студенты"),
            KeyboardButton(text="🔍 Поиск"),
        )
        builder.row(
            KeyboardButton(text="⏳ На рассмотрении"),
            KeyboardButton(text="✅ Одобренные"),
        )
        builder.row(
            KeyboardButton(text="❌ Отклонённые"),
            KeyboardButton(text="📤 Экспорт"),
        )
        return builder.as_markup(resize_keyboard=True)

    @staticmethod
    def application_actions(app_id: int) -> InlineKeyboardMarkup:
        """Действия с заявкой"""
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(
                text="📄 Документы",
                callback_data=f"admin:docs:{app_id}"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="🔄 Повторный анализ",
                callback_data=f"admin:reanalyze:{app_id}"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="✅ Одобрить",
                callback_data=f"admin:approve:{app_id}"
            ),
            InlineKeyboardButton(
                text="❌ Отклонить",
                callback_data=f"admin:reject:{app_id}"
            ),
        )
        builder.row(
            InlineKeyboardButton(
                text="📨 Написать студенту",
                callback_data=f"admin:message:{app_id}"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="◀️ Назад к списку",
                callback_data="admin:back_list"
            )
        )
        return builder.as_markup()

    @staticmethod
    def student_list(students: list, page: int = 0, per_page: int = 5) -> InlineKeyboardMarkup:
        """Список студентов с пагинацией"""
        builder = InlineKeyboardBuilder()

        start = page * per_page
        end = start + per_page
        page_students = students[start:end]

        for student in page_students:
            builder.row(
                InlineKeyboardButton(
                    text=f"👤 {student['full_name']}",
                    callback_data=f"student:{student['id']}"
                )
            )

        # Навигация
        nav_buttons = []
        if page > 0:
            nav_buttons.append(
                InlineKeyboardButton(text="◀️", callback_data=f"students_page:{page - 1}")
            )
        if end < len(students):
            nav_buttons.append(
                InlineKeyboardButton(text="▶️", callback_data=f"students_page:{page + 1}")
            )

        if nav_buttons:
            builder.row(*nav_buttons)

        return builder.as_markup()

    @staticmethod
    def applications_list(applications: list, page: int = 0, per_page: int = 5) -> InlineKeyboardMarkup:
        """Список заявок с пагинацией"""
        builder = InlineKeyboardBuilder()

        start = page * per_page
        end = start + per_page
        page_apps = applications[start:end]

        status_emoji = {
            "pending": "⏳",
            "in_review": "🔍",
            "approved": "✅",
            "rejected": "❌",
        }

        for app in page_apps:
            emoji = status_emoji.get(app.get("status", "pending"), "📋")
            name = app.get("full_name", "Неизвестно")[:20]
            score = app.get("total_score", 0)
            builder.row(
                InlineKeyboardButton(
                    text=f"{emoji} {name} ({score} б.)",
                    callback_data=f"app:{app['id']}"
                )
            )

        # Навигация
        nav_buttons = []
        if page > 0:
            nav_buttons.append(
                InlineKeyboardButton(text="◀️", callback_data=f"apps_page:{page - 1}")
            )
        if end < len(applications):
            nav_buttons.append(
                InlineKeyboardButton(text="▶️", callback_data=f"apps_page:{page + 1}")
            )

        if nav_buttons:
            builder.row(*nav_buttons)

        return builder.as_markup()
