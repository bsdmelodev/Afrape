import { redirect } from "next/navigation";

export default function LegacyMonitoringPage() {
  redirect("/monitoring/overview");
}
