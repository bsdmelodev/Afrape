import type { AccessResult } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDecimal, formatTime } from "@/lib/formatters";
import {
  ensureMonitoringSettings,
  evaluateReadingStatus,
  MONITORING_PERMISSIONS,
} from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { LiveRefresh } from "../components/live-refresh";

export const dynamic = "force-dynamic";

function statusLabel(status: "OK" | "ATENCAO" | "CRITICO") {
  if (status === "ATENCAO") return "Atenção";
  if (status === "CRITICO") return "Crítico";
  return "OK";
}

function statusVariant(status: "OK" | "ATENCAO" | "CRITICO") {
  if (status === "CRITICO") return "destructive" as const;
  if (status === "ATENCAO") return "secondary" as const;
  return "default" as const;
}

function accessResultLabel(result: AccessResult) {
  return result === "ALLOW" ? "Permitido" : "Negado";
}

function eventCardUid(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "-";
  const value = (metadata as Record<string, unknown>).cardUid;
  return typeof value === "string" && value.length > 0 ? value : "-";
}

function telemetrySensor(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "-";
  const meta = metadata as Record<string, unknown>;
  const sensorModel = typeof meta.sensorModel === "string" ? meta.sensorModel : null;
  const i2cAddress = typeof meta.i2cAddress === "string" ? meta.i2cAddress : null;
  if (!sensorModel && !i2cAddress) return "-";
  if (sensorModel && i2cAddress) return `${sensorModel} (${i2cAddress})`;
  return sensorModel ?? i2cAddress ?? "-";
}

export default async function MonitoringOverviewPage() {
  await requirePermission(MONITORING_PERMISSIONS.VIEW);

  const [settings, activeRooms, rooms, events] = await Promise.all([
    ensureMonitoringSettings(),
    prisma.room.count({ where: { isActive: true } }),
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        telemetryReadings: {
          take: 1,
          orderBy: { measuredAt: "desc" },
          include: { device: { select: { name: true } } },
        },
      },
    }),
    prisma.accessEvent.findMany({
      take: 10,
      orderBy: { occurredAt: "desc" },
      include: { device: { select: { name: true } } },
    }),
  ]);

  const latestByRoom = rooms
    .map((room) => {
      const reading = room.telemetryReadings[0];
      if (!reading) {
        return {
          roomId: room.id,
          roomName: room.name,
          sensor: null,
          temperature: null,
          humidity: null,
          measuredAt: null,
          status: null,
        };
      }

      const temperature = Number(reading.temperature);
      const humidity = Number(reading.humidity);
      return {
        roomId: room.id,
        roomName: room.name,
        sensor: telemetrySensor(reading.metadata),
        temperature,
        humidity,
        measuredAt: reading.measuredAt,
        status: evaluateReadingStatus(temperature, humidity, settings),
      };
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName));

  const alerts = latestByRoom.filter((item) => item.status && item.status !== "OK").length;
  const studentIds = [...new Set(events.map((event) => event.studentId))];
  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true },
      })
    : [];
  const studentNameById = new Map(students.map((student) => [student.id, student.name]));

  return (
    <div className="space-y-6">
      <LiveRefresh intervalMs={2000} pauseWhenInteracting />

      <div>
        <h1 className="text-2xl font-semibold">Monitoramento • Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          Panorama ESP32/Wi-Fi com leituras SHT31/SHT35 e últimos eventos RFID (PN532).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Salas ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{activeRooms}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Com leitura recente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {latestByRoom.filter((item) => item.temperature !== null).length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{alerts}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Eventos RFID (10 últimos)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{events.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Última leitura por sala</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sala</TableHead>
                  <TableHead>Sensor I²C</TableHead>
                  <TableHead>Temperatura</TableHead>
                  <TableHead>Umidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Horário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestByRoom.length ? (
                  latestByRoom.map((row) => (
                    <TableRow key={row.roomId}>
                      <TableCell>{row.roomName}</TableCell>
                      <TableCell>{row.sensor ?? "-"}</TableCell>
                      <TableCell>
                        {row.temperature === null ? "-" : `${formatDecimal(row.temperature, true)} °C`}
                      </TableCell>
                      <TableCell>
                        {row.humidity === null ? "-" : `${formatDecimal(row.humidity, true)} %`}
                      </TableCell>
                      <TableCell>
                        {row.status ? (
                          <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                        ) : (
                          <Badge variant="outline">Sem leitura</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.measuredAt
                          ? `${formatDate(row.measuredAt)} ${formatTime(row.measuredAt)}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma sala ativa encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 10 eventos de acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>UID RFID</TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length ? (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {formatDate(event.occurredAt)} {formatTime(event.occurredAt)}
                      </TableCell>
                      <TableCell>{event.device.name}</TableCell>
                      <TableCell>{eventCardUid(event.metadata)}</TableCell>
                      <TableCell>{studentNameById.get(event.studentId) ?? `#${event.studentId}`}</TableCell>
                      <TableCell>
                        <Badge variant={event.result === "ALLOW" ? "default" : "secondary"}>
                          {accessResultLabel(event.result)}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.reason}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum evento registrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
