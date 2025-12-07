#!/usr/bin/env python3
"""
Пример Kafka Producer для отправки метеоданных

Демонстрирует интеграцию эмулятора метеостанций с Apache Kafka.

Запуск:
    pip install kafka-python
    python kafka_producer_example.py
"""

import json
import time
import random
import math
from datetime import datetime
from kafka import KafkaProducer
from kafka.errors import KafkaError


class WeatherKafkaProducer:
    """Kafka producer для метеоданных"""

    def __init__(self, bootstrap_servers='localhost:9092', topic='weather-data'):
        self.topic = topic

        # Настройка producer с оптимизациями
        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,

            # Настройки надежности
            acks='all',  # Ждем подтверждения от всех реплик
            retries=3,
            retry_backoff_ms=100,

            # Настройки производительности
            batch_size=16384,  # 16KB
            linger_ms=10,  # Буферизация 10ms
            compression_type='gzip',

            # Идемпотентность
            enable_idempotence=True
        )

        print(f"Connected to Kafka: {bootstrap_servers}")
        print(f"Topic: {topic}")

    def generate_weather_data(self, station_id, base_temp=-5.0):
        """Генерация одного измерения"""
        now = datetime.utcnow()
        hour = now.hour + now.minute / 60.0

        # Суточные колебания
        temp_variation = 8.0 * math.sin((hour - 6) * math.pi / 12)
        temperature = base_temp + temp_variation + random.gauss(0, 1.5)

        return {
            "timestamp": now.isoformat() + "Z",
            "station_id": station_id,
            "temperature": round(temperature, 1),
            "humidity": round(random.uniform(40, 90), 1),
            "pressure": round(random.gauss(1013, 10), 1),
            "wind_speed": round(max(0, random.gauss(5, 3)), 1),
            "wind_direction": random.randint(0, 359),
            "precipitation": round(random.uniform(0, 2) if random.random() < 0.1 else 0, 2)
        }

    def send_measurement(self, measurement):
        """Отправка одного измерения"""
        try:
            future = self.producer.send(
                self.topic,
                key=measurement['station_id'],
                value=measurement
            )

            # Можно дождаться подтверждения (синхронно)
            # record_metadata = future.get(timeout=10)
            # print(f"Sent to {record_metadata.topic}:{record_metadata.partition}:{record_metadata.offset}")

            return True

        except KafkaError as e:
            print(f"Failed to send message: {e}")
            return False

    def run(self, stations, interval=5):
        """Запуск продюсера"""
        print(f"Starting producer for stations: {stations}")
        print(f"Interval: {interval} seconds")

        station_temps = {s: random.uniform(-10, 10) for s in stations}

        try:
            iteration = 0
            while True:
                iteration += 1

                for station_id in stations:
                    measurement = self.generate_weather_data(
                        station_id,
                        base_temp=station_temps[station_id]
                    )

                    self.send_measurement(measurement)
                    print(f"[{iteration}] {station_id}: T={measurement['temperature']}°C, "
                          f"H={measurement['humidity']}%, P={measurement['pressure']}hPa")

                # Flush после каждого batch
                self.producer.flush()
                time.sleep(interval)

        except KeyboardInterrupt:
            print("\nStopping producer...")
        finally:
            self.producer.close()
            print("Producer closed.")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Weather Kafka Producer")
    parser.add_argument("--servers", default="localhost:9092",
                       help="Kafka bootstrap servers")
    parser.add_argument("--topic", default="weather-data",
                       help="Kafka topic")
    parser.add_argument("--interval", type=int, default=5,
                       help="Interval between messages (seconds)")
    parser.add_argument("--stations", default="WS001,WS002,WS003",
                       help="Comma-separated list of station IDs")

    args = parser.parse_args()

    stations = args.stations.split(",")

    producer = WeatherKafkaProducer(
        bootstrap_servers=args.servers,
        topic=args.topic
    )

    producer.run(stations=stations, interval=args.interval)


if __name__ == "__main__":
    main()
