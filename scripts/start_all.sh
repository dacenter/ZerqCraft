#!/bin/bash

# ==============================================================================
# Скрипт запуска всей инфраструктуры Big Data ландшафта
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Starting MeteoData Big Data Landscape"
echo "=========================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Определение команды docker-compose
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# 1. Запуск Hadoop кластера
echo ""
echo "--- Starting Hadoop Cluster ---"
cd "$PROJECT_ROOT/hadoop"
$DOCKER_COMPOSE up -d
print_status "Hadoop cluster started"

# Ожидание готовности HDFS
echo "Waiting for HDFS to be ready..."
sleep 30

# 2. Запуск Kafka
echo ""
echo "--- Starting Kafka Cluster ---"
cd "$PROJECT_ROOT/kafka"
$DOCKER_COMPOSE up -d
print_status "Kafka cluster started"

# Ожидание готовности Kafka
echo "Waiting for Kafka to be ready..."
sleep 20

# 3. Создание Kafka топиков
echo ""
echo "--- Creating Kafka Topics ---"
if [ -f "$PROJECT_ROOT/kafka/scripts/create_topics.sh" ]; then
    bash "$PROJECT_ROOT/kafka/scripts/create_topics.sh" || print_warning "Topic creation skipped"
fi

# 4. Запуск NoSQL (InfluxDB)
echo ""
echo "--- Starting InfluxDB ---"
cd "$PROJECT_ROOT/nosql"
$DOCKER_COMPOSE up -d
print_status "InfluxDB started"

# 5. Загрузка данных в HDFS
echo ""
echo "--- Loading sample data to HDFS ---"
if [ -f "$PROJECT_ROOT/hdfs/scripts/hdfs_operations.sh" ]; then
    # Копируем sample data в контейнер
    docker cp "$PROJECT_ROOT/hdfs/sample-data" namenode:/sample-data 2>/dev/null || true

    # Выполняем операции HDFS
    docker exec namenode hdfs dfs -mkdir -p /meteo-data/raw/2024/01 2>/dev/null || true
    docker exec namenode hdfs dfs -mkdir -p /meteo-data/raw/2024/02 2>/dev/null || true
    docker exec namenode hdfs dfs -put -f /sample-data/weather_stations.csv /meteo-data/raw/ 2>/dev/null || print_warning "HDFS data loading skipped"
    print_status "Sample data loaded to HDFS"
fi

# Вывод информации о доступе
echo ""
echo "=========================================="
echo "Infrastructure is ready!"
echo "=========================================="
echo ""
echo "Access points:"
echo "  - HDFS NameNode UI:     http://localhost:9870"
echo "  - YARN ResourceManager: http://localhost:8088"
echo "  - Kafka UI:             http://localhost:8080"
echo "  - InfluxDB UI:          http://localhost:8086"
echo "  - Grafana:              http://localhost:3000"
echo ""
echo "Credentials:"
echo "  - InfluxDB: admin / adminpassword123"
echo "  - Grafana:  admin / admin"
echo ""
echo "Next steps:"
echo "  1. Start weather station emulator:"
echo "     python emulators/src/weather_station_emulator.py --mode kafka"
echo ""
echo "  2. Start Spark Streaming processor:"
echo "     spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \\"
echo "       spark-streaming/src/weather_stream_processor.py --source kafka"
echo ""
echo "=========================================="
