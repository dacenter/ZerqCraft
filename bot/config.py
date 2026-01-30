import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0"))

# Список разрешённых студентов (ФИО)
ALLOWED_STUDENTS = [
    "Коншенко Александр Сергеевич",
    "Кумова Светлана Валентиновна",
    "Каликинская Елена Юрьевна",
    "Гаспарян Эдик Арамович",
    "Геращенко Анастасия Андреевна",
]

# Типы стипендий
SCHOLARSHIP_TYPES = {
    "academic": "Повышенная академическая стипендия",
    "social": "Социальная стипендия",
    "scientific": "За научную деятельность",
    "sport": "За спортивные достижения",
    "creative": "За творческую деятельность",
    "public": "За общественную деятельность",
}

# Типы документов
DOCUMENT_TYPES = {
    "table": "Таблица с достижениями",
    "certificate": "Грамота/Сертификат",
    "recommendation": "Рекомендательное письмо",
}

# Баллы за достижения
SCORING_RULES = {
    # Академические достижения
    "excellent_grades": 10,  # Отличная учёба
    "good_grades": 5,  # Хорошая учёба

    # Научная деятельность
    "publication_scopus": 50,  # Публикация в Scopus/WoS
    "publication_vak": 30,  # Публикация ВАК
    "publication_rinc": 15,  # Публикация РИНЦ
    "conference_international": 20,  # Международная конференция
    "conference_national": 15,  # Всероссийская конференция
    "conference_regional": 10,  # Региональная конференция
    "grant_winner": 40,  # Победитель гранта
    "grant_participant": 20,  # Участник гранта

    # Спортивные достижения
    "sport_international_1": 50,  # 1 место международные
    "sport_international_2": 40,  # 2 место международные
    "sport_international_3": 30,  # 3 место международные
    "sport_national_1": 40,  # 1 место всероссийские
    "sport_national_2": 30,  # 2 место всероссийские
    "sport_national_3": 20,  # 3 место всероссийские
    "sport_regional_1": 20,  # 1 место региональные
    "sport_regional_2": 15,  # 2 место региональные
    "sport_regional_3": 10,  # 3 место региональные

    # Творческая деятельность
    "creative_international": 30,  # Международный уровень
    "creative_national": 20,  # Всероссийский уровень
    "creative_regional": 10,  # Региональный уровень

    # Общественная деятельность
    "volunteer_organizer": 20,  # Организатор волонтёрства
    "volunteer_participant": 10,  # Участник волонтёрства
    "student_council": 15,  # Студенческий совет
    "event_organizer": 15,  # Организатор мероприятий
}

# Путь к папке с документами
DOCUMENTS_PATH = "data/documents"
