import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { LiveRefresh } from "../components/live-refresh";
import { PortariaTable } from "../components/portaria-table";
import type { DeviceRow } from "../types";

export const dynamic = "force-dynamic";

export default async function MonitoringPortariasPage() {
  const user = await requirePermission(MONITORING_PERMISSIONS.VIEW);
  const canManage = hasPermission(user, MONITORING_PERMISSIONS.MANAGE);

  const rows: DeviceRow[] = (
    await prisma.device.findMany({
      where: { type: "PORTARIA" },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        roomId: true,
        isActive: true,
        createdAt: true,
      },
    })
  ).map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    roomId: device.roomId,
    roomName: null,
    isActive: device.isActive,
    createdAt: formatDate(device.createdAt),
  }));

  const activeCount = rows.filter((item) => item.isActive).length;

  return (
    <div className="space-y-6">
      <LiveRefresh intervalMs={2000} pauseWhenInteracting />

      <div>
        <h1 className="text-2xl font-semibold">Monitoramento • Portarias</h1>
        <p className="text-sm text-muted-foreground">
          Devices RFID para controle de acesso (ALLOW/DENY).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Badge variant="default">Ativas: {activeCount}</Badge>
          <Badge variant="outline">Total: {rows.length}</Badge>
        </CardContent>
      </Card>

      <PortariaTable data={rows} canManage={canManage} />
    </div>
  );
}
