import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDecimal, formatTime } from "@/lib/formatters";
import {
  ensureMonitoringSettings,
  evaluateReadingStatus,
  MONITORING_PERMISSIONS,
} from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { LiveRefresh } from "../components/live-refresh";
import { RoomTable } from "../components/room-table";
import type { RoomRow } from "../types";

export const dynamic = "force-dynamic";

function statusLabel(status: RoomRow["status"]) {
  if (status === "ATENCAO") return "Atenção";
  if (status === "CRITICO") return "Crítico";
  if (status === "OK") return "OK";
  return "Sem leitura";
}

function statusVariant(status: RoomRow["status"]) {
  if (status === "CRITICO") return "destructive" as const;
  if (status === "ATENCAO") return "secondary" as const;
  if (status === "OK") return "default" as const;
  return "outline" as const;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export default async function MonitoringRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; page?: string; q?: string }>;
}) {
  const user = await requirePermission(MONITORING_PERMISSIONS.VIEW);
  const canManage = hasPermission(user, MONITORING_PERMISSIONS.MANAGE);

  const resolved = await searchParams;
  const roomId = Number(resolved.room ?? "0");
  const page = parsePositiveInt(resolved.page, 1);
  const q = resolved.q?.trim() ?? "";

  const settings = await ensureMonitoringSettings();

  const whereRoom = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { location: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const roomsRaw = await prisma.room.findMany({
    where: whereRoom,
    orderBy: { name: "asc" },
    include: {
      devices: { select: { id: true } },
      telemetryReadings: {
        take: 1,
        orderBy: { measuredAt: "desc" },
      },
    },
  });

  const rows: RoomRow[] = roomsRaw.map((room) => {
    const latest = room.telemetryReadings[0];
    const temperature = latest ? Number(latest.temperature) : null;
    const humidity = latest ? Number(latest.humidity) : null;
    const status =
      temperature === null || humidity === null
        ? "SEM_LEITURA"
        : evaluateReadingStatus(temperature, humidity, settings);

    return {
      id: room.id,
      name: room.name,
      location: room.location,
      isActive: room.isActive,
      deviceCount: room.devices.length,
      lastTemperature: temperature,
      lastHumidity: humidity,
      lastMeasuredAt: latest ? `${formatDate(latest.measuredAt)} ${formatTime(latest.measuredAt)}` : null,
      status,
    };
  });

  const selectedRoom = rows.find((room) => room.id === roomId) ?? rows[0] ?? null;
  const perPage = 10;

  const readingsWhere = selectedRoom
    ? {
        roomId: selectedRoom.id,
      }
    : { roomId: -1 };

  const [readings, totalReadings] = selectedRoom
    ? await Promise.all([
        prisma.telemetryReading.findMany({
          where: readingsWhere,
          include: {
            device: { select: { name: true } },
          },
          orderBy: { measuredAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        prisma.telemetryReading.count({ where: readingsWhere }),
      ])
    : [[], 0];

  return (
    <div className="space-y-6">
      <LiveRefresh intervalMs={2000} pauseWhenInteracting />

      <div>
        <h1 className="text-2xl font-semibold">Monitoramento • Salas</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie salas e acompanhe histórico de leituras por ambiente.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar sala por nome/localização"
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <RoomTable data={rows} canManage={canManage} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {selectedRoom ? `Detalhes da sala: ${selectedRoom.name}` : "Detalhes da sala"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {rows.map((room) => (
              <Button
                key={room.id}
                variant={selectedRoom?.id === room.id ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={`/monitoring/rooms?room=${room.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>
                  {room.name}
                </Link>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedRoom ? (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant={statusVariant(selectedRoom.status)}>{statusLabel(selectedRoom.status)}</Badge>
                <span className="text-muted-foreground">
                  {selectedRoom.location ? `Localização: ${selectedRoom.location}` : "Localização não informada"}
                </span>
                <span className="text-muted-foreground">Dispositivos: {selectedRoom.deviceCount}</span>
                <span className="text-muted-foreground">
                  Última leitura: {selectedRoom.lastMeasuredAt ?? "-"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>Temperatura</TableHead>
                      <TableHead>Umidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.length ? (
                      readings.map((reading) => {
                        const temp = Number(reading.temperature);
                        const hum = Number(reading.humidity);
                        const status = evaluateReadingStatus(temp, hum, settings);

                        return (
                          <TableRow key={reading.id}>
                            <TableCell>
                              {formatDate(reading.measuredAt)} {formatTime(reading.measuredAt)}
                            </TableCell>
                            <TableCell>{reading.device.name}</TableCell>
                            <TableCell>{formatDecimal(temp, true)} °C</TableCell>
                            <TableCell>{formatDecimal(hum, true)} %</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhuma leitura encontrada para a sala selecionada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={page}
                perPage={perPage}
                total={totalReadings}
                basePath="/monitoring/rooms"
                query={{ room: String(selectedRoom.id), q }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma sala cadastrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
