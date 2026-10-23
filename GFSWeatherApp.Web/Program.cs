using GFSWeatherApp.Web.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<GfsOptions>(builder.Configuration.GetSection("Gfs"));
builder.Services.AddSingleton<GfsDownloader>();
builder.Services.AddSingleton<JobService>();
builder.Services.AddControllersWithViews();

var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");
app.Run();
