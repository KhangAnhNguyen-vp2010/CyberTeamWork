import { ToastContainer } from "react-toastify";
import type { Route } from "./+types/management";
import ManagementDashboard from "~/pages/management/ManagementDashboard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "CyberTeamWork Management" },
    { name: "description", content: "Bảng điều khiển quản trị CyberTeamWork" },
  ];
}

export default function ManagementRoute() {
  return <><ManagementDashboard />
  </>
}
