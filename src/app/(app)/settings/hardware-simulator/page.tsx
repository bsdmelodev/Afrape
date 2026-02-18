import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { HardwareSimulator } from "../../monitoring/components/hardware-simulator";

export default async function HardwareSimulatorPage() {
  await requirePermission(MONITORING_PERMISSIONS.HARDWARE_SIMULATOR);

  const [rooms, devices, students] = await Promise.all([
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.device.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, roomId: true, isActive: true },
    }),
    prisma.student.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Simulação • Simulador de Hardware</h1>
        <p className="text-sm text-muted-foreground">
          Simule eventos RFID e leituras de sensores, com parâmetros atualizados a cada 10 segundos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulador</CardTitle>
        </CardHeader>
        <CardContent>
          <HardwareSimulator
            rooms={rooms}
            students={students}
            portariaDevices={devices.filter((device) => device.type === "PORTARIA")}
            salaDevices={devices.filter((device) => device.type === "SALA")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
