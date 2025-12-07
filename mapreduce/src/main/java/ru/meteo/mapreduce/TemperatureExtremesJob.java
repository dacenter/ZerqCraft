package ru.meteo.mapreduce;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.conf.Configured;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.DoubleWritable;
import org.apache.hadoop.io.LongWritable;
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
 * MapReduce Job: Поиск экстремумов температуры по станциям
 *
 * Алгоритм:
 * - MAP: Парсинг CSV, извлечение station_id и temperature
 * - REDUCE: Агрегация для поиска min/max температуры по каждой станции
 *
 * Пример запуска:
 * hadoop jar weather-mapreduce-1.0.jar ru.meteo.mapreduce.TemperatureExtremesJob \
 *   /meteo-data/raw/2024/ /meteo-data/analytics/temp_extremes
 */
public class TemperatureExtremesJob extends Configured implements Tool {

    /**
     * Mapper: Извлекает station_id и temperature из CSV
     * Input: CSV строка с метеоданными
     * Output: (station_id, temperature)
     */
    public static class TemperatureMapper extends Mapper<LongWritable, Text, Text, DoubleWritable> {

        private final Text stationId = new Text();
        private final DoubleWritable temperature = new DoubleWritable();

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

                if (fields.length >= 3) {
                    String station = fields[1].trim();
                    double temp = Double.parseDouble(fields[2].trim());

                    stationId.set(station);
                    temperature.set(temp);

                    context.write(stationId, temperature);
                }
            } catch (NumberFormatException e) {
                context.getCounter("Errors", "ParseError").increment(1);
            }
        }
    }

    /**
     * Reducer: Находит min и max температуру для каждой станции
     * Input: (station_id, [temp1, temp2, ...])
     * Output: (station_id, "min=X,max=Y,avg=Z,count=N")
     */
    public static class TemperatureExtremesReducer extends Reducer<Text, DoubleWritable, Text, Text> {

        private final Text result = new Text();

        @Override
        protected void reduce(Text key, Iterable<DoubleWritable> values, Context context)
                throws IOException, InterruptedException {

            double min = Double.MAX_VALUE;
            double max = Double.MIN_VALUE;
            double sum = 0;
            int count = 0;

            for (DoubleWritable val : values) {
                double temp = val.get();
                min = Math.min(min, temp);
                max = Math.max(max, temp);
                sum += temp;
                count++;
            }

            double avg = count > 0 ? sum / count : 0;

            String output = String.format("min=%.1f,max=%.1f,avg=%.2f,count=%d", min, max, avg, count);
            result.set(output);

            context.write(key, result);
        }
    }

    @Override
    public int run(String[] args) throws Exception {
        if (args.length != 2) {
            System.err.println("Usage: TemperatureExtremesJob <input path> <output path>");
            return -1;
        }

        Configuration conf = getConf();
        Job job = Job.getInstance(conf, "Weather Temperature Extremes");

        job.setJarByClass(TemperatureExtremesJob.class);
        job.setMapperClass(TemperatureMapper.class);
        job.setReducerClass(TemperatureExtremesReducer.class);

        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(DoubleWritable.class);
        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);

        FileInputFormat.addInputPath(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        return job.waitForCompletion(true) ? 0 : 1;
    }

    public static void main(String[] args) throws Exception {
        int exitCode = ToolRunner.run(new Configuration(), new TemperatureExtremesJob(), args);
        System.exit(exitCode);
    }
}
