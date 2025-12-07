#!/usr/bin/env python3
"""
Spark Streaming обработчик метеоданных

Обрабатывает потоковые данные от метеостанций с использованием:
- Structured Streaming
- Оконной агрегации (windowing)
- Детекции аномалий в реальном времени

Поддерживаемые источники:
- Apache Kafka
- TCP Socket
- File stream

Запуск:
    spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
        weather_stream_processor.py --source kafka --kafka-servers localhost:9092

    spark-submit weather_stream_processor.py --source socket --host localhost --port 9999
"""

from pyspark.sql import SparkSession
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType,
    IntegerType, TimestampType
)
from pyspark.sql.functions import (
    col, from_json, to_timestamp, window,
    avg, min, max, count, sum as spark_sum,
    when, lit, expr, current_timestamp,
    percentile_approx, stddev, abs as spark_abs
)
import argparse


# Схема JSON-сообщений от метеостанций
WEATHER_SCHEMA = StructType([
    StructField("timestamp", StringType(), True),
    StructField("station_id", StringType(), True),
    StructField("temperature", DoubleType(), True),
    StructField("humidity", DoubleType(), True),
    StructField("pressure", DoubleType(), True),
    StructField("wind_speed", DoubleType(), True),
    StructField("wind_direction", IntegerType(), True),
    StructField("precipitation", DoubleType(), True)
])

# Пороговые значения для аномалий
ANOMALY_THRESHOLDS = {
    "temp_extreme_low": -30.0,
    "temp_extreme_high": 40.0,
    "humidity_extreme_low": 20.0,
    "humidity_extreme_high": 95.0,
    "pressure_extreme_low": 980.0,
    "pressure_extreme_high": 1050.0,
    "wind_extreme_high": 20.0,
    "precipitation_extreme_high": 10.0
}


def create_spark_session():
    """Создание Spark сессии для стриминга"""
    return SparkSession.builder \
        .appName("WeatherStreamProcessor") \
        .config("spark.sql.shuffle.partitions", "4") \
        .config("spark.streaming.stopGracefullyOnShutdown", "true") \
        .getOrCreate()


def read_from_kafka(spark, kafka_servers, topic):
    """Чтение потока из Kafka"""
    return spark.readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", kafka_servers) \
        .option("subscribe", topic) \
        .option("startingOffsets", "latest") \
        .option("failOnDataLoss", "false") \
        .load() \
        .selectExpr("CAST(key AS STRING)", "CAST(value AS STRING)") \
        .select(
            from_json(col("value"), WEATHER_SCHEMA).alias("data")
        ) \
        .select("data.*") \
        .withColumn("event_time", to_timestamp("timestamp"))


def read_from_socket(spark, host, port):
    """Чтение потока из TCP сокета"""
    return spark.readStream \
        .format("socket") \
        .option("host", host) \
        .option("port", port) \
        .load() \
        .select(
            from_json(col("value"), WEATHER_SCHEMA).alias("data")
        ) \
        .select("data.*") \
        .withColumn("event_time", to_timestamp("timestamp"))


def read_from_files(spark, input_path):
    """Чтение потока из файлов"""
    return spark.readStream \
        .format("csv") \
        .schema(WEATHER_SCHEMA) \
        .option("header", "true") \
        .option("maxFilesPerTrigger", 1) \
        .load(input_path) \
        .withColumn("event_time", to_timestamp("timestamp"))


def detect_anomalies(df):
    """Детекция аномалий в потоке данных"""

    return df.withColumn(
        "anomaly_type",
        when(col("temperature") < ANOMALY_THRESHOLDS["temp_extreme_low"],
             lit("EXTREME_COLD"))
        .when(col("temperature") > ANOMALY_THRESHOLDS["temp_extreme_high"],
              lit("EXTREME_HEAT"))
        .when(col("humidity") < ANOMALY_THRESHOLDS["humidity_extreme_low"],
              lit("EXTREME_DRY"))
        .when(col("humidity") > ANOMALY_THRESHOLDS["humidity_extreme_high"],
              lit("EXTREME_HUMID"))
        .when(col("pressure") < ANOMALY_THRESHOLDS["pressure_extreme_low"],
              lit("LOW_PRESSURE"))
        .when(col("pressure") > ANOMALY_THRESHOLDS["pressure_extreme_high"],
              lit("HIGH_PRESSURE"))
        .when(col("wind_speed") > ANOMALY_THRESHOLDS["wind_extreme_high"],
              lit("STRONG_WIND"))
        .when(col("precipitation") > ANOMALY_THRESHOLDS["precipitation_extreme_high"],
              lit("HEAVY_RAIN"))
        .when(col("temperature") == -999.9,
              lit("SENSOR_FAILURE"))
        .otherwise(lit(None))
    ).withColumn(
        "is_anomaly",
        when(col("anomaly_type").isNotNull(), lit(True)).otherwise(lit(False))
    )


def windowed_aggregation(df, window_duration="5 minutes", slide_duration="1 minute"):
    """
    Оконная агрегация метеоданных

    Использует tumbling window для расчёта статистик по каждой станции
    за скользящие временные окна.
    """

    return df \
        .withWatermark("event_time", "10 minutes") \
        .groupBy(
            window(col("event_time"), window_duration, slide_duration),
            col("station_id")
        ) \
        .agg(
            # Статистики температуры
            avg("temperature").alias("temp_avg"),
            min("temperature").alias("temp_min"),
            max("temperature").alias("temp_max"),
            stddev("temperature").alias("temp_stddev"),

            # Статистики влажности
            avg("humidity").alias("humidity_avg"),

            # Статистики давления
            avg("pressure").alias("pressure_avg"),
            min("pressure").alias("pressure_min"),
            max("pressure").alias("pressure_max"),

            # Статистики ветра
            avg("wind_speed").alias("wind_speed_avg"),
            max("wind_speed").alias("wind_speed_max"),

            # Осадки
            spark_sum("precipitation").alias("precipitation_total"),

            # Количество измерений
            count("*").alias("measurement_count")
        ) \
        .select(
            col("window.start").alias("window_start"),
            col("window.end").alias("window_end"),
            col("station_id"),
            col("temp_avg"),
            col("temp_min"),
            col("temp_max"),
            col("temp_stddev"),
            col("humidity_avg"),
            col("pressure_avg"),
            col("pressure_min"),
            col("pressure_max"),
            col("wind_speed_avg"),
            col("wind_speed_max"),
            col("precipitation_total"),
            col("measurement_count")
        )


def alert_aggregation(df, window_duration="1 minute"):
    """
    Агрегация алертов по окнам времени

    Подсчитывает количество аномалий каждого типа за временное окно.
    """

    return df \
        .filter(col("is_anomaly") == True) \
        .withWatermark("event_time", "5 minutes") \
        .groupBy(
            window(col("event_time"), window_duration),
            col("station_id"),
            col("anomaly_type")
        ) \
        .agg(
            count("*").alias("anomaly_count"),
            avg("temperature").alias("avg_temp_during_anomaly"),
            max("wind_speed").alias("max_wind_during_anomaly")
        ) \
        .select(
            col("window.start").alias("alert_window_start"),
            col("window.end").alias("alert_window_end"),
            col("station_id"),
            col("anomaly_type"),
            col("anomaly_count"),
            col("avg_temp_during_anomaly"),
            col("max_wind_during_anomaly")
        )


def write_to_console(df, output_mode="update", trigger_interval="10 seconds"):
    """Вывод результатов в консоль"""
    return df.writeStream \
        .outputMode(output_mode) \
        .format("console") \
        .option("truncate", "false") \
        .trigger(processingTime=trigger_interval) \
        .start()


def write_to_kafka(df, kafka_servers, topic, output_mode="update",
                   trigger_interval="10 seconds"):
    """Запись результатов в Kafka"""
    return df.selectExpr("to_json(struct(*)) AS value") \
        .writeStream \
        .outputMode(output_mode) \
        .format("kafka") \
        .option("kafka.bootstrap.servers", kafka_servers) \
        .option("topic", topic) \
        .option("checkpointLocation", "/tmp/spark-checkpoints/" + topic) \
        .trigger(processingTime=trigger_interval) \
        .start()


def write_to_parquet(df, output_path, trigger_interval="1 minute"):
    """Запись результатов в Parquet файлы"""
    return df.writeStream \
        .outputMode("append") \
        .format("parquet") \
        .option("path", output_path) \
        .option("checkpointLocation", output_path + "/_checkpoint") \
        .trigger(processingTime=trigger_interval) \
        .partitionBy("station_id") \
        .start()


def main():
    parser = argparse.ArgumentParser(
        description="Spark Streaming Weather Data Processor"
    )
    parser.add_argument(
        "--source", choices=["kafka", "socket", "file"],
        default="socket", help="Data source type"
    )
    parser.add_argument(
        "--kafka-servers", default="localhost:9092",
        help="Kafka bootstrap servers"
    )
    parser.add_argument(
        "--kafka-topic", default="weather-data",
        help="Kafka input topic"
    )
    parser.add_argument(
        "--host", default="localhost",
        help="Socket host for socket source"
    )
    parser.add_argument(
        "--port", type=int, default=9999,
        help="Socket port for socket source"
    )
    parser.add_argument(
        "--input-path", default="/tmp/weather-input",
        help="Input path for file source"
    )
    parser.add_argument(
        "--window-duration", default="5 minutes",
        help="Window duration for aggregation"
    )
    parser.add_argument(
        "--slide-duration", default="1 minute",
        help="Slide duration for windowing"
    )

    args = parser.parse_args()

    # Создание Spark сессии
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    print("="*60)
    print("SPARK STREAMING WEATHER PROCESSOR")
    print("="*60)
    print(f"Source: {args.source}")
    print(f"Window: {args.window_duration}, Slide: {args.slide_duration}")
    print("="*60)

    # Чтение потока данных
    if args.source == "kafka":
        raw_stream = read_from_kafka(
            spark, args.kafka_servers, args.kafka_topic
        )
    elif args.source == "socket":
        raw_stream = read_from_socket(spark, args.host, args.port)
    else:
        raw_stream = read_from_files(spark, args.input_path)

    # Детекция аномалий
    enriched_stream = detect_anomalies(raw_stream)

    # Оконная агрегация
    windowed_stats = windowed_aggregation(
        enriched_stream,
        window_duration=args.window_duration,
        slide_duration=args.slide_duration
    )

    # Агрегация алертов
    alerts = alert_aggregation(enriched_stream)

    # Запуск потоков вывода
    print("\n--- Starting streams ---\n")

    # Вывод статистик в консоль
    stats_query = write_to_console(
        windowed_stats,
        output_mode="update",
        trigger_interval="10 seconds"
    )

    # Вывод алертов в консоль
    alerts_query = write_to_console(
        alerts,
        output_mode="update",
        trigger_interval="5 seconds"
    )

    # Ожидание завершения
    try:
        spark.streams.awaitAnyTermination()
    except KeyboardInterrupt:
        print("\nStopping streams...")
        stats_query.stop()
        alerts_query.stop()
        spark.stop()
        print("Done.")


if __name__ == "__main__":
    main()
