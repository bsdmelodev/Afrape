import { redirect } from "next/navigation";
import { hasPermission, requireAnyPermission } from "@/lib/rbac";
import { reportDefinitions, reportPermissions } from "./definitions";

export default async function ReportsPage() {
  const user = await requireAnyPermission(reportPermissions);
  const firstAllowed = reportDefinitions.find((item) => hasPermission(user, item.permission));

  if (!firstAllowed) {
    throw new Error("Você não tem permissão para visualizar relatórios.");
  }

  redirect(firstAllowed.href);
}
