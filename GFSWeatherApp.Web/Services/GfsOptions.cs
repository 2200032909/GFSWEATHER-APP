namespace GFSWeatherApp.Web.Services;

public sealed class GfsOptions
{
    public double LeftLon { get; set; } = 78;
    public double RightLon { get; set; } = 82;
    public double TopLat { get; set; } = 15;
    public double BottomLat { get; set; } = 11;
    public int FirstHour { get; set; } = 1;   // APCP does not exist at f000
    public int LastHour { get; set; } = 90;
    public int DelayMs { get; set; } = 1000;  // be polite to NOMADS
}
