# NoSQL База данных для метеоданных

## Выбор СУБД: InfluxDB

### Обоснование выбора

Для хранения метеорологических данных выбрана **InfluxDB** — специализированная time-series (временных рядов) база данных.

#### Преимущества InfluxDB для данной задачи:

| Критерий | InfluxDB | Альтернативы |
|----------|----------|--------------|
| **Оптимизация для временных рядов** | Специализированная архитектура | MongoDB, Cassandra — универсальные |
| **Скорость записи** | До 1M точек/сек | Сопоставимо только с Cassandra |
| **Сжатие данных** | До 10x без потерь | Требует настройки |
| **Запросы временных рядов** | Нативная поддержка | Требуют сложных агрегаций |
| **Downsampling** | Встроенный механизм | Требует внешних инструментов |
| **Retention policies** | Автоматическое удаление | Ручная настройка |

#### Сравнение с другими NoSQL решениями:

**MongoDB:**
- Плюсы: Гибкая схема, мощные запросы
- Минусы: Не оптимизирована для time-series, медленнее для потоковой записи

**Cassandra:**
- Плюсы: Линейная масштабируемость, высокая доступность
- Минусы: Сложность настройки, менее удобные запросы временных рядов

**Redis:**
- Плюсы: Очень быстрая
- Минусы: Ограниченный объём (память), нет встроенной агрегации

### Модель данных

```
Measurement: weather
Tags:
  - station_id (индексируется)
Fields:
  - temperature (float)
  - humidity (float)
  - pressure (float)
  - wind_speed (float)
  - wind_direction (int)
  - precipitation (float)
Timestamp: nanosecond precision
```

### Примеры запросов (Flux)

```flux
// Последние измерения
from(bucket: "weather-data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "weather")
  |> filter(fn: (r) => r.station_id == "WS001")

// Часовые средние температуры
from(bucket: "weather-data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._field == "temperature")
  |> aggregateWindow(every: 1h, fn: mean)

// Поиск аномалий
from(bucket: "weather-data")
  |> range(start: -24h)
  |> filter(fn: (r) => r._field == "temperature")
  |> filter(fn: (r) => r._value < -30 or r._value > 40)
```

### Запуск

```bash
# Запуск InfluxDB и Grafana
docker-compose up -d

# Web UI
# InfluxDB: http://localhost:8086 (admin/adminpassword123)
# Grafana:  http://localhost:3000 (admin/admin)
```

### Интеграция

```python
from influxdb_client import InfluxDBClient

client = InfluxDBClient(
    url="http://localhost:8086",
    token="meteo-secret-token-12345",
    org="meteo-org"
)
```
