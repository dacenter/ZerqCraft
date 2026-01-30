import aiosqlite
import os
from datetime import datetime
from typing import Optional


class Database:
    def __init__(self, db_path: str = "data/scholarship.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

    async def init(self):
        """Инициализация базы данных"""
        async with aiosqlite.connect(self.db_path) as db:
            # Таблица студентов
            await db.execute("""
                CREATE TABLE IF NOT EXISTS students (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    username TEXT,
                    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_blocked INTEGER DEFAULT 0
                )
            """)

            # Таблица заявок на стипендию
            await db.execute("""
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    scholarship_type TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    total_score INTEGER DEFAULT 0,
                    admin_comment TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            """)

            # Таблица документов
            await db.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER NOT NULL,
                    document_type TEXT NOT NULL,
                    file_id TEXT NOT NULL,
                    file_path TEXT,
                    description TEXT,
                    score INTEGER DEFAULT 0,
                    admin_comment TEXT,
                    status TEXT DEFAULT 'pending',
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (application_id) REFERENCES applications(id)
                )
            """)

            # Таблица достижений (для разбалловки)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER NOT NULL,
                    achievement_type TEXT NOT NULL,
                    description TEXT,
                    score INTEGER NOT NULL,
                    document_id INTEGER,
                    FOREIGN KEY (application_id) REFERENCES applications(id),
                    FOREIGN KEY (document_id) REFERENCES documents(id)
                )
            """)

            # Таблица сообщений (для просмотра админом)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    message_text TEXT,
                    file_id TEXT,
                    message_type TEXT DEFAULT 'text',
                    direction TEXT DEFAULT 'incoming',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id)
                )
            """)

            await db.commit()

    # ===== СТУДЕНТЫ =====

    async def add_student(self, telegram_id: int, full_name: str, username: str = None) -> int:
        """Добавить нового студента"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO students (telegram_id, full_name, username) VALUES (?, ?, ?)",
                (telegram_id, full_name, username)
            )
            await db.commit()
            return cursor.lastrowid

    async def get_student_by_telegram_id(self, telegram_id: int) -> Optional[dict]:
        """Получить студента по Telegram ID"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM students WHERE telegram_id = ?",
                (telegram_id,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_all_students(self) -> list:
        """Получить всех студентов"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM students ORDER BY full_name")
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def search_students(self, query: str) -> list:
        """Поиск студентов по ФИО"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM students WHERE full_name LIKE ? ORDER BY full_name",
                (f"%{query}%",)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    # ===== ЗАЯВКИ =====

    async def create_application(self, student_id: int, scholarship_type: str) -> int:
        """Создать новую заявку"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO applications (student_id, scholarship_type) VALUES (?, ?)",
                (student_id, scholarship_type)
            )
            await db.commit()
            return cursor.lastrowid

    async def get_application(self, app_id: int) -> Optional[dict]:
        """Получить заявку по ID"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM applications WHERE id = ?",
                (app_id,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_student_applications(self, student_id: int) -> list:
        """Получить все заявки студента"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM applications WHERE student_id = ? ORDER BY created_at DESC",
                (student_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def get_current_application(self, student_id: int) -> Optional[dict]:
        """Получить текущую (последнюю активную) заявку студента"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT * FROM applications
                   WHERE student_id = ? AND status IN ('pending', 'in_review')
                   ORDER BY created_at DESC LIMIT 1""",
                (student_id,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_all_applications(self, status: str = None) -> list:
        """Получить все заявки (опционально фильтр по статусу)"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if status:
                cursor = await db.execute(
                    """SELECT a.*, s.full_name, s.username
                       FROM applications a
                       JOIN students s ON a.student_id = s.id
                       WHERE a.status = ?
                       ORDER BY a.created_at DESC""",
                    (status,)
                )
            else:
                cursor = await db.execute(
                    """SELECT a.*, s.full_name, s.username
                       FROM applications a
                       JOIN students s ON a.student_id = s.id
                       ORDER BY a.created_at DESC"""
                )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def update_application_status(self, app_id: int, status: str, comment: str = None):
        """Обновить статус заявки"""
        async with aiosqlite.connect(self.db_path) as db:
            if comment:
                await db.execute(
                    """UPDATE applications
                       SET status = ?, admin_comment = ?, updated_at = ?
                       WHERE id = ?""",
                    (status, comment, datetime.now(), app_id)
                )
            else:
                await db.execute(
                    "UPDATE applications SET status = ?, updated_at = ? WHERE id = ?",
                    (status, datetime.now(), app_id)
                )
            await db.commit()

    async def update_application_score(self, app_id: int, score: int):
        """Обновить баллы заявки"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE applications SET total_score = ?, updated_at = ? WHERE id = ?",
                (score, datetime.now(), app_id)
            )
            await db.commit()

    # ===== ДОКУМЕНТЫ =====

    async def add_document(self, application_id: int, document_type: str,
                          file_id: str, file_path: str = None, description: str = None) -> int:
        """Добавить документ"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """INSERT INTO documents
                   (application_id, document_type, file_id, file_path, description)
                   VALUES (?, ?, ?, ?, ?)""",
                (application_id, document_type, file_id, file_path, description)
            )
            await db.commit()
            return cursor.lastrowid

    async def get_application_documents(self, application_id: int) -> list:
        """Получить все документы заявки"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM documents WHERE application_id = ? ORDER BY uploaded_at",
                (application_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def update_document_status(self, doc_id: int, status: str,
                                     score: int = None, comment: str = None):
        """Обновить статус документа"""
        async with aiosqlite.connect(self.db_path) as db:
            if score is not None and comment:
                await db.execute(
                    "UPDATE documents SET status = ?, score = ?, admin_comment = ? WHERE id = ?",
                    (status, score, comment, doc_id)
                )
            elif score is not None:
                await db.execute(
                    "UPDATE documents SET status = ?, score = ? WHERE id = ?",
                    (status, score, doc_id)
                )
            elif comment:
                await db.execute(
                    "UPDATE documents SET status = ?, admin_comment = ? WHERE id = ?",
                    (status, comment, doc_id)
                )
            else:
                await db.execute(
                    "UPDATE documents SET status = ? WHERE id = ?",
                    (status, doc_id)
                )
            await db.commit()

    # ===== ДОСТИЖЕНИЯ =====

    async def add_achievement(self, application_id: int, achievement_type: str,
                             score: int, description: str = None, document_id: int = None) -> int:
        """Добавить достижение"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """INSERT INTO achievements
                   (application_id, achievement_type, score, description, document_id)
                   VALUES (?, ?, ?, ?, ?)""",
                (application_id, achievement_type, score, description, document_id)
            )
            await db.commit()
            return cursor.lastrowid

    async def get_application_achievements(self, application_id: int) -> list:
        """Получить все достижения заявки"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM achievements WHERE application_id = ?",
                (application_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def calculate_total_score(self, application_id: int) -> int:
        """Подсчитать общий балл заявки"""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT SUM(score) as total FROM achievements WHERE application_id = ?",
                (application_id,)
            )
            row = await cursor.fetchone()
            total = row[0] if row and row[0] else 0

            # Обновляем total_score в заявке
            await db.execute(
                "UPDATE applications SET total_score = ? WHERE id = ?",
                (total, application_id)
            )
            await db.commit()
            return total

    # ===== СООБЩЕНИЯ =====

    async def save_message(self, student_id: int, message_text: str = None,
                          file_id: str = None, message_type: str = "text",
                          direction: str = "incoming"):
        """Сохранить сообщение для истории"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO messages
                   (student_id, message_text, file_id, message_type, direction)
                   VALUES (?, ?, ?, ?, ?)""",
                (student_id, message_text, file_id, message_type, direction)
            )
            await db.commit()

    async def get_student_messages(self, student_id: int, limit: int = 50) -> list:
        """Получить историю сообщений студента"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT * FROM messages
                   WHERE student_id = ?
                   ORDER BY created_at DESC LIMIT ?""",
                (student_id, limit)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    # ===== СТАТИСТИКА =====

    async def get_statistics(self) -> dict:
        """Получить общую статистику"""
        async with aiosqlite.connect(self.db_path) as db:
            # Всего студентов
            cursor = await db.execute("SELECT COUNT(*) FROM students")
            total_students = (await cursor.fetchone())[0]

            # Всего заявок
            cursor = await db.execute("SELECT COUNT(*) FROM applications")
            total_applications = (await cursor.fetchone())[0]

            # Заявки по статусам
            cursor = await db.execute(
                """SELECT status, COUNT(*) as count
                   FROM applications GROUP BY status"""
            )
            status_counts = {row[0]: row[1] for row in await cursor.fetchall()}

            # Всего документов
            cursor = await db.execute("SELECT COUNT(*) FROM documents")
            total_documents = (await cursor.fetchone())[0]

            # Средний балл
            cursor = await db.execute(
                "SELECT AVG(total_score) FROM applications WHERE total_score > 0"
            )
            row = await cursor.fetchone()
            avg_score = round(row[0], 1) if row and row[0] else 0

            return {
                "total_students": total_students,
                "total_applications": total_applications,
                "status_counts": status_counts,
                "total_documents": total_documents,
                "avg_score": avg_score,
            }
