using Microsoft.AspNetCore.Mvc;

namespace GFSWeatherApp.Web.Controllers;

public class HomeController : Controller
{
    public IActionResult Index() => View();
}
