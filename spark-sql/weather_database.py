#!/usr/bin/env python3
"""
Spark SQL база данных для метеоданных

Создаёт распределённую базу данных с 3 таблицами:
1. weather_stations - справочник метеостанций
2. weather_measurements - измерения погодных показателей
3. daily_aggregates - агрегированные суточные данные

Демонстрирует SQL-запросы и работу с DataFrame API.

Запуск:
    spark-submit --master yarn weather_database.py
"""

from pyspark.sql import SparkSession
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType,
    IntegerType, TimestampType, DateType
)
from pyspark.sql.functions import (
    col, avg, min, max, sum, count,
    year, month, dayofmonth, hour,
    window, to_timestamp, date_format
)


def create_spark_session():
    """Создание SparkSession с поддержкой Hive"""
    return SparkSession.builder \
        .appName("WeatherSparkSQL") \
        .config("spark.sql.warehouse.dir", "/user/hive/warehouse") \
        .config("spark.sql.adaptive.enabled", "true") \
        .config("spark.sql.shuffle.partitions", "10") \
        .enableHiveSupport() \
        .getOrCreate()


def define_schemas():
    """Определение схем для таблиц"""

    # Схема справочника станций
    stations_schema = StructType([
        StructField("station_id", StringType(), False),
        StructField("name", StringType(), True),
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
        StructField("altitude", IntegerType(), True),
        StructField("region", StringType(), True),
        StructField("installation_date", StringType(), True),
        StructField("status", StringType(), True)
    ])

    # Схема измерений
    measurements_schema = StructType([
        StructField("timestamp", StringType(), False),
        StructField("station_id", StringType(), False),
        StructField("temperature", DoubleType(), True),
        StructField("humidity", DoubleType(), True),
        StructField("pressure", DoubleType(), True),
        StructField("wind_speed", DoubleType(), True),
        StructField("wind_direction", IntegerType(), True),
        StructField("precipitation", DoubleType(), True)
    ])

    return stations_schema, measurements_schema


def create_database_and_tables(spark, stations_schema, measurements_schema):
    """Создание базы данных и таблиц"""

    # Создание базы данных
    spark.sql("CREATE DATABASE IF NOT EXISTS meteo_db")
    spark.sql("USE meteo_db")

    # Таблица 1: Справочник станций
    spark.sql("""
        CREATE TABLE IF NOT EXISTS weather_stations (
            station_id STRING,
            name STRING,
            latitude DOUBLE,
            longitude DOUBLE,
            altitude INT,
            region STRING,
            installation_date STRING,
            status STRING
        )
        USING parquet
        PARTITIONED BY (region)
    """)

    # Таблица 2: Измерения
    spark.sql("""
        CREATE TABLE IF NOT EXISTS weather_measurements (
            timestamp TIMESTAMP,
            station_id STRING,
            temperature DOUBLE,
            humidity DOUBLE,
            pressure DOUBLE,
            wind_speed DOUBLE,
            wind_direction INT,
            precipitation DOUBLE
        )
        USING parquet
        PARTITIONED BY (year INT, month INT)
    """)

    # Таблица 3: Суточные агрегаты
    spark.sql("""
        CREATE TABLE IF NOT EXISTS daily_aggregates (
            date DATE,
            station_id STRING,
            temp_min DOUBLE,
            temp_max DOUBLE,
            temp_avg DOUBLE,
            humidity_avg DOUBLE,
            pressure_avg DOUBLE,
            wind_speed_max DOUBLE,
            precipitation_total DOUBLE,
            measurement_count INT
        )
        USING parquet
        PARTITIONED BY (year INT, month INT)
    """)

    print("База данных meteo_db и таблицы созданы успешно!")


def load_sample_data(spark, stations_schema, measurements_schema):
    """Загрузка тестовых данных"""

    # Загрузка справочника станций
    stations_df = spark.read \
        .option("header", "true") \
        .schema(stations_schema) \
        .csv("hdfs:///meteo-data/raw/weather_stations.csv")

    stations_df.write \
        .mode("overwrite") \
        .partitionBy("region") \
        .saveAsTable("meteo_db.weather_stations")

    # Загрузка измерений
    measurements_df = spark.read \
        .option("header", "true") \
        .schema(measurements_schema) \
        .csv("hdfs:///meteo-data/raw/2024/*/*.csv")

    # Преобразование timestamp и добавление партиций
    measurements_df = measurements_df \
        .withColumn("timestamp", to_timestamp("timestamp")) \
        .withColumn("year", year("timestamp")) \
        .withColumn("month", month("timestamp"))

    measurements_df.write \
        .mode("overwrite") \
        .partitionBy("year", "month") \
        .saveAsTable("meteo_db.weather_measurements")

    print(f"Загружено {stations_df.count()} станций")
    print(f"Загружено {measurements_df.count()} измерений")


def calculate_daily_aggregates(spark):
    """Расчёт суточных агрегатов"""

    spark.sql("""
        INSERT OVERWRITE TABLE meteo_db.daily_aggregates
        PARTITION (year, month)
        SELECT
            DATE(timestamp) as date,
            station_id,
            MIN(temperature) as temp_min,
            MAX(temperature) as temp_max,
            AVG(temperature) as temp_avg,
            AVG(humidity) as humidity_avg,
            AVG(pressure) as pressure_avg,
            MAX(wind_speed) as wind_speed_max,
            SUM(precipitation) as precipitation_total,
            COUNT(*) as measurement_count,
            YEAR(timestamp) as year,
            MONTH(timestamp) as month
        FROM meteo_db.weather_measurements
        GROUP BY DATE(timestamp), station_id, YEAR(timestamp), MONTH(timestamp)
    """)

    print("Суточные агрегаты рассчитаны!")


def demonstrate_sql_queries(spark):
    """Демонстрация SQL-запросов"""

    print("\n" + "="*60)
    print("ДЕМОНСТРАЦИЯ SQL-ЗАПРОСОВ")
    print("="*60)

    # Запрос 1: Средняя температура по регионам
    print("\n1. Средняя температура по регионам:")
    spark.sql("""
        SELECT
            s.region,
            ROUND(AVG(m.temperature), 2) as avg_temp,
            COUNT(*) as measurements
        FROM meteo_db.weather_measurements m
        JOIN meteo_db.weather_stations s ON m.station_id = s.station_id
        GROUP BY s.region
        ORDER BY avg_temp
    """).show()

    # Запрос 2: Экстремумы температуры по станциям
    print("\n2. Экстремумы температуры по станциям:")
    spark.sql("""
        SELECT
            station_id,
            MIN(temperature) as min_temp,
            MAX(temperature) as max_temp,
            MAX(temperature) - MIN(temperature) as temp_range
        FROM meteo_db.weather_measurements
        GROUP BY station_id
        ORDER BY temp_range DESC
        LIMIT 10
    """).show()

    # Запрос 3: Дни с осадками
    print("\n3. Дни с максимальными осадками:")
    spark.sql("""
        SELECT
            date,
            station_id,
            precipitation_total
        FROM meteo_db.daily_aggregates
        WHERE precipitation_total > 0
        ORDER BY precipitation_total DESC
        LIMIT 10
    """).show()

    # Запрос 4: Станции с экстремальным давлением
    print("\n4. Станции с экстремальным давлением:")
    spark.sql("""
        SELECT
            m.station_id,
            s.name,
            MIN(m.pressure) as min_pressure,
            MAX(m.pressure) as max_pressure
        FROM meteo_db.weather_measurements m
        JOIN meteo_db.weather_stations s ON m.station_id = s.station_id
        GROUP BY m.station_id, s.name
        HAVING MIN(m.pressure) < 1010 OR MAX(m.pressure) > 1040
    """).show()

    # Запрос 5: Корреляция температуры и влажности (с использованием DataFrame API)
    print("\n5. Среднесуточная динамика (DataFrame API):")
    measurements_df = spark.table("meteo_db.weather_measurements")

    hourly_stats = measurements_df \
        .withColumn("hour", hour("timestamp")) \
        .groupBy("hour") \
        .agg(
            avg("temperature").alias("avg_temp"),
            avg("humidity").alias("avg_humidity"),
            avg("wind_speed").alias("avg_wind")
        ) \
        .orderBy("hour")

    hourly_stats.show(24)


def demonstrate_dataframe_operations(spark):
    """Демонстрация операций с DataFrame"""

    print("\n" + "="*60)
    print("ДЕМОНСТРАЦИЯ DATAFRAME API")
    print("="*60)

    # Загрузка таблиц в DataFrame
    stations = spark.table("meteo_db.weather_stations")
    measurements = spark.table("meteo_db.weather_measurements")

    # Фильтрация
    print("\n1. Фильтрация: измерения с температурой ниже -20°C")
    cold_measurements = measurements.filter(col("temperature") < -20)
    cold_measurements.show(5)

    # Join
    print("\n2. Join: измерения с информацией о станции")
    joined = measurements.join(stations, "station_id") \
        .select("timestamp", "name", "region", "temperature", "humidity")
    joined.show(5)

    # Агрегация
    print("\n3. Агрегация: статистика по станциям")
    station_stats = measurements.groupBy("station_id") \
        .agg(
            count("*").alias("total_measurements"),
            avg("temperature").alias("avg_temp"),
            min("temperature").alias("min_temp"),
            max("temperature").alias("max_temp")
        )
    station_stats.show()

    # Window functions
    print("\n4. Window functions: ранжирование станций по температуре в каждом месяце")
    from pyspark.sql.window import Window
    from pyspark.sql.functions import rank, dense_rank

    monthly_temps = measurements \
        .withColumn("month", month("timestamp")) \
        .groupBy("month", "station_id") \
        .agg(avg("temperature").alias("avg_temp"))

    window_spec = Window.partitionBy("month").orderBy(col("avg_temp").asc())

    ranked = monthly_temps \
        .withColumn("rank", rank().over(window_spec)) \
        .filter(col("rank") <= 3) \
        .orderBy("month", "rank")

    ranked.show(10)


def main():
    """Главная функция"""

    print("="*60)
    print("SPARK SQL МЕТЕОРОЛОГИЧЕСКАЯ БАЗА ДАННЫХ")
    print("="*60)

    # Создание сессии
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    # Определение схем
    stations_schema, measurements_schema = define_schemas()

    # Создание БД и таблиц
    create_database_and_tables(spark, stations_schema, measurements_schema)

    # Загрузка данных
    load_sample_data(spark, stations_schema, measurements_schema)

    # Расчёт агрегатов
    calculate_daily_aggregates(spark)

    # Демонстрация SQL
    demonstrate_sql_queries(spark)

    # Демонстрация DataFrame API
    demonstrate_dataframe_operations(spark)

    print("\n" + "="*60)
    print("РАБОТА ЗАВЕРШЕНА УСПЕШНО")
    print("="*60)

    spark.stop()


if __name__ == "__main__":
    main()
