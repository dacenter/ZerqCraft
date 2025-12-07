#!/usr/bin/env python3
"""
Пример Kafka Consumer для чтения метеоданных

Демонстрирует различные паттерны потребления сообщений из Kafka.

Запуск:
    pip install kafka-python
    python kafka_consumer_example.py
"""

import json
from datetime import datetime
from kafka import KafkaConsumer
from kafka.errors import KafkaError


class WeatherKafkaConsumer:
    """Kafka consumer для метеоданных"""

    def __init__(self, bootstrap_servers='localhost:9092',
                 topic='weather-data',
                 group_id='weather-consumer-group'):

        self.topic = topic

        # Настройка consumer
        self.consumer = KafkaConsumer(
            topic,
            bootstrap_servers=bootstrap_servers,
            group_id=group_id,

            # Десериализация
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            key_deserializer=lambda k: k.decode('utf-8') if k else None,

            # Настройки offset
            auto_offset_reset='latest',  # или 'earliest' для чтения с начала
            enable_auto_commit=True,
            auto_commit_interval_ms=5000,

            # Настройки fetch
            fetch_min_bytes=1,
            fetch_max_wait_ms=500,
            max_poll_records=500,

            # Heartbeat
            session_timeout_ms=30000,
            heartbeat_interval_ms=10000
        )

        print(f"Connected to Kafka: {bootstrap_servers}")
        print(f"Topic: {topic}")
        print(f"Consumer group: {group_id}")

    def process_message(self, message):
        """Обработка одного сообщения"""
        data = message.value
        station_id = data.get('station_id', 'unknown')

        # Здесь можно добавить любую логику обработки
        print(f"[{message.partition}:{message.offset}] "
              f"{station_id}: T={data['temperature']}°C, "
              f"H={data['humidity']}%, P={data['pressure']}hPa")

        # Детекция аномалий
        if data['temperature'] < -30:
            print(f"  ALERT: Extreme cold at {station_id}!")
        elif data['temperature'] > 40:
            print(f"  ALERT: Extreme heat at {station_id}!")
        elif data['wind_speed'] > 20:
            print(f"  ALERT: Strong wind at {station_id}!")

        return data

    def run(self):
        """Запуск consumer"""
        print("Starting consumer... (Ctrl+C to stop)")

        try:
            message_count = 0

            for message in self.consumer:
                self.process_message(message)
                message_count += 1

                if message_count % 100 == 0:
                    print(f"--- Processed {message_count} messages ---")

        except KeyboardInterrupt:
            print("\nStopping consumer...")
        finally:
            self.consumer.close()
            print(f"Consumer closed. Total messages: {message_count}")

    def consume_batch(self, timeout_ms=1000, max_records=100):
        """Пакетное чтение сообщений"""
        records = self.consumer.poll(
            timeout_ms=timeout_ms,
            max_records=max_records
        )

        messages = []
        for topic_partition, partition_records in records.items():
            for record in partition_records:
                messages.append(self.process_message(record))

        return messages


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Weather Kafka Consumer")
    parser.add_argument("--servers", default="localhost:9092",
                       help="Kafka bootstrap servers")
    parser.add_argument("--topic", default="weather-data",
                       help="Kafka topic")
    parser.add_argument("--group", default="weather-consumer-group",
                       help="Consumer group ID")

    args = parser.parse_args()

    consumer = WeatherKafkaConsumer(
        bootstrap_servers=args.servers,
        topic=args.topic,
        group_id=args.group
    )

    consumer.run()


if __name__ == "__main__":
    main()
