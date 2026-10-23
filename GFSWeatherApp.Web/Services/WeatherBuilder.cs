namespace GFSWeatherApp.Web.Services;

public sealed class WeatherData
{
    public string Run { get; set; } = "";
    public List<int> Hours { get; set; } = new();
    public double[] Lats { get; set; } = Array.Empty<double>();
    public double[] Lons { get; set; } = Array.Empty<double>();
    public List<float[][]> Rain { get; set; } = new();   // mm per hour [step][lat][lon]
    public List<float[][]> U { get; set; } = new();      // 10 m wind, m/s
    public List<float[][]> V { get; set; } = new();
}

public static class WeatherBuilder
{
    public static WeatherData Build(string dir, string date, string cycle, int firstHour, int lastHour)
    {
        var data = new WeatherData { Run = $"{date[..4]}-{date[4..6]}-{date[6..8]}T{cycle}:00:00Z" };
        float[][]? prev = null;
        int prevAh = 0;

        for (int fh = firstHour; fh <= lastHour; fh++)
        {
            var path = Path.Combine(dir, GfsDownloader.FileName(cycle, fh));
            if (!File.Exists(path)) continue;

            var fields = Grib2Reader.Read(File.ReadAllBytes(path));
            var acc = fields.FirstOrDefault(f => f.Is(0, 1, 8));   // APCP
            if (acc == null) continue;
            var uf = fields.FirstOrDefault(f => f.Is(0, 2, 2));    // UGRD
            var vf = fields.FirstOrDefault(f => f.Is(0, 2, 3));    // VGRD

            if (data.Lats.Length == 0) { data.Lats = acc.Lats(); data.Lons = acc.Lons(); }

            var a = acc.ToGrid();
            // GFS APCP is accumulated in 6 h buckets (f001=0-1h ... f006=0-6h, f007=6-7h ...)
            int ah = acc.AccHours ?? ((fh - 1) % 6 + 1);
            //Calculate hourly rainfall
            float[][] hourly = (ah <= 1 || prev == null || prevAh != ah - 1) ? Copy(a) : Subtract(a, prev);
            prev = a; prevAh = ah;

            data.Hours.Add(fh);
            data.Rain.Add(Round(hourly));
            data.U.Add(uf != null ? Round(uf.ToGrid()) : Zeros(a));
            data.V.Add(vf != null ? Round(vf.ToGrid()) : Zeros(a));
        }
        return data;
    }

    private static float[][] Copy(float[][] g) => g.Select(r => (float[])r.Clone()).ToArray();

    private static float[][] Subtract(float[][] a, float[][] b) =>
        a.Select((r, j) => r.Select((v, i) => Math.Max(0f, v - b[j][i])).ToArray()).ToArray();

    private static float[][] Zeros(float[][] like) => like.Select(r => new float[r.Length]).ToArray();

    private static float[][] Round(float[][] g) =>
        g.Select(r => r.Select(v => float.IsNaN(v) ? 0f : MathF.Round(v * 100f) / 100f).ToArray()).ToArray();
}
