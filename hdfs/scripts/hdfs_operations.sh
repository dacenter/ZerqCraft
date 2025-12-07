#!/bin/bash

# ==============================================================================
# HDFS Operations Script для метеоданных
# Демонстрация основных операций с файлами в HDFS
# ==============================================================================

HDFS_CMD="docker exec namenode hdfs dfs"
DATA_DIR="/meteo-data"

echo "=========================================="
echo "HDFS Operations for Weather Data"
echo "=========================================="

# 1. Создание директорий в HDFS
echo -e "\n[1] Создание структуры директорий в HDFS..."
$HDFS_CMD -mkdir -p $DATA_DIR/raw/2024/01
$HDFS_CMD -mkdir -p $DATA_DIR/raw/2024/02
$HDFS_CMD -mkdir -p $DATA_DIR/raw/2024/03
$HDFS_CMD -mkdir -p $DATA_DIR/processed
$HDFS_CMD -mkdir -p $DATA_DIR/analytics
echo "Директории созданы."

# 2. Просмотр структуры директорий
echo -e "\n[2] Просмотр структуры директорий..."
$HDFS_CMD -ls -R $DATA_DIR

# 3. Загрузка файлов в HDFS
echo -e "\n[3] Загрузка sample данных в HDFS..."
$HDFS_CMD -put /sample-data/weather_stations.csv $DATA_DIR/raw/
$HDFS_CMD -put /sample-data/weather_data_2024_01.csv $DATA_DIR/raw/2024/01/
$HDFS_CMD -put /sample-data/weather_data_2024_02.csv $DATA_DIR/raw/2024/02/
echo "Файлы загружены."

# 4. Просмотр содержимого файла
echo -e "\n[4] Просмотр первых строк файла weather_stations.csv..."
$HDFS_CMD -head $DATA_DIR/raw/weather_stations.csv

# 5. Проверка размера файлов
echo -e "\n[5] Размер файлов в HDFS..."
$HDFS_CMD -du -h $DATA_DIR/raw/

# 6. Подсчёт строк в файле (через cat и wc)
echo -e "\n[6] Количество записей в weather_data_2024_01.csv..."
$HDFS_CMD -cat $DATA_DIR/raw/2024/01/weather_data_2024_01.csv | wc -l

# 7. Копирование файлов внутри HDFS
echo -e "\n[7] Копирование файла внутри HDFS..."
$HDFS_CMD -cp $DATA_DIR/raw/weather_stations.csv $DATA_DIR/processed/stations_backup.csv
echo "Файл скопирован."

# 8. Перемещение файлов
echo -e "\n[8] Демонстрация перемещения файлов..."
$HDFS_CMD -mv $DATA_DIR/processed/stations_backup.csv $DATA_DIR/analytics/stations_backup.csv
echo "Файл перемещён."

# 9. Изменение фактора репликации
echo -e "\n[9] Изменение фактора репликации..."
$HDFS_CMD -setrep -w 3 $DATA_DIR/raw/weather_stations.csv
echo "Фактор репликации изменён на 3."

# 10. Информация о файле
echo -e "\n[10] Детальная информация о файле..."
$HDFS_CMD -stat "%b %o %r %n" $DATA_DIR/raw/weather_stations.csv

# 11. Проверка целостности файловой системы
echo -e "\n[11] Проверка целостности HDFS..."
docker exec namenode hdfs fsck $DATA_DIR -files -blocks

# 12. Общая статистика HDFS
echo -e "\n[12] Общая статистика HDFS..."
$HDFS_CMD -df -h

# 13. Удаление файлов (демонстрация)
echo -e "\n[13] Удаление временного файла..."
$HDFS_CMD -rm $DATA_DIR/analytics/stations_backup.csv
echo "Файл удалён."

# 14. Очистка корзины
echo -e "\n[14] Очистка корзины HDFS..."
$HDFS_CMD -expunge
echo "Корзина очищена."

echo -e "\n=========================================="
echo "Все операции HDFS выполнены успешно!"
echo "=========================================="
