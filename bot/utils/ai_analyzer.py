"""
AI модуль для анализа документов с использованием Anthropic Claude API
"""
import base64
import json
import logging
import zipfile
import io
import os
from typing import Optional
from pathlib import Path

import anthropic
from pdf2image import convert_from_bytes
from PIL import Image

from bot.config import ANTHROPIC_API_KEY, ANALYSIS_PROMPT

logger = logging.getLogger(__name__)


class DocumentAnalyzer:
    """Анализатор документов с использованием Claude Vision API"""

    def __init__(self):
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not set!")
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.model = "claude-sonnet-4-20250514"

    async def analyze_documents(self, files: list[dict]) -> dict:
        """
        Анализирует документы и возвращает результат

        Args:
            files: список словарей с ключами:
                - 'data': bytes данные файла
                - 'filename': имя файла
                - 'mime_type': MIME тип

        Returns:
            dict с результатом анализа
        """
        try:
            # Подготавливаем изображения для API
            images = await self._prepare_images(files)

            if not images:
                return {
                    "error": "Не удалось обработать документы. Убедитесь, что файлы в правильном формате.",
                    "total_score": 0,
                    "verified_score": 0
                }

            # Формируем контент для API
            content = []

            # Добавляем изображения
            for img in images:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": img["media_type"],
                        "data": img["data"]
                    }
                })

            # Добавляем промпт
            content.append({
                "type": "text",
                "text": ANALYSIS_PROMPT
            })

            # Отправляем запрос
            logger.info(f"Отправка {len(images)} изображений в Claude API...")

            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": content}
                ]
            )

            # Парсим ответ
            result_text = response.content[0].text
            logger.info(f"Получен ответ от Claude API")

            # Извлекаем JSON из ответа
            result = self._extract_json(result_text)

            return result

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            return {
                "error": f"Ошибка API: {str(e)}",
                "total_score": 0,
                "verified_score": 0
            }
        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return {
                "error": f"Ошибка анализа: {str(e)}",
                "total_score": 0,
                "verified_score": 0
            }

    async def _prepare_images(self, files: list[dict]) -> list[dict]:
        """Подготавливает изображения из файлов"""
        images = []

        for file_info in files:
            data = file_info["data"]
            filename = file_info["filename"].lower()
            mime_type = file_info.get("mime_type", "")

            try:
                if filename.endswith(".zip"):
                    # Распаковываем ZIP
                    zip_images = await self._process_zip(data)
                    images.extend(zip_images)

                elif filename.endswith(".pdf"):
                    # Конвертируем PDF в изображения
                    pdf_images = await self._process_pdf(data)
                    images.extend(pdf_images)

                elif any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]):
                    # Обрабатываем изображение
                    img_data = await self._process_image(data, mime_type)
                    if img_data:
                        images.append(img_data)

                elif any(filename.endswith(ext) for ext in [".doc", ".docx"]):
                    # Word документы - пока просто пропускаем с предупреждением
                    logger.warning(f"Word documents not fully supported: {filename}")

            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                continue

        return images

    async def _process_zip(self, data: bytes) -> list[dict]:
        """Обрабатывает ZIP архив"""
        images = []

        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for name in zf.namelist():
                    lower_name = name.lower()

                    # Пропускаем системные файлы Mac
                    if "__macosx" in lower_name or ".ds_store" in lower_name:
                        continue

                    if any(lower_name.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]):
                        file_data = zf.read(name)
                        mime = self._get_mime_type(name)
                        img = await self._process_image(file_data, mime)
                        if img:
                            images.append(img)

                    elif lower_name.endswith(".pdf"):
                        file_data = zf.read(name)
                        pdf_images = await self._process_pdf(file_data)
                        images.extend(pdf_images)

        except Exception as e:
            logger.error(f"ZIP processing error: {e}")

        return images

    async def _process_pdf(self, data: bytes) -> list[dict]:
        """Конвертирует PDF в изображения"""
        images = []

        try:
            # Конвертируем PDF страницы в изображения
            pdf_images = convert_from_bytes(data, dpi=150)

            for i, img in enumerate(pdf_images):
                # Сжимаем если нужно
                img = self._resize_image(img)

                # Конвертируем в base64
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=85)
                img_data = base64.standard_b64encode(buffer.getvalue()).decode("utf-8")

                images.append({
                    "media_type": "image/jpeg",
                    "data": img_data
                })

                # Ограничиваем количество страниц
                if i >= 19:  # Максимум 20 страниц
                    break

        except Exception as e:
            logger.error(f"PDF processing error: {e}")

        return images

    async def _process_image(self, data: bytes, mime_type: str) -> Optional[dict]:
        """Обрабатывает изображение"""
        try:
            img = Image.open(io.BytesIO(data))

            # Конвертируем в RGB если нужно
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            # Сжимаем
            img = self._resize_image(img)

            # Конвертируем в base64
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85)
            img_data = base64.standard_b64encode(buffer.getvalue()).decode("utf-8")

            return {
                "media_type": "image/jpeg",
                "data": img_data
            }

        except Exception as e:
            logger.error(f"Image processing error: {e}")
            return None

    def _resize_image(self, img: Image.Image, max_size: int = 1568) -> Image.Image:
        """Сжимает изображение если оно слишком большое"""
        width, height = img.size

        if width > max_size or height > max_size:
            ratio = min(max_size / width, max_size / height)
            new_size = (int(width * ratio), int(height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        return img

    def _get_mime_type(self, filename: str) -> str:
        """Определяет MIME тип по расширению"""
        ext = filename.lower().split(".")[-1]
        mime_types = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
            "pdf": "application/pdf",
        }
        return mime_types.get(ext, "application/octet-stream")

    def _extract_json(self, text: str) -> dict:
        """Извлекает JSON из ответа"""
        try:
            # Пробуем найти JSON в тексте
            start = text.find("{")
            end = text.rfind("}") + 1

            if start != -1 and end > start:
                json_str = text[start:end]
                return json.loads(json_str)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")

        # Если не удалось извлечь JSON, возвращаем текст как summary
        return {
            "error": "Не удалось распарсить ответ",
            "raw_response": text,
            "total_score": 0,
            "verified_score": 0
        }


def format_analysis_result(result: dict) -> str:
    """Форматирует результат анализа для отображения в Telegram"""

    if "error" in result and result.get("total_score", 0) == 0:
        return f"❌ *Ошибка анализа:*\n{result['error']}"

    lines = ["📊 *РЕЗУЛЬТАТ АНАЛИЗА*\n"]

    # Информация о студенте
    student = result.get("student", {})
    if student:
        lines.append("👤 *Студент:*")
        lines.append(f"   ФИО: {student.get('full_name', 'Не определено')}")
        lines.append(f"   Институт: {student.get('institute', '-')}")
        lines.append(f"   Группа: {student.get('group', '-')}")
        lines.append(f"   Курс: {student.get('course', '-')}")
        lines.append("")

    # Тип стипендии
    sch_type = result.get("scholarship_type", "Не определено")
    lines.append(f"📝 *Тип стипендии:* {sch_type}\n")

    # Достижения
    achievements = result.get("achievements", [])
    if achievements:
        lines.append(f"🏆 *Достижения ({len(achievements)}):*")
        for i, ach in enumerate(achievements, 1):
            status = "✅" if ach.get("document_matches") else "⚠️" if ach.get("has_document") else "❌"
            score = ach.get("score", 0)
            lines.append(f"\n{i}. {status} *{ach.get('name', 'Без названия')}*")
            lines.append(f"   Уровень: {ach.get('level', '-')}")
            lines.append(f"   Результат: {ach.get('result', '-')}")
            lines.append(f"   Баллы: {score}")
            if ach.get("comment"):
                lines.append(f"   ⚠️ {ach['comment']}")
        lines.append("")

    # Баллы
    total = result.get("total_score", 0)
    verified = result.get("verified_score", 0)
    lines.append("💰 *БАЛЛЫ:*")
    lines.append(f"   Заявлено: {total}")
    lines.append(f"   Подтверждено: *{verified}*")
    lines.append("")

    # Проблемы
    issues = result.get("issues", [])
    if issues:
        lines.append("⚠️ *Замечания:*")
        for issue in issues:
            lines.append(f"   • {issue}")
        lines.append("")

    # Резюме
    summary = result.get("summary", "")
    if summary:
        lines.append(f"📋 *Резюме:*\n{summary}")

    return "\n".join(lines)
