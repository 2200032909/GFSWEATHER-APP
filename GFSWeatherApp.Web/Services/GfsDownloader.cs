using System.Globalization;
using Microsoft.Extensions.Options;

namespace GFSWeatherApp.Web.Services;

public sealed class GfsDownloader
{
    private readonly HttpClient _http;
    private readonly GfsOptions _o;

    public GfsDownloader(IOptions<GfsOptions> options)
    {
        _o = options.Value;
        _http = new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(2) })
        {
            Timeout = TimeSpan.FromSeconds(90)
        };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("GFSWeatherApp/1.0");
    }

    public static string FileName(string cycle, int fh) => $"gfs.t{cycle}z.pgrb2.0p25.f{fh:000}";

    public string BuildUrl(string date, string cycle, int fh)
    {
        string N(double v) => v.ToString(CultureInfo.InvariantCulture);
        return "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"
             + $"?dir=%2Fgfs.{date}%2F{cycle}%2Fatmos&file={FileName(cycle, fh)}"
             + "&var_APCP=on&lev_surface=on"
             + "&var_UGRD=on&var_VGRD=on&lev_10_m_above_ground=on"
             + $"&subregion=&toplat={N(_o.TopLat)}&leftlon={N(_o.LeftLon)}&rightlon={N(_o.RightLon)}&bottomlat={N(_o.BottomLat)}";
    }

    /// Returns true if the file is on disk (already there or freshly downloaded).
    public async Task<bool> DownloadAsync(string date, string cycle, int fh, string dir, CancellationToken ct, int attempts = 3)
    {
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, FileName(cycle, fh));
        if (File.Exists(path) && new FileInfo(path).Length > 100) return true;

        for (int a = 1; a <= attempts; a++)
        {
            try
            {
                using var resp = await _http.GetAsync(BuildUrl(date, cycle, fh), ct);
                var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
                if (resp.IsSuccessStatusCode && bytes.Length > 100 &&
                    bytes[0] == 'G' && bytes[1] == 'R' && bytes[2] == 'I' && bytes[3] == 'B')
                {
                    await File.WriteAllBytesAsync(path, bytes, ct);
                    return true;
                }
            }
            catch (HttpRequestException) { }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested) { }

            if (a < attempts) await Task.Delay(3000 * a, ct);
        }
        return false;
    }
}
