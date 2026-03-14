import { AdminPage } from "@/components/admin/admin-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — FeedSilo" };
export const dynamic = "force-dynamic";

export default function AdminRoute() {
  return <AdminPage />;
}
