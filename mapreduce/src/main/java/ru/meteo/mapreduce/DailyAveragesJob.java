package ru.meteo.mapreduce;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.conf.Configured;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.io.Writable;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.util.Tool;
import org.apache.hadoop.util.ToolRunner;

import java.io.DataInput;
import java.io.DataOutput;
import java.io.IOException;

/**
 * MapReduce Job: Расчёт среднесуточных показателей по станциям
 *
 * Алгоритм:
 * - MAP: Парсинг CSV, извлечение даты+station_id и всех показателей
 * - COMBINER: Локальная агрегация для уменьшения сетевого трафика
 * - REDUCE: Финальный расчёт средних значений
 *
 * Пример запуска:
 * hadoop jar weather-mapreduce-1.0.jar ru.meteo.mapreduce.DailyAveragesJob \
 *   /meteo-data/raw/2024/ /meteo-data/analytics/daily_averages
 */
public class DailyAveragesJob extends Configured implements Tool {

    /**
     * Custom Writable для хранения агрегированных значений
     */
    public static class WeatherAggregateWritable implements Writable {
        private double tempSum;
        private double humiditySum;
        private double pressureSum;
        private double windSpeedSum;
        private double precipitationSum;
        private int count;

        public WeatherAggregateWritable() {
            this.tempSum = 0;
            this.humiditySum = 0;
            this.pressureSum = 0;
            this.windSpeedSum = 0;
            this.precipitationSum = 0;
            this.count = 0;
        }

        public WeatherAggregateWritable(double temp, double humidity, double pressure,
                                        double windSpeed, double precipitation) {
            this.tempSum = temp;
            this.humiditySum = humidity;
            this.pressureSum = pressure;
            this.windSpeedSum = windSpeed;
            this.precipitationSum = precipitation;
            this.count = 1;
        }

        public void add(WeatherAggregateWritable other) {
            this.tempSum += other.tempSum;
            this.humiditySum += other.humiditySum;
            this.pressureSum += other.pressureSum;
            this.windSpeedSum += other.windSpeedSum;
            this.precipitationSum += other.precipitationSum;
            this.count += other.count;
        }

        @Override
        public void write(DataOutput out) throws IOException {
            out.writeDouble(tempSum);
            out.writeDouble(humiditySum);
            out.writeDouble(pressureSum);
            out.writeDouble(windSpeedSum);
            out.writeDouble(precipitationSum);
            out.writeInt(count);
        }

        @Override
        public void readFields(DataInput in) throws IOException {
            tempSum = in.readDouble();
            humiditySum = in.readDouble();
            pressureSum = in.readDouble();
            windSpeedSum = in.readDouble();
            precipitationSum = in.readDouble();
            count = in.readInt();
        }

        public String toAveragesString() {
            if (count == 0) return "N/A";
            return String.format("temp_avg=%.2f,humidity_avg=%.2f,pressure_avg=%.2f," +
                    "wind_speed_avg=%.2f,precipitation_total=%.2f,measurements=%d",
                    tempSum / count,
                    humiditySum / count,
                    pressureSum / count,
                    windSpeedSum / count,
                    precipitationSum,  // total, not average
                    count);
        }

        // Getters
        public double getTempSum() { return tempSum; }
        public double getHumiditySum() { return humiditySum; }
        public double getPressureSum() { return pressureSum; }
        public double getWindSpeedSum() { return windSpeedSum; }
        public double getPrecipitationSum() { return precipitationSum; }
        public int getCount() { return count; }
    }

    /**
     * Mapper: Извлекает дату, station_id и показатели
     * Input: CSV строка
     * Output: (date|station_id, WeatherAggregateWritable)
     */
    public static class DailyMapper extends Mapper<LongWritable, Text, Text, WeatherAggregateWritable> {

        private final Text compositeKey = new Text();

        @Override
        protected void map(LongWritable key, Text value, Context context)
                throws IOException, InterruptedException {

            String line = value.toString();

            if (line.startsWith("timestamp")) {
                return;
            }

            try {
                String[] fields = line.split(",");

                if (fields.length >= 8) {
                    // Извлекаем дату из timestamp (YYYY-MM-DD из YYYY-MM-DDTHH:MM:SSZ)
                    String date = fields[0].trim().substring(0, 10);
                    String stationId = fields[1].trim();

                    double temperature = Double.parseDouble(fields[2].trim());
                    double humidity = Double.parseDouble(fields[3].trim());
                    double pressure = Double.parseDouble(fields[4].trim());
                    double windSpeed = Double.parseDouble(fields[5].trim());
                    double precipitation = Double.parseDouble(fields[7].trim());

                    // Составной ключ: дата|станция
                    compositeKey.set(date + "|" + stationId);

                    WeatherAggregateWritable aggregate = new WeatherAggregateWritable(
                            temperature, humidity, pressure, windSpeed, precipitation);

                    context.write(compositeKey, aggregate);
                }
            } catch (Exception e) {
                context.getCounter("Errors", "ParseError").increment(1);
            }
        }
    }

    /**
     * Combiner: Локальная агрегация на узле
     */
    public static class DailyCombiner extends Reducer<Text, WeatherAggregateWritable, Text, WeatherAggregateWritable> {

        @Override
        protected void reduce(Text key, Iterable<WeatherAggregateWritable> values, Context context)
                throws IOException, InterruptedException {

            WeatherAggregateWritable combined = new WeatherAggregateWritable();

            for (WeatherAggregateWritable val : values) {
                combined.add(val);
            }

            context.write(key, combined);
        }
    }

    /**
     * Reducer: Финальный расчёт средних
     */
    public static class DailyReducer extends Reducer<Text, WeatherAggregateWritable, Text, Text> {

        private final Text result = new Text();

        @Override
        protected void reduce(Text key, Iterable<WeatherAggregateWritable> values, Context context)
                throws IOException, InterruptedException {

            WeatherAggregateWritable total = new WeatherAggregateWritable();

            for (WeatherAggregateWritable val : values) {
                total.add(val);
            }

            result.set(total.toAveragesString());
            context.write(key, result);
        }
    }

    @Override
    public int run(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: DailyAveragesJob <input path> <output path>");
            return -1;
        }

        Configuration conf = getConf();
        Job job = Job.getInstance(conf, "Weather Daily Averages");

        job.setJarByClass(DailyAveragesJob.class);
        job.setMapperClass(DailyMapper.class);
        job.setCombinerClass(DailyCombiner.class);
        job.setReducerClass(DailyReducer.class);

        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(WeatherAggregateWritable.class);
        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);

        FileInputFormat.addInputPath(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        return job.waitForCompletion(true) ? 0 : 1;
    }

    public static void main(String[] args) throws Exception {
        int exitCode = ToolRunner.run(new Configuration(), new DailyAveragesJob(), args);
        System.exit(exitCode);
    }
}
