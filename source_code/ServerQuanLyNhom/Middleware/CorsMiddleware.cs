namespace ServerQuanLyNhom.Middleware
{
    public static class CorsMiddleware
    {
        public static IServiceCollection AddCustomCors(this IServiceCollection services)
        {
            services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend",
                    policy =>
                    {
                        policy.WithOrigins("http://localhost:5173", "http://localhost:5174") // frontend
                              .AllowAnyHeader()
                              .AllowAnyMethod()
                              .AllowCredentials()
                              .WithExposedHeaders("Content-Disposition");
                    });
            });

            return services;
        }

        public static IApplicationBuilder UseCustomCors(this IApplicationBuilder app)
        {
            app.UseCors("AllowFrontend");
            return app;
        }
    }
}
