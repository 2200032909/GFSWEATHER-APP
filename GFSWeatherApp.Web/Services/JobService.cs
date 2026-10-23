using System.Text.Json;
using Microsoft.Extensions.Options;

namespace GFSWeatherApp.Web.Services;

public sealed record JobStatus(string State, string Run, int Done, int Total, string Message);

public sealed class JobService
{
    private readonly GfsDownloader _dl;
    private readonly GfsOptions _o;
    private readonly string _root;
    private readonly object _lock = new();
    private JobStatus _status = new("Idle", "", 0, 0, "Ready");

    public JobService(GfsDownloader dl, IOptions<GfsOptions> o, IWebHostEnvironment env)
    {
        _dl = dl; _o = o.Value;
        _root = Path.Combine(env.ContentRootPath, "data");
        Directory.CreateDirectory(_root);
    }

    public string WeatherPath => Path.Combine(_root, "weather.json");
    public JobStatus Status { get { lock (_lock) return _status; } }

    private void Set(string state, string run, int done, int total, string msg)
    {
        lock (_lock) _status = new JobStatus(state, run, done, total, msg);
    }

    public bool TryStart(string? date, string? cycle, out string error)
    {
        error = "";
        if (!string.IsNullOrWhiteSpace(cycle) && !new[] { "00", "06", "12", "18" }.Contains(cycle))
        { error = "Cycle must be 00, 06, 12 or 18."; return false; }
        if (!string.IsNullOrWhiteSpace(date) && (date.Length != 8 || !date.All(char.IsDigit)))
        { error = "Date must be yyyyMMdd."; return false; }
        if (!string.IsNullOrWhiteSpace(date) && string.IsNullOrWhiteSpace(cycle))
        { error = "Choose a cycle together with the date."; return false; }

        lock (_lock)
        {
            if (_status.State is "Downloading" or "Processing") { error = "A job is already running."; return false; }
            _status = new JobStatus("Downloading", "", 0, 0, "Starting...");
        }
        if (string.IsNullOrWhiteSpace(date) && !string.IsNullOrWhiteSpace(cycle))
            date = DateTime.UtcNow.ToString("yyyyMMdd");

        _ = Task.Run(() => RunAsync(date, cycle));
        return true;
    }

    //private async Task RunAsync(string? date, string? cycle)
    //{
    //    var ct = CancellationToken.None;
    //    try
    //    {
    //        var candidates = new List<(string d, string c)>();
    //        if (!string.IsNullOrWhiteSpace(date) && !string.IsNullOrWhiteSpace(cycle)) candidates.Add((date, cycle));
    //        else
    //        {
    //            var t = DateTime.UtcNow.AddHours(-4);   // a run is published a few hours after its cycle time
    //            var b = new DateTime(t.Year, t.Month, t.Day, t.Hour / 6 * 6, 0, 0, DateTimeKind.Utc);
    //            for (int i = 0; i < 4; i++) { var r = b.AddHours(-6 * i); candidates.Add((r.ToString("yyyyMMdd"), r.Hour.ToString("00"))); }
    //        }

    //        string? d = null, c = null, dir = null;
    //        foreach (var (cd, cc) in candidates)
    //        {
    //            Set("Downloading", $"{cd} {cc}Z", 0, 0, $"Checking run {cd} {cc}Z...");
    //            var tryDir = Path.Combine(_root, $"{cd}_{cc}");
    //            if (await _dl.DownloadAsync(cd, cc, _o.FirstHour, tryDir, ct, attempts: 1)) { d = cd; c = cc; dir = tryDir; break; }
    //        }
    //        if (d == null || c == null || dir == null)
    //        { Set("Failed", "", 0, 0, "No published GFS run found. Try again later or pick an earlier date/cycle."); return; }

    //        int total = _o.LastHour - _o.FirstHour + 1, done = 1, failed = 0;
    //        string run = $"{d} {c}Z";
    //        Set("Downloading", run, done, total, $"Downloaded f{_o.FirstHour:000}");
    //        for (int fh = _o.FirstHour + 1; fh <= _o.LastHour; fh++)
    //        {
    //            await Task.Delay(_o.DelayMs, ct);
    //            if (!await _dl.DownloadAsync(d, c, fh, dir, ct)) failed++;
    //            done++;
    //            Set("Downloading", run, done, total, $"Downloaded f{fh:000}" + (failed > 0 ? $" ({failed} failed)" : ""));
    //        }

    //        Set("Processing", run, total, total, "Decoding GRIB2 files...");

    //        // Build the weather data from the downloaded GRIB2 files

    //        var data = await Task.Run(() => WeatherBuilder.Build(dir, d, c, _o.FirstHour, _o.LastHour));

    //        if (data.Hours.Count == 0) { Set("Failed", run, total, total, "No usable data found in the downloaded files."); return; }

    //        await File.WriteAllTextAsync(WeatherPath, JsonSerializer.Serialize(data, new JsonSerializerOptions(JsonSerializerDefaults.Web)), ct);
    //        Set("Done", run, total, total, $"{data.Hours.Count} forecast steps ready" + (failed > 0 ? $", {failed} files missing" : ""));
    //    }
    //    catch (Exception ex)
    //    {
    //        Set("Failed", "", 0, 0, ex.Message);
    //    }
    //}

    private async Task RunAsync(string? date, string? cycle)
    {
        var ct = CancellationToken.None;

        try
        {
            var candidates = new List<(string d, string c)>();

            if (!string.IsNullOrWhiteSpace(date) &&
                !string.IsNullOrWhiteSpace(cycle))
            {
                candidates.Add((date, cycle));
            }
            else
            {
                var t = DateTime.UtcNow.AddHours(-4);
                var b = new DateTime(
                    t.Year, t.Month, t.Day,
                    t.Hour / 6 * 6, 0, 0,
                    DateTimeKind.Utc);

                for (int i = 0; i < 4; i++)
                {
                    var r = b.AddHours(-6 * i);
                    candidates.Add((
                        r.ToString("yyyyMMdd"),
                        r.Hour.ToString("00")));
                }
            }

            string? d = null;
            string? c = null;
            string? dir = null;
            bool useExistingFiles = false;

            // First check whether the selected run already exists locally.
            foreach (var (cd, cc) in candidates)
            {
                var existingDir = Path.Combine(_root, $"{cd}_{cc}");

                if (Directory.Exists(existingDir) &&
                    Directory.GetFiles(existingDir).Length > 0)
                {
                    d = cd;
                    c = cc;
                    dir = existingDir;
                    useExistingFiles = true;

                    Set(
                        "Processing",
                        $"{cd} {cc}Z",
                        0,
                        0,
                        "Using existing files. Preparing to build weather data..."
                    );

                    break;
                }
            }

            // If no existing run folder was found, download as before.
            if (!useExistingFiles)
            {
                foreach (var (cd, cc) in candidates)
                {
                    Set(
                        "Downloading",
                        $"{cd} {cc}Z",
                        0,
                        0,
                        $"Checking run {cd} {cc}Z..."
                    );

                    var tryDir = Path.Combine(_root, $"{cd}_{cc}");

                    if (await _dl.DownloadAsync(
                        cd, cc, _o.FirstHour, tryDir, ct, attempts: 1))
                    {
                        d = cd;
                        c = cc;
                        dir = tryDir;
                        break;
                    }
                }
            }

            if (d == null || c == null || dir == null)
            {
                Set(
                    "Failed", "", 0, 0,
                    "No published GFS run found. Try again later or pick an earlier date/cycle."
                );
                return;
            }

            string run = $"{d} {c}Z";

            if (useExistingFiles)
            {
                Set(
                    "Processing", run, 0, 0,
                    $"Building from existing files in {dir}..."
                );
            }
            else
            {
                int total = _o.LastHour - _o.FirstHour + 1;
                int done = 1;
                int failed = 0;

                Set(
                    "Downloading", run, done, total,
                    $"Downloaded f{_o.FirstHour:000}"
                );

                for (int fh = _o.FirstHour + 1;
                     fh <= _o.LastHour;
                     fh++)
                {
                    await Task.Delay(_o.DelayMs, ct);

                    if (!await _dl.DownloadAsync(
                        d, c, fh, dir, ct))
                    {
                        failed++;
                    }

                    done++;

                    Set(
                        "Downloading", run, done, total,
                        $"Downloaded f{fh:000}" +
                        (failed > 0 ? $" ({failed} failed)" : "")
                    );
                }
            }

            // Build the weather data from the selected run's files.
            int fileCount = Directory.GetFiles(dir).Length;

            Set(
                "Processing", run, fileCount, fileCount,
                useExistingFiles
                    ? "Decoding existing GRIB2 files..."
                    : "Decoding downloaded GRIB2 files..."
            );

            var data = await Task.Run(
                () => WeatherBuilder.Build(
                    dir, d, c, _o.FirstHour, _o.LastHour));

            if (data.Hours.Count == 0)
            {
                Set(
                    "Failed", run, fileCount, fileCount,
                    "No usable data found. Check the GRIB2 files in " + dir
                );
                return;
            }

            await File.WriteAllTextAsync(
                WeatherPath,
                JsonSerializer.Serialize(
                    data,
                    new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                ct);

            Set(
                "Done", run, fileCount, fileCount,
                $"{data.Hours.Count} forecast steps ready" +
                (useExistingFiles
                    ? " (built from existing files)"
                    : "")
            );
        }
        catch (Exception ex)
        {
            Set("Failed", "", 0, 0, ex.Message);
        }
    }

}
