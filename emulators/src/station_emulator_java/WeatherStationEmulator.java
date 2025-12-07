package ru.meteo.emulator;

import java.io.*;
import java.net.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;

/**
 * Java-эмулятор метеостанции
 *
 * Генерирует реалистичные метеоданные и отправляет их:
 * - По TCP/UDP сокету
 * - В файл
 * - В Kafka (опционально)
 *
 * Компиляция:
 *   javac WeatherStationEmulator.java
 *
 * Запуск:
 *   java WeatherStationEmulator --mode socket --port 9999
 *   java WeatherStationEmulator --mode file --output ./data
 */
public class WeatherStationEmulator {

    // Конфигурация станции
    private final String stationId;
    private final String stationName;
    private final double latitude;
    private final double longitude;
    private final int altitude;

    // Параметры модели погоды
    private final double baseTemperature;
    private final double temperatureAmplitude;
    private double currentPressure = 1013.25;
    private double currentHumidity = 60.0;
    private int windDirection = 180;

    // Генератор случайных чисел
    private final Random random = new Random();

    // Форматтер для timestamp
    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ISO_INSTANT;

    public WeatherStationEmulator(String stationId, String stationName,
                                   double latitude, double longitude,
                                   int altitude, double baseTemp,
                                   double tempAmplitude) {
        this.stationId = stationId;
        this.stationName = stationName;
        this.latitude = latitude;
        this.longitude = longitude;
        this.altitude = altitude;
        this.baseTemperature = baseTemp;
        this.temperatureAmplitude = tempAmplitude;
    }

    /**
     * Генерация одного измерения
     */
    public WeatherMeasurement generateMeasurement() {
        Instant now = Instant.now();
        ZonedDateTime zdt = now.atZone(ZoneOffset.UTC);

        // Суточные колебания температуры
        double hour = zdt.getHour() + zdt.getMinute() / 60.0;
        double dailyVariation = temperatureAmplitude *
                Math.sin((hour - 6) * Math.PI / 12);

        // Сезонные колебания
        int dayOfYear = zdt.getDayOfYear();
        double seasonalVariation = 15 * Math.sin((dayOfYear - 80) * 2 * Math.PI / 365);

        // Случайный шум
        double noise = random.nextGaussian() * 1.5;

        double temperature = baseTemperature + dailyVariation +
                seasonalVariation + noise;

        // Обновление давления
        currentPressure += random.nextGaussian() * 0.5;
        currentPressure = Math.max(980, Math.min(1050, currentPressure));

        // Обновление влажности
        currentHumidity += random.nextGaussian() * 2;
        currentHumidity = Math.max(20, Math.min(100, currentHumidity));

        // Скорость ветра
        double windSpeed = Math.max(0, random.nextGaussian() * 3 + 5);

        // Направление ветра
        windDirection += random.nextInt(21) - 10;
        windDirection = (windDirection + 360) % 360;

        // Осадки
        double precipitation = 0.0;
        if (random.nextDouble() < 0.1) {
            precipitation = random.nextDouble() * 5;
            currentHumidity = Math.min(100, currentHumidity + 10);
        }

        return new WeatherMeasurement(
                ISO_FORMATTER.format(now),
                stationId,
                Math.round(temperature * 10) / 10.0,
                Math.round(currentHumidity * 10) / 10.0,
                Math.round(currentPressure * 10) / 10.0,
                Math.round(windSpeed * 10) / 10.0,
                windDirection,
                Math.round(precipitation * 100) / 100.0
        );
    }

    /**
     * Класс для хранения измерения
     */
    public static class WeatherMeasurement {
        public final String timestamp;
        public final String stationId;
        public final double temperature;
        public final double humidity;
        public final double pressure;
        public final double windSpeed;
        public final int windDirection;
        public final double precipitation;

        public WeatherMeasurement(String timestamp, String stationId,
                                   double temperature, double humidity,
                                   double pressure, double windSpeed,
                                   int windDirection, double precipitation) {
            this.timestamp = timestamp;
            this.stationId = stationId;
            this.temperature = temperature;
            this.humidity = humidity;
            this.pressure = pressure;
            this.windSpeed = windSpeed;
            this.windDirection = windDirection;
            this.precipitation = precipitation;
        }

        public String toJson() {
            return String.format(
                    "{\"timestamp\":\"%s\",\"station_id\":\"%s\"," +
                    "\"temperature\":%.1f,\"humidity\":%.1f," +
                    "\"pressure\":%.1f,\"wind_speed\":%.1f," +
                    "\"wind_direction\":%d,\"precipitation\":%.2f}",
                    timestamp, stationId, temperature, humidity,
                    pressure, windSpeed, windDirection, precipitation
            );
        }

        public String toCsv() {
            return String.format("%s,%s,%.1f,%.1f,%.1f,%.1f,%d,%.2f",
                    timestamp, stationId, temperature, humidity,
                    pressure, windSpeed, windDirection, precipitation);
        }

        @Override
        public String toString() {
            return String.format("[%s] T=%.1f°C, H=%.1f%%, P=%.1fhPa, " +
                    "Wind=%.1fm/s@%d°, Precip=%.2fmm",
                    stationId, temperature, humidity, pressure,
                    windSpeed, windDirection, precipitation);
        }
    }

    /**
     * Режим отправки по сокету
     */
    public void runSocketMode(int port, int intervalMs) {
        System.out.printf("Starting socket mode on port %d, interval %dms%n",
                port, intervalMs);

        try (ServerSocket serverSocket = new ServerSocket(port)) {
            System.out.println("Waiting for connection...");
            Socket clientSocket = serverSocket.accept();
            System.out.println("Client connected: " +
                    clientSocket.getInetAddress());

            PrintWriter out = new PrintWriter(
                    clientSocket.getOutputStream(), true);

            while (!Thread.currentThread().isInterrupted()) {
                WeatherMeasurement m = generateMeasurement();
                out.println(m.toJson());
                System.out.println("Sent: " + m);
                Thread.sleep(intervalMs);
            }

        } catch (IOException | InterruptedException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }

    /**
     * Режим записи в файл
     */
    public void runFileMode(String outputDir, int intervalMs) {
        System.out.printf("Starting file mode, output: %s, interval: %dms%n",
                outputDir, intervalMs);

        File dir = new File(outputDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        try {
            while (!Thread.currentThread().isInterrupted()) {
                WeatherMeasurement m = generateMeasurement();

                String date = m.timestamp.substring(0, 10);
                String filename = String.format("%s/weather_%s_%s.csv",
                        outputDir, stationId, date);

                File file = new File(filename);
                boolean writeHeader = !file.exists();

                try (FileWriter fw = new FileWriter(filename, true);
                     PrintWriter pw = new PrintWriter(fw)) {

                    if (writeHeader) {
                        pw.println("timestamp,station_id,temperature,humidity," +
                                "pressure,wind_speed,wind_direction,precipitation");
                    }
                    pw.println(m.toCsv());
                }

                System.out.println("Wrote: " + m);
                Thread.sleep(intervalMs);
            }
        } catch (IOException | InterruptedException e) {
            System.err.println("Error: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        // Парсинг аргументов
        String mode = "file";
        String output = "./weather_output";
        int port = 9999;
        int interval = 5000;
        String stationId = "WS001";

        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--mode":
                    mode = args[++i];
                    break;
                case "--output":
                    output = args[++i];
                    break;
                case "--port":
                    port = Integer.parseInt(args[++i]);
                    break;
                case "--interval":
                    interval = Integer.parseInt(args[++i]) * 1000;
                    break;
                case "--station":
                    stationId = args[++i];
                    break;
            }
        }

        // Создание эмулятора
        WeatherStationEmulator emulator = new WeatherStationEmulator(
                stationId, "Test Station",
                55.7558, 37.6173, 156,
                -5.0, 8.0
        );

        // Обработка завершения
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\nShutting down...");
        }));

        // Запуск
        switch (mode) {
            case "socket":
                emulator.runSocketMode(port, interval);
                break;
            case "file":
                emulator.runFileMode(output, interval);
                break;
            default:
                System.err.println("Unknown mode: " + mode);
                System.exit(1);
        }
    }
}
