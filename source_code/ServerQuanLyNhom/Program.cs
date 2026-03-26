
using Microsoft.EntityFrameworkCore;
using ServerQuanLyNhom.Middleware;
using ServerQuanLyNhom.Models;
using ServerQuanLyNhom.Services;
using ServerQuanLyNhom.Services.Email;

namespace ServerQuanLyNhom
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.AddDbContext<QuanLyCongViecNhomContext>(options =>
     options.UseSqlServer(builder.Configuration.GetConnectionString("MyDatabase")));
            builder.Services.AddSingleton<OtpService>();

            // Cache
            builder.Services.AddMemoryCache();

            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = "localhost:6379"; // hoặc "your_redis_server:port"
                options.InstanceName = "MyApp_"; // prefix cho key
            });


            // Email service
            builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
            builder.Services.AddScoped<EmailService>();

            // Add custom CORS
            builder.Services.AddCustomCors();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }
            app.UseStaticFiles(); // cho phép truy c?p file t?nh

            //app.UseHttpsRedirection();

            app.UseAuthorization();

            // Use custom CORS
            app.UseCustomCors();

            app.MapControllers();

            app.Run();
        }
    }
}
