import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function statusVariant(status: "OK" | "ATENCAO" | "CRITICO") {
  if (status === "CRITICO") return "destructive" as const;
  if (status === "ATENCAO") return "secondary" as const;
  return "default" as const;
}

function statusLabel(status: "OK" | "ATENCAO" | "CRITICO") {
  if (status === "ATENCAO") return "Atenção";
  if (status === "CRITICO") return "Crítico";
  return "OK";
}

function parseDate(value?: string) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function resolveStart(interval: string, from?: string) {
  const fromDate = parseDate(from);
  if (fromDate) return fromDate;

  const now = Date.now();
  if (interval === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  return new Date(now - 24 * 60 * 60 * 1000);
}

export default async function MonitoringReadingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; room_id?: string; interval?: string; from?: string; to?: string }>;
}) {
  await requirePermission(MONITORING_PERMISSIONS.VIEW);

  const resolved = await searchParams;
  const page = parsePositiveInt(resolved.page, 1);
  const roomId = Number(resolved.room_id ?? "0");
  const interval = resolved.interval === "7d" ? "7d" : "24h";
  const startDate = resolveStart(interval, resolved.from);
  const endDate = parseDate(resolved.to);
  const perPage = 20;

  const [settings, rooms] = await Promise.all([
    ensureMonitoringSettings(),
    prisma.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const where = {
    ...(roomId > 0 ? { roomId } : {}),
    measuredAt: {
      gte: startDate,
      ...(endDate ? { lte: endDate } : {}),
    },
  };

  const [readings, total, aggregate] = await Promise.all([
    prisma.telemetryReading.findMany({
      where,
      include: {
        room: { select: { id: true, name: true } },
        device: { select: { name: true } },
      },
      orderBy: { measuredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.telemetryReading.count({ where }),
    prisma.telemetryReading.aggregate({
      where,
      _avg: {
        temperature: true,
        humidity: true,
      },
    }),
  ]);

  const withStatus = readings.map((reading) => {
    const temperature = Number(reading.temperature);
    const humidity = Number(reading.humidity);
    return {
      ...reading,
      temperature,
      humidity,
      status: evaluateReadingStatus(temperature, humidity, settings),
    };
  });

  const avgTemperature = aggregate._avg.temperature ? Number(aggregate._avg.temperature) : null;
  const avgHumidity = aggregate._avg.humidity ? Number(aggregate._avg.humidity) : null;

  return (
    <div className="space-y-6">
      <LiveRefresh intervalMs={2000} pauseWhenInteracting />

      <div>
        <h1 className="text-2xl font-semibold">Monitoramento • Leituras</h1>
        <p className="text-sm text-muted-foreground">
          Consulta de leituras de temperatura/umidade por sala e período.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-5" method="get">
            <select
              name="room_id"
              defaultValue={resolved.room_id ?? ""}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todas as salas</option>
              {rooms.map((room) => (
                <option key={room.id} value={String(room.id)}>
                  {room.name}
                </option>
              ))}
            </select>

            <select
              name="interval"
              defaultValue={interval}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
            </select>

            <Input type="datetime-local" name="from" defaultValue={resolved.from ?? ""} />
            <Input type="datetime-local" name="to" defaultValue={resolved.to ?? ""} />

            <Button type="submit">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total de leituras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Temperatura média</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {avgTemperature === null ? "-" : `${formatDecimal(avgTemperature, true)} °C`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Umidade média</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {avgHumidity === null ? "-" : `${formatDecimal(avgHumidity, true)} %`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leituras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Temperatura</TableHead>
                  <TableHead>Umidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withStatus.length ? (
                  withStatus.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>
                        {formatDate(reading.measuredAt)} {formatTime(reading.measuredAt)}
                      </TableCell>
                      <TableCell>{reading.room.name}</TableCell>
                      <TableCell>{reading.device.name}</TableCell>
                      <TableCell>{formatDecimal(reading.temperature, true)} °C</TableCell>
                      <TableCell>{formatDecimal(reading.humidity, true)} %</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(reading.status)}>{statusLabel(reading.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma leitura encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            basePath="/monitoring/readings"
            query={{
              room_id: resolved.room_id,
              interval,
              from: resolved.from,
              to: resolved.to,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
