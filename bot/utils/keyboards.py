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
            KeyboardButton(text="📝 Новая заявка"),
            KeyboardButton(text="📋 Мои заявки"),
        )
        builder.row(
            KeyboardButton(text="📊 Таблица баллов"),
            KeyboardButton(text="❓ Помощь"),
        )
        return builder.as_markup(resize_keyboard=True)

    @staticmethod
    def scholarship_types() -> InlineKeyboardMarkup:
        """Выбор типа стипендии"""
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(
                text="🔬 Научная деятельность",
                callback_data="scholarship:scientific"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="🏆 Спортивные достижения",
                callback_data="scholarship:sport"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="🎨 Творческая деятельность",
                callback_data="scholarship:creative"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="👥 Общественная деятельность",
                callback_data="scholarship:public"
            )
        )
        return builder.as_markup()

    @staticmethod
    def document_types() -> InlineKeyboardMarkup:
        """Выбор типа документа"""
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(
                text="📊 Таблица достижений",
                callback_data="doc_type:table"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="🏅 Грамота/Сертификат/Диплом",
                callback_data="doc_type:certificate"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="📄 Рекомендательное письмо",
                callback_data="doc_type:recommendation"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="✅ Завершить загрузку",
                callback_data="doc_type:finish"
            )
        )
        return builder.as_markup()

    @staticmethod
    def confirm_action(action: str) -> InlineKeyboardMarkup:
        """Подтверждение действия"""
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(text="✅ Да", callback_data=f"confirm:{action}:yes"),
            InlineKeyboardButton(text="❌ Нет", callback_data=f"confirm:{action}:no"),
        )
        return builder.as_markup()

    @staticmethod
    def back_button() -> InlineKeyboardMarkup:
        """Кнопка назад"""
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(text="◀️ Назад", callback_data="back")
        )
        return builder.as_markup()

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
                text="💬 Комментарий",
                callback_data=f"admin:comment:{app_id}"
            )
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
    def document_review(doc_id: int) -> InlineKeyboardMarkup:
        """Рецензирование документа"""
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(
                text="✅ Принять",
                callback_data=f"doc:accept:{doc_id}"
            ),
            InlineKeyboardButton(
                text="❌ Отклонить",
                callback_data=f"doc:reject:{doc_id}"
            ),
        )
        builder.row(
            InlineKeyboardButton(
                text="⚠️ Замечание",
                callback_data=f"doc:note:{doc_id}"
            )
        )
        builder.row(
            InlineKeyboardButton(
                text="🔢 Указать баллы",
                callback_data=f"doc:score:{doc_id}"
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

    @staticmethod
    def achievement_selector(scholarship_type: str, page: int = 0) -> InlineKeyboardMarkup:
        """Выбор достижения для добавления баллов"""
        from .scoring import ALL_SCORES, ACHIEVEMENT_NAMES

        builder = InlineKeyboardBuilder()
        scores = ALL_SCORES.get(scholarship_type, {})
        items = list(scores.items())

        per_page = 8
        start = page * per_page
        end = start + per_page
        page_items = items[start:end]

        for key, score in page_items:
            name = ACHIEVEMENT_NAMES.get(key, key)[:25]
            builder.row(
                InlineKeyboardButton(
                    text=f"{name} ({score} б.)",
                    callback_data=f"ach:{key}"
                )
            )

        # Навигация
        nav_buttons = []
        if page > 0:
            nav_buttons.append(
                InlineKeyboardButton(text="◀️", callback_data=f"ach_page:{scholarship_type}:{page - 1}")
            )
        if end < len(items):
            nav_buttons.append(
                InlineKeyboardButton(text="▶️", callback_data=f"ach_page:{scholarship_type}:{page + 1}")
            )

        if nav_buttons:
            builder.row(*nav_buttons)

        builder.row(
            InlineKeyboardButton(text="✅ Готово", callback_data="ach:done")
        )

        return builder.as_markup()
