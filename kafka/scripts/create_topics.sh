#!/bin/bash

# ==============================================================================
# Скрипт создания Kafka топиков для системы метеоданных
# ==============================================================================

KAFKA_CONTAINER="kafka-broker-1"
BOOTSTRAP_SERVERS="localhost:9092"

echo "=========================================="
echo "Creating Kafka Topics for Weather System"
echo "=========================================="

# Функция создания топика
create_topic() {
    local topic_name=$1
    local partitions=$2
    local replication=$3
    local retention_ms=$4

    echo "Creating topic: $topic_name (partitions=$partitions, replication=$replication)"

    docker exec $KAFKA_CONTAINER kafka-topics --create \
        --bootstrap-server $BOOTSTRAP_SERVERS \
        --topic $topic_name \
        --partitions $partitions \
        --replication-factor $replication \
        --config retention.ms=$retention_ms \
        --if-not-exists

    if [ $? -eq 0 ]; then
        echo "  [OK] Topic $topic_name created"
    else
        echo "  [ERROR] Failed to create topic $topic_name"
    fi
}

# 1. Топик для сырых данных от станций
# Высокая пропускная способность, много партиций по station_id
create_topic "weather-data" 10 2 604800000  # 7 days retention

# 2. Топик для агрегированных данных (5-минутные окна)
create_topic "weather-aggregates-5min" 5 2 2592000000  # 30 days retention

# 3. Топик для алертов об аномалиях
create_topic "weather-alerts" 3 2 2592000000  # 30 days retention

# 4. Топик для суточных сводок
create_topic "weather-daily-summary" 3 2 7776000000  # 90 days retention

# 5. Топик для команд управления станциями
create_topic "station-commands" 3 2 86400000  # 1 day retention

echo ""
echo "=========================================="
echo "Listing all topics:"
echo "=========================================="

docker exec $KAFKA_CONTAINER kafka-topics --list \
    --bootstrap-server $BOOTSTRAP_SERVERS

echo ""
echo "=========================================="
echo "Topic details:"
echo "=========================================="

for topic in weather-data weather-aggregates-5min weather-alerts weather-daily-summary station-commands; do
    echo ""
    echo "--- $topic ---"
    docker exec $KAFKA_CONTAINER kafka-topics --describe \
        --bootstrap-server $BOOTSTRAP_SERVERS \
        --topic $topic
done

echo ""
echo "=========================================="
echo "Topics created successfully!"
echo "=========================================="
