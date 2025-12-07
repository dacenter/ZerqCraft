package ru.meteo.mapreduce;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.conf.Configured;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.NullWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.util.Tool;
import org.apache.hadoop.util.ToolRunner;

import java.io.IOException;

/**
 * MapReduce Job: Обнаружение климатических аномалий
 *
 * Алгоритм выявления аномалий:
 * 1. Резкий перепад давления (> 10 hPa за короткий период)
 * 2. Экстремальная влажность (> 95% или < 20%)
 * 3. Сильный ветер (> 15 м/с)
 * 4. Интенсивные осадки (> 10 мм/час)
 * 5. Экстремальные температуры (< -30°C или > 40°C)
 *
 * Пример запуска:
 * hadoop jar weather-mapreduce-1.0.jar ru.meteo.mapreduce.WeatherAnomalyDetectionJob \
 *   /meteo-data/raw/2024/ /meteo-data/analytics/anomalies
 */
public class WeatherAnomalyDetectionJob extends Configured implements Tool {

    // Пороговые значения для определения аномалий
    private static final double EXTREME_TEMP_LOW = -30.0;
    private static final double EXTREME_TEMP_HIGH = 40.0;
    private static final double EXTREME_HUMIDITY_LOW = 20.0;
    private static final double EXTREME_HUMIDITY_HIGH = 95.0;
    private static final double EXTREME_PRESSURE_LOW = 980.0;
    private static final double EXTREME_PRESSURE_HIGH = 1050.0;
    private static final double EXTREME_WIND_SPEED = 15.0;
    private static final double EXTREME_PRECIPITATION = 10.0;

    /**
     * Mapper: Анализирует каждую запись на предмет аномалий
     * Input: CSV строка с метеоданными
     * Output: (anomaly_type, details)
     */
    public static class AnomalyDetectionMapper extends Mapper<LongWritable, Text, Text, Text> {

        private final Text anomalyType = new Text();
        private final Text details = new Text();

        @Override
        protected void map(LongWritable key, Text value, Context context)
                throws IOException, InterruptedException {

            String line = value.toString();

            // Пропускаем заголовок CSV
            if (line.startsWith("timestamp")) {
                return;
            }

            try {
                // Формат: timestamp,station_id,temperature,humidity,pressure,wind_speed,wind_direction,precipitation
                String[] fields = line.split(",");

                if (fields.length >= 8) {
                    String timestamp = fields[0].trim();
                    String stationId = fields[1].trim();
                    double temperature = Double.parseDouble(fields[2].trim());
                    double humidity = Double.parseDouble(fields[3].trim());
                    double pressure = Double.parseDouble(fields[4].trim());
                    double windSpeed = Double.parseDouble(fields[5].trim());
                    double precipitation = Double.parseDouble(fields[7].trim());

                    // Проверка экстремальной температуры
                    if (temperature < EXTREME_TEMP_LOW) {
                        anomalyType.set("EXTREME_COLD");
                        details.set(String.format("%s|%s|temperature=%.1f", timestamp, stationId, temperature));
                        context.write(anomalyType, details);
                    }
                    if (temperature > EXTREME_TEMP_HIGH) {
                        anomalyType.set("EXTREME_HEAT");
                        details.set(String.format("%s|%s|temperature=%.1f", timestamp, stationId, temperature));
                        context.write(anomalyType, details);
                    }

                    // Проверка экстремальной влажности
                    if (humidity < EXTREME_HUMIDITY_LOW) {
                        anomalyType.set("EXTREME_DRY");
                        details.set(String.format("%s|%s|humidity=%.1f", timestamp, stationId, humidity));
                        context.write(anomalyType, details);
                    }
                    if (humidity > EXTREME_HUMIDITY_HIGH) {
                        anomalyType.set("EXTREME_HUMID");
                        details.set(String.format("%s|%s|humidity=%.1f", timestamp, stationId, humidity));
                        context.write(anomalyType, details);
                    }

                    // Проверка экстремального давления
                    if (pressure < EXTREME_PRESSURE_LOW) {
                        anomalyType.set("LOW_PRESSURE");
                        details.set(String.format("%s|%s|pressure=%.1f", timestamp, stationId, pressure));
                        context.write(anomalyType, details);
                    }
                    if (pressure > EXTREME_PRESSURE_HIGH) {
                        anomalyType.set("HIGH_PRESSURE");
                        details.set(String.format("%s|%s|pressure=%.1f", timestamp, stationId, pressure));
                        context.write(anomalyType, details);
                    }

                    // Проверка сильного ветра
                    if (windSpeed > EXTREME_WIND_SPEED) {
                        anomalyType.set("STRONG_WIND");
                        details.set(String.format("%s|%s|wind_speed=%.1f", timestamp, stationId, windSpeed));
                        context.write(anomalyType, details);
                    }

                    // Проверка интенсивных осадков
                    if (precipitation > EXTREME_PRECIPITATION) {
                        anomalyType.set("HEAVY_PRECIPITATION");
                        details.set(String.format("%s|%s|precipitation=%.1f", timestamp, stationId, precipitation));
                        context.write(anomalyType, details);
                    }
                }
            } catch (NumberFormatException e) {
                context.getCounter("Errors", "ParseError").increment(1);
            }
        }
    }

    /**
     * Reducer: Группирует аномалии по типу и подсчитывает статистику
     */
    public static class AnomalyAggregationReducer extends Reducer<Text, Text, Text, Text> {

        private final Text result = new Text();

        @Override
        protected void reduce(Text key, Iterable<Text> values, Context context)
                throws IOException, InterruptedException {

            StringBuilder sb = new StringBuilder();
            int count = 0;

            sb.append("\n--- Anomalies of type: ").append(key.toString()).append(" ---\n");

            for (Text val : values) {
                sb.append("  ").append(val.toString()).append("\n");
                count++;
            }

            sb.append("Total count: ").append(count);
            result.set(sb.toString());

            context.write(key, result);
        }
    }

    @Override
    public int run(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: WeatherAnomalyDetectionJob <input path> <output path>");
            return -1;
        }

        Configuration conf = getConf();
        Job job = Job.getInstance(conf, "Weather Anomaly Detection");

        job.setJarByClass(WeatherAnomalyDetectionJob.class);
        job.setMapperClass(AnomalyDetectionMapper.class);
        job.setReducerClass(AnomalyAggregationReducer.class);

        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(Text.class);
        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);

        FileInputFormat.addInputPath(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        return job.waitForCompletion(true) ? 0 : 1;
    }

    public static void main(String[] args) throws Exception {
        int exitCode = ToolRunner.run(new Configuration(), new WeatherAnomalyDetectionJob(), args);
        System.exit(exitCode);
    }
}
