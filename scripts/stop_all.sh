#!/bin/bash

# ==============================================================================
# Скрипт остановки всей инфраструктуры
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Stopping MeteoData Big Data Landscape"
echo "=========================================="

# Определение команды docker-compose
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Остановка NoSQL
echo "Stopping InfluxDB..."
cd "$PROJECT_ROOT/nosql" && $DOCKER_COMPOSE down 2>/dev/null || true

# Остановка Kafka
echo "Stopping Kafka..."
cd "$PROJECT_ROOT/kafka" && $DOCKER_COMPOSE down 2>/dev/null || true

# Остановка Hadoop
echo "Stopping Hadoop..."
cd "$PROJECT_ROOT/hadoop" && $DOCKER_COMPOSE down 2>/dev/null || true

echo ""
echo "=========================================="
echo "All services stopped"
echo "=========================================="
