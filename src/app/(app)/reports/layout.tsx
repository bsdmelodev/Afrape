import { ReactNode } from "react";
import { hasPermission, requireAnyPermission } from "@/lib/rbac";
import { reportDefinitions, reportPermissions } from "./definitions";
import { ReportsNav } from "./components/reports-nav";

export default async function ReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAnyPermission(reportPermissions);

  const links = reportDefinitions
    .filter((item) => hasPermission(user, item.permission))
    .map((item) => ({ href: item.href, label: item.label }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Consulte dados consolidados com filtros por módulo.
        </p>
      </div>

      <ReportsNav links={links} />

      {children}
    </div>
  );
}
