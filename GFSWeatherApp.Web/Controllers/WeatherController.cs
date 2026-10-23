using GFSWeatherApp.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace GFSWeatherApp.Web.Controllers;

[ApiController]
[Route("api")]
public class WeatherController : ControllerBase
{
    private readonly JobService _job;
    public WeatherController(JobService job) => _job = job;

    [HttpGet("status")]
    public IActionResult Status() => Ok(_job.Status);

    // POST /api/download?date=yyyyMMdd&cycle=00|06|12|18   (omit both = latest run)
    [HttpPost("download")]
    public IActionResult Download([FromQuery] string? date, [FromQuery] string? cycle)
    {
        if (!_job.TryStart(date, cycle, out var error)) return BadRequest(new { error });
        return Ok(_job.Status);
    }

    [HttpGet("weather")]
    public IActionResult Weather() =>
        System.IO.File.Exists(_job.WeatherPath)
            ? PhysicalFile(_job.WeatherPath, "application/json")
            : NotFound();
}
