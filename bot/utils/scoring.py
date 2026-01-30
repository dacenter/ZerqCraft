"""
Система расчёта баллов для повышенной государственной академической стипендии
СГТУ имени Гагарина Ю.А.

Виды стипендий:
- Научная деятельность
- Спортивные достижения
- Творческая деятельность
- Общественная деятельность
"""

# Баллы за научную деятельность
SCIENTIFIC_SCORES = {
    # Публикации
    "publication_scopus_wos": 50,           # Публикация в Scopus/Web of Science
    "publication_vak": 35,                  # Публикация в журнале ВАК
    "publication_rinc": 20,                 # Публикация РИНЦ
    "publication_other": 10,                # Иная научная публикация

    # Конференции - международный уровень
    "conf_international_winner_1": 50,      # 1 место международная конференция
    "conf_international_winner_2": 40,      # 2 место
    "conf_international_winner_3": 30,      # 3 место
    "conf_international_participant": 15,   # Участник международной конференции

    # Конференции - всероссийский уровень
    "conf_national_winner_1": 40,           # 1 место всероссийская
    "conf_national_winner_2": 30,           # 2 место
    "conf_national_winner_3": 20,           # 3 место
    "conf_national_participant": 10,        # Участник

    # Конференции - региональный/вузовский уровень
    "conf_regional_winner_1": 20,           # 1 место региональная/вузовская
    "conf_regional_winner_2": 15,           # 2 место
    "conf_regional_winner_3": 10,           # 3 место
    "conf_regional_participant": 5,         # Участник

    # Гранты и патенты
    "grant_winner": 50,                     # Победитель гранта
    "grant_participant": 25,                # Участник гранта
    "patent": 50,                           # Патент на изобретение
    "software_registration": 30,            # Свидетельство о регистрации программы для ЭВМ

    # Олимпиады - международный уровень
    "olympiad_international_winner_1": 50,  # 1 место
    "olympiad_international_winner_2": 40,  # 2 место
    "olympiad_international_winner_3": 30,  # 3 место
    "olympiad_international_participant": 15,

    # Олимпиады - всероссийский уровень
    "olympiad_national_winner_1": 40,
    "olympiad_national_winner_2": 30,
    "olympiad_national_winner_3": 20,
    "olympiad_national_participant": 10,

    # Диплом НИР
    "diploma_nir": 25,                      # Диплом за научно-исследовательскую работу
}

# Баллы за спортивные достижения
SPORT_SCORES = {
    # Международный уровень
    "sport_international_1": 50,            # 1 место
    "sport_international_2": 40,            # 2 место
    "sport_international_3": 30,            # 3 место
    "sport_international_participant": 15,  # Участник

    # Всероссийский уровень
    "sport_national_1": 40,
    "sport_national_2": 30,
    "sport_national_3": 20,
    "sport_national_participant": 10,

    # Региональный уровень
    "sport_regional_1": 25,
    "sport_regional_2": 20,
    "sport_regional_3": 15,
    "sport_regional_participant": 5,

    # Вузовский уровень
    "sport_university_1": 15,
    "sport_university_2": 10,
    "sport_university_3": 5,

    # Разряды и звания
    "sport_master": 50,                     # Мастер спорта
    "sport_candidate": 30,                  # КМС
    "sport_rank_1": 15,                     # 1 разряд
}

# Баллы за творческую деятельность
CREATIVE_SCORES = {
    # Международный уровень
    "creative_international_1": 50,
    "creative_international_2": 40,
    "creative_international_3": 30,
    "creative_international_participant": 15,

    # Всероссийский уровень
    "creative_national_1": 40,
    "creative_national_2": 30,
    "creative_national_3": 20,
    "creative_national_participant": 10,

    # Региональный уровень
    "creative_regional_1": 25,
    "creative_regional_2": 20,
    "creative_regional_3": 15,
    "creative_regional_participant": 5,

    # Вузовский уровень
    "creative_university_1": 15,
    "creative_university_2": 10,
    "creative_university_3": 5,
    "creative_university_participant": 3,
}

# Баллы за общественную деятельность
PUBLIC_SCORES = {
    # Волонтёрство
    "volunteer_organizer": 25,              # Организатор волонтёрской деятельности
    "volunteer_participant": 10,            # Участник волонтёрства

    # Студенческие организации
    "student_council_leader": 30,           # Руководитель студенческого совета
    "student_council_member": 15,           # Член студенческого совета

    # Мероприятия
    "event_organizer_international": 35,    # Организатор международного мероприятия
    "event_organizer_national": 25,         # Организатор всероссийского мероприятия
    "event_organizer_regional": 15,         # Организатор регионального мероприятия
    "event_organizer_university": 10,       # Организатор вузовского мероприятия

    # Награды
    "gratitude_rector": 20,                 # Благодарность ректора
    "gratitude_dean": 10,                   # Благодарность декана/директора
    "honor_board": 15,                      # Доска почёта

    # Киберспорт (по примеру из анкеты)
    "esport_international_1": 40,
    "esport_international_2": 30,
    "esport_international_3": 20,
    "esport_national_1": 30,
    "esport_national_2": 20,
    "esport_national_3": 15,
    "esport_regional_1": 15,
    "esport_regional_2": 10,
    "esport_regional_3": 5,
}

# Объединённый словарь всех баллов
ALL_SCORES = {
    "scientific": SCIENTIFIC_SCORES,
    "sport": SPORT_SCORES,
    "creative": CREATIVE_SCORES,
    "public": PUBLIC_SCORES,
}

# Читаемые названия достижений
ACHIEVEMENT_NAMES = {
    # Научная деятельность
    "publication_scopus_wos": "Публикация Scopus/WoS",
    "publication_vak": "Публикация ВАК",
    "publication_rinc": "Публикация РИНЦ",
    "publication_other": "Иная публикация",
    "conf_international_winner_1": "1 место межд. конференция",
    "conf_international_winner_2": "2 место межд. конференция",
    "conf_international_winner_3": "3 место межд. конференция",
    "conf_international_participant": "Участник межд. конференции",
    "conf_national_winner_1": "1 место всеросс. конференция",
    "conf_national_winner_2": "2 место всеросс. конференция",
    "conf_national_winner_3": "3 место всеросс. конференция",
    "conf_national_participant": "Участник всеросс. конференции",
    "conf_regional_winner_1": "1 место рег./вуз. конференция",
    "conf_regional_winner_2": "2 место рег./вуз. конференция",
    "conf_regional_winner_3": "3 место рег./вуз. конференция",
    "conf_regional_participant": "Участник рег./вуз. конференции",
    "grant_winner": "Победитель гранта",
    "grant_participant": "Участник гранта",
    "patent": "Патент на изобретение",
    "software_registration": "Регистрация программы для ЭВМ",
    "olympiad_international_winner_1": "1 место межд. олимпиада",
    "olympiad_international_winner_2": "2 место межд. олимпиада",
    "olympiad_international_winner_3": "3 место межд. олимпиада",
    "olympiad_international_participant": "Участник межд. олимпиады",
    "olympiad_national_winner_1": "1 место всеросс. олимпиада",
    "olympiad_national_winner_2": "2 место всеросс. олимпиада",
    "olympiad_national_winner_3": "3 место всеросс. олимпиада",
    "olympiad_national_participant": "Участник всеросс. олимпиады",
    "diploma_nir": "Диплом за НИР",

    # Спорт
    "sport_international_1": "1 место межд. соревнования",
    "sport_international_2": "2 место межд. соревнования",
    "sport_international_3": "3 место межд. соревнования",
    "sport_international_participant": "Участник межд. соревнований",
    "sport_national_1": "1 место всеросс. соревнования",
    "sport_national_2": "2 место всеросс. соревнования",
    "sport_national_3": "3 место всеросс. соревнования",
    "sport_national_participant": "Участник всеросс. соревнований",
    "sport_regional_1": "1 место рег. соревнования",
    "sport_regional_2": "2 место рег. соревнования",
    "sport_regional_3": "3 место рег. соревнования",
    "sport_regional_participant": "Участник рег. соревнований",
    "sport_university_1": "1 место вуз. соревнования",
    "sport_university_2": "2 место вуз. соревнования",
    "sport_university_3": "3 место вуз. соревнования",
    "sport_master": "Мастер спорта",
    "sport_candidate": "КМС",
    "sport_rank_1": "1 спортивный разряд",

    # Творчество
    "creative_international_1": "1 место межд. творч. конкурс",
    "creative_international_2": "2 место межд. творч. конкурс",
    "creative_international_3": "3 место межд. творч. конкурс",
    "creative_international_participant": "Участник межд. творч. конкурса",
    "creative_national_1": "1 место всеросс. творч. конкурс",
    "creative_national_2": "2 место всеросс. творч. конкурс",
    "creative_national_3": "3 место всеросс. творч. конкурс",
    "creative_national_participant": "Участник всеросс. творч. конкурса",
    "creative_regional_1": "1 место рег. творч. конкурс",
    "creative_regional_2": "2 место рег. творч. конкурс",
    "creative_regional_3": "3 место рег. творч. конкурс",
    "creative_regional_participant": "Участник рег. творч. конкурса",
    "creative_university_1": "1 место вуз. творч. конкурс",
    "creative_university_2": "2 место вуз. творч. конкурс",
    "creative_university_3": "3 место вуз. творч. конкурс",
    "creative_university_participant": "Участник вуз. творч. конкурса",

    # Общественная деятельность
    "volunteer_organizer": "Организатор волонтёрства",
    "volunteer_participant": "Волонтёр",
    "student_council_leader": "Руководитель студ. совета",
    "student_council_member": "Член студ. совета",
    "event_organizer_international": "Организатор межд. мероприятия",
    "event_organizer_national": "Организатор всеросс. мероприятия",
    "event_organizer_regional": "Организатор рег. мероприятия",
    "event_organizer_university": "Организатор вуз. мероприятия",
    "gratitude_rector": "Благодарность ректора",
    "gratitude_dean": "Благодарность декана",
    "honor_board": "Доска почёта",
    "esport_international_1": "1 место межд. киберспорт",
    "esport_international_2": "2 место межд. киберспорт",
    "esport_international_3": "3 место межд. киберспорт",
    "esport_national_1": "1 место всеросс. киберспорт",
    "esport_national_2": "2 место всеросс. киберспорт",
    "esport_national_3": "3 место всеросс. киберспорт",
    "esport_regional_1": "1 место рег. киберспорт",
    "esport_regional_2": "2 место рег. киберспорт",
    "esport_regional_3": "3 место рег. киберспорт",
}


class ScoringSystem:
    """Система расчёта баллов для стипендии"""

    @staticmethod
    def get_score(scholarship_type: str, achievement_type: str) -> int:
        """Получить баллы за достижение"""
        scores = ALL_SCORES.get(scholarship_type, {})
        return scores.get(achievement_type, 0)

    @staticmethod
    def get_achievement_name(achievement_type: str) -> str:
        """Получить читаемое название достижения"""
        return ACHIEVEMENT_NAMES.get(achievement_type, achievement_type)

    @staticmethod
    def get_achievements_for_type(scholarship_type: str) -> dict:
        """Получить все достижения для типа стипендии"""
        return ALL_SCORES.get(scholarship_type, {})

    @staticmethod
    def calculate_total(achievements: list) -> int:
        """Подсчитать общий балл по списку достижений"""
        return sum(a.get("score", 0) for a in achievements)

    @staticmethod
    def format_scoring_table(scholarship_type: str) -> str:
        """Форматировать таблицу баллов для вывода"""
        scores = ALL_SCORES.get(scholarship_type, {})
        if not scores:
            return "Тип стипендии не найден"

        lines = ["📊 *Таблица баллов:*\n"]

        for key, score in scores.items():
            name = ACHIEVEMENT_NAMES.get(key, key)
            lines.append(f"• {name}: *{score}* баллов")

        return "\n".join(lines)

    @staticmethod
    def get_scholarship_types() -> dict:
        """Получить типы стипендий"""
        return {
            "scientific": "🔬 Научная деятельность",
            "sport": "🏆 Спортивные достижения",
            "creative": "🎨 Творческая деятельность",
            "public": "👥 Общественная деятельность",
        }
