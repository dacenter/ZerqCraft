#!/usr/bin/env python3
"""
Python клиент для работы с InfluxDB

Демонстрирует:
- Запись метеоданных в InfluxDB
- Запросы на языке Flux
- Downsampling и агрегации
- Интеграция с Kafka

Установка зависимостей:
    pip install influxdb-client kafka-python

Запуск:
    python influxdb_client.py --write   # Записать тестовые данные
    python influxdb_client.py --query   # Выполнить запросы
    python influxdb_client.py --stream  # Читать из Kafka и писать в InfluxDB
"""

import os
import json
import time
import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any
import argparse

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS, ASYNCHRONOUS

# Опциональный импорт Kafka
try:
    from kafka import KafkaConsumer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False


class WeatherInfluxDBClient:
    """Клиент для работы с InfluxDB для метеоданных"""

    def __init__(self,
                 url: str = "http://localhost:8086",
                 token: str = "meteo-secret-token-12345",
                 org: str = "meteo-org",
                 bucket: str = "weather-data"):
        """
        Инициализация клиента

        Args:
            url: URL InfluxDB сервера
            token: API токен
            org: Организация
            bucket: Bucket для хранения данных
        """
        self.url = url
        self.org = org
        self.bucket = bucket

        self.client = InfluxDBClient(url=url, token=token, org=org)
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()
        self.delete_api = self.client.delete_api()

        print(f"Connected to InfluxDB: {url}")
        print(f"Organization: {org}, Bucket: {bucket}")

    def write_measurement(self, measurement: Dict[str, Any]) -> bool:
        """
        Запись одного измерения

        Args:
            measurement: Словарь с данными измерения

        Returns:
            True при успешной записи
        """
        try:
            point = Point("weather") \
                .tag("station_id", measurement["station_id"]) \
                .field("temperature", float(measurement["temperature"])) \
                .field("humidity", float(measurement["humidity"])) \
                .field("pressure", float(measurement["pressure"])) \
                .field("wind_speed", float(measurement["wind_speed"])) \
                .field("wind_direction", int(measurement["wind_direction"])) \
                .field("precipitation", float(measurement["precipitation"]))

            # Если есть timestamp в данных
            if "timestamp" in measurement:
                # Парсинг ISO формата
                ts = datetime.fromisoformat(
                    measurement["timestamp"].replace("Z", "+00:00")
                )
                point = point.time(ts, WritePrecision.S)

            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
            return True

        except Exception as e:
            print(f"Error writing measurement: {e}")
            return False

    def write_batch(self, measurements: List[Dict[str, Any]]) -> int:
        """
        Пакетная запись измерений

        Args:
            measurements: Список измерений

        Returns:
            Количество успешно записанных измерений
        """
        points = []
        for m in measurements:
            point = Point("weather") \
                .tag("station_id", m["station_id"]) \
                .field("temperature", float(m["temperature"])) \
                .field("humidity", float(m["humidity"])) \
                .field("pressure", float(m["pressure"])) \
                .field("wind_speed", float(m["wind_speed"])) \
                .field("wind_direction", int(m["wind_direction"])) \
                .field("precipitation", float(m["precipitation"]))

            if "timestamp" in m:
                ts = datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00"))
                point = point.time(ts, WritePrecision.S)

            points.append(point)

        try:
            self.write_api.write(bucket=self.bucket, org=self.org, record=points)
            return len(points)
        except Exception as e:
            print(f"Error writing batch: {e}")
            return 0

    def query_latest(self, station_id: str = None, limit: int = 10) -> List[Dict]:
        """
        Получение последних измерений

        Args:
            station_id: ID станции (опционально)
            limit: Максимальное количество записей

        Returns:
            Список измерений
        """
        filter_station = ""
        if station_id:
            filter_station = f'|> filter(fn: (r) => r.station_id == "{station_id}")'

        query = f'''
            from(bucket: "{self.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "weather")
                {filter_station}
                |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> sort(columns: ["_time"], desc: true)
                |> limit(n: {limit})
        '''

        result = []
        tables = self.query_api.query(query, org=self.org)

        for table in tables:
            for record in table.records:
                result.append({
                    "time": record.get_time(),
                    "station_id": record.values.get("station_id"),
                    "temperature": record.values.get("temperature"),
                    "humidity": record.values.get("humidity"),
                    "pressure": record.values.get("pressure"),
                    "wind_speed": record.values.get("wind_speed"),
                    "wind_direction": record.values.get("wind_direction"),
                    "precipitation": record.values.get("precipitation")
                })

        return result

    def query_aggregates(self, window: str = "1h",
                         station_id: str = None,
                         start: str = "-24h") -> List[Dict]:
        """
        Агрегированные данные по временным окнам

        Args:
            window: Размер окна (например, "1h", "15m", "1d")
            station_id: ID станции (опционально)
            start: Начало периода (например, "-24h", "-7d")

        Returns:
            Список агрегатов
        """
        filter_station = ""
        if station_id:
            filter_station = f'|> filter(fn: (r) => r.station_id == "{station_id}")'

        query = f'''
            from(bucket: "{self.bucket}")
                |> range(start: {start})
                |> filter(fn: (r) => r._measurement == "weather")
                |> filter(fn: (r) => r._field == "temperature")
                {filter_station}
                |> aggregateWindow(every: {window}, fn: mean, createEmpty: false)
                |> yield(name: "mean")

            from(bucket: "{self.bucket}")
                |> range(start: {start})
                |> filter(fn: (r) => r._measurement == "weather")
                |> filter(fn: (r) => r._field == "temperature")
                {filter_station}
                |> aggregateWindow(every: {window}, fn: min, createEmpty: false)
                |> yield(name: "min")

            from(bucket: "{self.bucket}")
                |> range(start: {start})
                |> filter(fn: (r) => r._measurement == "weather")
                |> filter(fn: (r) => r._field == "temperature")
                {filter_station}
                |> aggregateWindow(every: {window}, fn: max, createEmpty: false)
                |> yield(name: "max")
        '''

        result = []
        tables = self.query_api.query(query, org=self.org)

        for table in tables:
            for record in table.records:
                result.append({
                    "time": record.get_time(),
                    "station_id": record.values.get("station_id"),
                    "field": record.get_field(),
                    "value": record.get_value(),
                    "aggregate": record.get_measurement()
                })

        return result

    def query_anomalies(self, threshold_temp_low: float = -30,
                        threshold_temp_high: float = 40,
                        start: str = "-24h") -> List[Dict]:
        """
        Поиск аномальных значений температуры

        Args:
            threshold_temp_low: Нижний порог температуры
            threshold_temp_high: Верхний порог температуры
            start: Начало периода

        Returns:
            Список аномальных измерений
        """
        query = f'''
            from(bucket: "{self.bucket}")
                |> range(start: {start})
                |> filter(fn: (r) => r._measurement == "weather")
                |> filter(fn: (r) => r._field == "temperature")
                |> filter(fn: (r) =>
                    r._value < {threshold_temp_low} or
                    r._value > {threshold_temp_high}
                )
                |> sort(columns: ["_time"], desc: true)
        '''

        result = []
        tables = self.query_api.query(query, org=self.org)

        for table in tables:
            for record in table.records:
                anomaly_type = "EXTREME_COLD" if record.get_value() < threshold_temp_low else "EXTREME_HEAT"
                result.append({
                    "time": record.get_time(),
                    "station_id": record.values.get("station_id"),
                    "temperature": record.get_value(),
                    "anomaly_type": anomaly_type
                })

        return result

    def stream_from_kafka(self, kafka_servers: str = "localhost:9092",
                          topic: str = "weather-data",
                          group_id: str = "influxdb-writer"):
        """
        Потоковая запись из Kafka в InfluxDB

        Args:
            kafka_servers: Kafka bootstrap servers
            topic: Kafka topic
            group_id: Consumer group ID
        """
        if not KAFKA_AVAILABLE:
            print("kafka-python not installed. Install with: pip install kafka-python")
            return

        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=kafka_servers,
            group_id=group_id,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest'
        )

        print(f"Streaming from Kafka topic '{topic}' to InfluxDB...")
        print("Press Ctrl+C to stop")

        batch = []
        batch_size = 100
        message_count = 0

        try:
            for message in consumer:
                batch.append(message.value)
                message_count += 1

                if len(batch) >= batch_size:
                    written = self.write_batch(batch)
                    print(f"Written {written} points (total: {message_count})")
                    batch = []

        except KeyboardInterrupt:
            # Записываем оставшиеся данные
            if batch:
                self.write_batch(batch)
            print(f"\nTotal messages written: {message_count}")
        finally:
            consumer.close()

    def close(self):
        """Закрытие соединения"""
        self.client.close()


def generate_test_data(stations: List[str], hours: int = 24) -> List[Dict]:
    """Генерация тестовых данных"""
    data = []
    now = datetime.utcnow()

    for station_id in stations:
        base_temp = random.uniform(-10, 15)

        for h in range(hours * 60):  # Данные каждую минуту
            ts = now - timedelta(minutes=h)
            hour = ts.hour + ts.minute / 60.0

            temp_variation = 8.0 * math.sin((hour - 6) * math.pi / 12)
            temperature = base_temp + temp_variation + random.gauss(0, 1.5)

            data.append({
                "timestamp": ts.isoformat() + "Z",
                "station_id": station_id,
                "temperature": round(temperature, 1),
                "humidity": round(random.uniform(40, 90), 1),
                "pressure": round(random.gauss(1013, 10), 1),
                "wind_speed": round(max(0, random.gauss(5, 3)), 1),
                "wind_direction": random.randint(0, 359),
                "precipitation": round(random.uniform(0, 2) if random.random() < 0.1 else 0, 2)
            })

    return data


def main():
    parser = argparse.ArgumentParser(description="InfluxDB Weather Client")
    parser.add_argument("--url", default="http://localhost:8086",
                       help="InfluxDB URL")
    parser.add_argument("--token", default="meteo-secret-token-12345",
                       help="InfluxDB token")
    parser.add_argument("--org", default="meteo-org",
                       help="InfluxDB organization")
    parser.add_argument("--bucket", default="weather-data",
                       help="InfluxDB bucket")
    parser.add_argument("--write", action="store_true",
                       help="Write test data")
    parser.add_argument("--query", action="store_true",
                       help="Execute sample queries")
    parser.add_argument("--stream", action="store_true",
                       help="Stream from Kafka")
    parser.add_argument("--kafka-servers", default="localhost:9092",
                       help="Kafka bootstrap servers")

    args = parser.parse_args()

    client = WeatherInfluxDBClient(
        url=args.url,
        token=args.token,
        org=args.org,
        bucket=args.bucket
    )

    try:
        if args.write:
            print("\n=== Writing test data ===")
            stations = ["WS001", "WS002", "WS003", "WS004", "WS005"]
            test_data = generate_test_data(stations, hours=24)
            print(f"Generated {len(test_data)} test records")

            written = client.write_batch(test_data)
            print(f"Written {written} records to InfluxDB")

        if args.query:
            print("\n=== Latest measurements ===")
            latest = client.query_latest(limit=5)
            for m in latest:
                print(f"  {m['time']}: {m['station_id']} T={m['temperature']}°C")

            print("\n=== Hourly aggregates ===")
            aggregates = client.query_aggregates(window="1h", start="-6h")
            for a in aggregates[:10]:
                print(f"  {a['time']}: {a['station_id']} {a['aggregate']}={a['value']:.1f}")

            print("\n=== Anomalies ===")
            anomalies = client.query_anomalies(start="-24h")
            if anomalies:
                for a in anomalies[:5]:
                    print(f"  {a['time']}: {a['station_id']} {a['anomaly_type']} T={a['temperature']}°C")
            else:
                print("  No anomalies found")

        if args.stream:
            print("\n=== Starting Kafka to InfluxDB stream ===")
            client.stream_from_kafka(kafka_servers=args.kafka_servers)

    finally:
        client.close()


if __name__ == "__main__":
    main()
