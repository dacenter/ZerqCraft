#!/usr/bin/env python3
"""
Эмулятор метеостанций - генератор потоков метеоданных

Этот модуль эмулирует работу сети метеостанций, генерируя
реалистичные данные о погоде с заданной периодичностью.

Особенности:
- Реалистичная модель погоды с суточными и сезонными вариациями
- Поддержка нескольких станций с разными характеристиками
- Отправка данных в Kafka или сохранение в файлы
- Возможность эмуляции аномалий

Запуск:
    python weather_station_emulator.py --mode kafka --interval 5
    python weather_station_emulator.py --mode file --output ./data
"""

import json
import time
import random
import math
import argparse
import os
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import List, Optional
import threading
import signal
import sys

# Опциональный импорт Kafka
try:
    from kafka import KafkaProducer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    print("Warning: kafka-python not installed. Kafka mode unavailable.")


@dataclass
class WeatherStation:
    """Конфигурация метеостанции"""
    station_id: str
    name: str
    latitude: float
    longitude: float
    altitude: int
    region: str
    base_temperature: float  # Базовая температура для региона
    temperature_amplitude: float  # Амплитуда суточных колебаний


@dataclass
class WeatherMeasurement:
    """Измерение погодных показателей"""
    timestamp: str
    station_id: str
    temperature: float
    humidity: float
    pressure: float
    wind_speed: float
    wind_direction: int
    precipitation: float

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    def to_csv(self) -> str:
        return f"{self.timestamp},{self.station_id},{self.temperature:.1f}," \
               f"{self.humidity:.1f},{self.pressure:.1f},{self.wind_speed:.1f}," \
               f"{self.wind_direction},{self.precipitation:.2f}"


class WeatherModel:
    """Модель генерации реалистичных погодных данных"""

    def __init__(self, station: WeatherStation):
        self.station = station
        self.current_pressure = 1013.25  # Стандартное давление
        self.current_humidity = 60.0
        self.wind_direction = random.randint(0, 359)
        self.precipitation_probability = 0.1

    def generate_measurement(self, timestamp: datetime) -> WeatherMeasurement:
        """Генерация измерения на основе модели погоды"""

        # Суточные колебания температуры
        hour = timestamp.hour + timestamp.minute / 60.0
        daily_variation = self.station.temperature_amplitude * math.sin(
            (hour - 6) * math.pi / 12  # Минимум в 6:00, максимум в 18:00
        )

        # Сезонные колебания (упрощённо)
        day_of_year = timestamp.timetuple().tm_yday
        seasonal_variation = 15 * math.sin((day_of_year - 80) * 2 * math.pi / 365)

        # Случайные флуктуации
        random_noise = random.gauss(0, 1.5)

        temperature = (
            self.station.base_temperature +
            daily_variation +
            seasonal_variation +
            random_noise
        )

        # Давление (медленно меняющееся)
        self.current_pressure += random.gauss(0, 0.5)
        self.current_pressure = max(980, min(1050, self.current_pressure))

        # Влажность (зависит от температуры и давления)
        self.current_humidity += random.gauss(0, 2)
        self.current_humidity = max(20, min(100, self.current_humidity))

        # Скорость ветра
        wind_speed = max(0, random.gauss(5, 3))

        # Направление ветра (медленно меняется)
        self.wind_direction += random.randint(-10, 10)
        self.wind_direction = self.wind_direction % 360

        # Осадки
        if random.random() < self.precipitation_probability:
            precipitation = random.uniform(0.1, 5.0)
            self.current_humidity = min(100, self.current_humidity + 10)
        else:
            precipitation = 0.0

        return WeatherMeasurement(
            timestamp=timestamp.isoformat() + "Z",
            station_id=self.station.station_id,
            temperature=round(temperature, 1),
            humidity=round(self.current_humidity, 1),
            pressure=round(self.current_pressure, 1),
            wind_speed=round(wind_speed, 1),
            wind_direction=self.wind_direction,
            precipitation=round(precipitation, 2)
        )

    def inject_anomaly(self, measurement: WeatherMeasurement,
                       anomaly_type: str) -> WeatherMeasurement:
        """Внедрение аномалии в измерение"""

        if anomaly_type == "extreme_cold":
            measurement.temperature = random.uniform(-40, -30)
        elif anomaly_type == "extreme_heat":
            measurement.temperature = random.uniform(40, 50)
        elif anomaly_type == "storm":
            measurement.wind_speed = random.uniform(20, 35)
            measurement.precipitation = random.uniform(10, 30)
            measurement.pressure = random.uniform(970, 990)
        elif anomaly_type == "sensor_failure":
            measurement.temperature = -999.9
            measurement.humidity = -999.9

        return measurement


class WeatherStationEmulator:
    """Главный класс эмулятора метеостанций"""

    # Предустановленные станции
    DEFAULT_STATIONS = [
        WeatherStation("WS001", "Moscow-Center", 55.7558, 37.6173, 156,
                       "Central", -5.0, 8.0),
        WeatherStation("WS002", "Moscow-South", 55.6167, 37.6667, 180,
                       "Central", -4.5, 7.5),
        WeatherStation("WS003", "Saint-Petersburg", 59.9343, 30.3351, 5,
                       "Northwest", -7.0, 6.0),
        WeatherStation("WS004", "Novosibirsk", 55.0084, 82.9357, 120,
                       "Siberia", -15.0, 12.0),
        WeatherStation("WS005", "Sochi", 43.5855, 39.7231, 20,
                       "South", 12.0, 5.0),
    ]

    def __init__(self,
                 stations: Optional[List[WeatherStation]] = None,
                 kafka_bootstrap_servers: str = "localhost:9092",
                 kafka_topic: str = "weather-data",
                 output_dir: str = "./weather_output"):

        self.stations = stations or self.DEFAULT_STATIONS
        self.models = {s.station_id: WeatherModel(s) for s in self.stations}

        self.kafka_bootstrap_servers = kafka_bootstrap_servers
        self.kafka_topic = kafka_topic
        self.output_dir = output_dir

        self.producer: Optional[KafkaProducer] = None
        self.running = False
        self.anomaly_rate = 0.01  # 1% вероятность аномалии

    def _init_kafka_producer(self) -> bool:
        """Инициализация Kafka producer"""
        if not KAFKA_AVAILABLE:
            return False

        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.kafka_bootstrap_servers,
                value_serializer=lambda x: x.encode('utf-8'),
                key_serializer=lambda x: x.encode('utf-8') if x else None,
                acks='all',
                retries=3
            )
            print(f"Connected to Kafka: {self.kafka_bootstrap_servers}")
            return True
        except Exception as e:
            print(f"Failed to connect to Kafka: {e}")
            return False

    def _send_to_kafka(self, measurement: WeatherMeasurement):
        """Отправка измерения в Kafka"""
        if self.producer:
            self.producer.send(
                self.kafka_topic,
                key=measurement.station_id,
                value=measurement.to_json()
            )

    def _save_to_file(self, measurement: WeatherMeasurement):
        """Сохранение измерения в файл"""
        os.makedirs(self.output_dir, exist_ok=True)

        date_str = measurement.timestamp[:10]
        filename = os.path.join(
            self.output_dir,
            f"weather_{measurement.station_id}_{date_str}.csv"
        )

        # Записываем заголовок если файл новый
        write_header = not os.path.exists(filename)

        with open(filename, 'a') as f:
            if write_header:
                f.write("timestamp,station_id,temperature,humidity,pressure,"
                        "wind_speed,wind_direction,precipitation\n")
            f.write(measurement.to_csv() + "\n")

    def generate_single_batch(self) -> List[WeatherMeasurement]:
        """Генерация одного пакета измерений от всех станций"""
        timestamp = datetime.utcnow()
        measurements = []

        for station in self.stations:
            model = self.models[station.station_id]
            measurement = model.generate_measurement(timestamp)

            # Случайная аномалия
            if random.random() < self.anomaly_rate:
                anomaly_type = random.choice([
                    "extreme_cold", "extreme_heat", "storm", "sensor_failure"
                ])
                measurement = model.inject_anomaly(measurement, anomaly_type)
                print(f"[ANOMALY] {station.station_id}: {anomaly_type}")

            measurements.append(measurement)

        return measurements

    def run(self, mode: str = "kafka", interval: int = 5):
        """Запуск эмуляции"""
        print(f"Starting weather station emulator...")
        print(f"Mode: {mode}, Interval: {interval}s")
        print(f"Stations: {[s.station_id for s in self.stations]}")

        if mode == "kafka":
            if not self._init_kafka_producer():
                print("Falling back to file mode")
                mode = "file"

        self.running = True
        iteration = 0

        while self.running:
            iteration += 1
            measurements = self.generate_single_batch()

            for m in measurements:
                if mode == "kafka":
                    self._send_to_kafka(m)
                elif mode == "file":
                    self._save_to_file(m)

                # Вывод в консоль
                print(f"[{iteration}] {m.station_id}: "
                      f"T={m.temperature}°C, H={m.humidity}%, "
                      f"P={m.pressure}hPa, Wind={m.wind_speed}m/s")

            if mode == "kafka" and self.producer:
                self.producer.flush()

            time.sleep(interval)

    def stop(self):
        """Остановка эмуляции"""
        self.running = False
        if self.producer:
            self.producer.close()
        print("\nEmulator stopped.")


def main():
    parser = argparse.ArgumentParser(
        description="Weather Station Data Emulator"
    )
    parser.add_argument(
        "--mode", choices=["kafka", "file"], default="file",
        help="Output mode: kafka or file (default: file)"
    )
    parser.add_argument(
        "--interval", type=int, default=5,
        help="Interval between measurements in seconds (default: 5)"
    )
    parser.add_argument(
        "--kafka-servers", default="localhost:9092",
        help="Kafka bootstrap servers (default: localhost:9092)"
    )
    parser.add_argument(
        "--kafka-topic", default="weather-data",
        help="Kafka topic name (default: weather-data)"
    )
    parser.add_argument(
        "--output", default="./weather_output",
        help="Output directory for file mode (default: ./weather_output)"
    )
    parser.add_argument(
        "--anomaly-rate", type=float, default=0.01,
        help="Probability of anomaly (default: 0.01)"
    )

    args = parser.parse_args()

    emulator = WeatherStationEmulator(
        kafka_bootstrap_servers=args.kafka_servers,
        kafka_topic=args.kafka_topic,
        output_dir=args.output
    )
    emulator.anomaly_rate = args.anomaly_rate

    # Обработка сигнала завершения
    def signal_handler(sig, frame):
        emulator.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    emulator.run(mode=args.mode, interval=args.interval)


if __name__ == "__main__":
    main()
