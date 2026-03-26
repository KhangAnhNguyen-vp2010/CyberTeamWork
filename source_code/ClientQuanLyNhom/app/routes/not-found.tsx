import NotFoundPage from "~/pages/notFound";

export function meta() {
  return [{ title: "CyberTeamWork | Không tìm thấy trang" }];
}

export default function NotFoundRoute() {
  return <NotFoundPage />;
}
