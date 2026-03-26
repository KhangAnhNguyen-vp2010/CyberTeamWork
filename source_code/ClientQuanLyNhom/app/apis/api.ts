// src/api.ts
import axios from "axios";

// Backend có [Route("api/[controller]")]
// Nếu VITE_API_URL đã có /api thì dùng trực tiếp, không thì thêm /api
const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:7036";
const apiBaseUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // bật nếu bạn dùng cookie JWT
});

export default api;
