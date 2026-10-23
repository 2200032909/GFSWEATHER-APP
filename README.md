# GFSWeatherApp (C# / ASP.NET Core MVC, .NET 8)

Downloads NOAA GFS 0.25 files (APCP surface + 10 m wind) from NOMADS for
lon 78-82, lat 11-15, decodes the GRIB2 files in pure C# (no Python, no native
libraries), and shows animated rain + wind on a Leaflet map (OpenStreetMap tiles).
Structure: Controllers/ (HomeController = page, WeatherController = /api), Views/Home/Index.cshtml,
wwwroot/js/map.js, wwwroot/css/site.css, Services/ (download + GRIB2 decoder).

## Requirements
- .NET 8 SDK  (https://dotnet.microsoft.com/download)
- Visual Studio 2022 or VS Code (C# Dev Kit)
- Internet access (NOMADS + map tiles)

## Run
Visual Studio: open GFSWeatherApp.sln, press F5.
Command line:
    cd GFSWeatherApp.Web
    dotnet run
Open http://localhost:5080, leave "Latest run" and press "Download and build".
Progress is shown at the top; the map loads when all steps are decoded.

## Settings (GFSWeatherApp.Web/appsettings.json -> "Gfs")
LeftLon, RightLon, TopLat, BottomLat, FirstHour (1), LastHour (90), DelayMs.
Downloaded files and weather.json are stored in GFSWeatherApp.Web/data/.

## API
GET  /api/status      job progress
POST /api/download    ?date=yyyyMMdd&cycle=00|06|12|18  (omit both for latest run)
GET  /api/weather     processed JSON used by the map

## Notes
- APCP does not exist at f000, so downloads start at f001.
- APCP is accumulated; the app converts it to mm per hour.
- Decoder supports GRIB2 packing 5.0, 5.2, 5.3 (what GFS uses). JPEG2000 (5.40)
  is not supported and gives a clear error message.
