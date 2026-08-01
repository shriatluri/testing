import { redirect } from "next/navigation";

// The dashboard now lives at the root — keep old links working.
export default function DashboardRedirect() {
  redirect("/");
}
