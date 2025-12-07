package ru.meteo.mapreduce;

import org.apache.hadoop.util.ProgramDriver;

/**
 * Driver-класс для запуска различных MapReduce задач анализа метеоданных
 *
 * Примеры использования:
 *
 * 1. Поиск экстремумов температуры:
 *    hadoop jar weather-mapreduce.jar extremes /input /output
 *
 * 2. Обнаружение аномалий:
 *    hadoop jar weather-mapreduce.jar anomalies /input /output
 *
 * 3. Расчёт среднесуточных показателей:
 *    hadoop jar weather-mapreduce.jar daily /input /output
 */
public class WeatherAnalysisDriver {

    public static void main(String[] args) {
        int exitCode = -1;
        ProgramDriver pgd = new ProgramDriver();

        try {
            // Регистрация доступных MapReduce задач
            pgd.addClass("extremes", TemperatureExtremesJob.class,
                    "Поиск экстремумов температуры (min/max/avg) по станциям");

            pgd.addClass("anomalies", WeatherAnomalyDetectionJob.class,
                    "Обнаружение климатических аномалий");

            pgd.addClass("daily", DailyAveragesJob.class,
                    "Расчёт среднесуточных показателей по станциям");

            exitCode = pgd.run(args);
        } catch (Throwable e) {
            e.printStackTrace();
        }

        System.exit(exitCode);
    }
}
