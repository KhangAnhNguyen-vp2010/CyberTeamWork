import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("", "routes/index.tsx"),
  route("login", "routes/home.tsx"),
  route("auth/google/callback", "routes/auth/google-callback.tsx"),
  route("admin", "routes/admin.tsx"),
  route("management", "routes/management.tsx"),
  route("app", "routes/app.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
