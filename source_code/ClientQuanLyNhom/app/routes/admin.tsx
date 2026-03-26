import { ToastContainer } from "react-toastify";
import AdminLogin from "~/pages/admin/AdminLogin";
import type { Route } from "./+types/admin";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CyberTeamWork Admin" },
    { name: "description", content: "Đăng nhập quản trị CyberTeamWork" },
  ];
}

export default function AdminRoute() {
  return (
    <>
      <AdminLogin />
      
    </>
  );
}
