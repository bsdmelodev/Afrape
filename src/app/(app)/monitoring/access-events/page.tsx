import { Prisma, type AccessResult } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatTime } from "@/lib/formatters";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { LiveRefresh } from "../components/live-refresh";

export const dynamic = "force-dynamic";

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

function accessResultLabel(result: AccessResult) {
  return result === "ALLOW" ? "Permitido" : "Negado";
}

function eventCardUid(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "-";
  const value = (metadata as Record<string, unknown>).cardUid;
  return typeof value === "string" && value.length > 0 ? value : "-";
}

export default async function MonitoringAccessEventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    student_id?: string;
    result?: string;
    device_id?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requirePermission(MONITORING_PERMISSIONS.VIEW);

  const resolved = await searchParams;
  const page = parsePositiveInt(resolved.page, 1);
  const studentId = parsePositiveInt(resolved.student_id, 0);
  const deviceId = parsePositiveInt(resolved.device_id, 0);
  const result: AccessResult | undefined =
    resolved.result === "ALLOW" || resolved.result === "DENY" ? resolved.result : undefined;
  const from = parseDate(resolved.from);
  const to = parseDate(resolved.to);
  const perPage = 15;

  const where: Prisma.AccessEventWhereInput = {
    ...(studentId > 0 ? { studentId } : {}),
    ...(deviceId > 0 ? { deviceId } : {}),
    ...(result ? { result } : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [events, total, devices] = await Promise.all([
    prisma.accessEvent.findMany({
      where,
      include: {
        device: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.accessEvent.count({ where }),
    prisma.device.findMany({
      where: { type: "PORTARIA" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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
        <h1 className="text-2xl font-semibold">Monitoramento • Eventos de Acesso</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de eventos RFID (PN532) com filtros por aluno, resultado, período e dispositivo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-6" method="get">
            <Input
              type="number"
              min={1}
              name="student_id"
              defaultValue={resolved.student_id ?? ""}
              placeholder="ID do aluno"
            />

            <select
              name="result"
              defaultValue={result ?? ""}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              <option value="ALLOW">Permitido</option>
              <option value="DENY">Negado</option>
            </select>

            <select
              name="device_id"
              defaultValue={resolved.device_id ?? ""}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {devices.map((device) => (
                <option key={device.id} value={String(device.id)}>
                  {device.name}
                </option>
              ))}
            </select>

            <Input type="datetime-local" name="from" defaultValue={resolved.from ?? ""} />
            <Input type="datetime-local" name="to" defaultValue={resolved.to ?? ""} />

            <Button type="submit">Filtrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ocorrido em</TableHead>
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
                      Nenhum evento encontrado.
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
            basePath="/monitoring/access-events"
            query={{
              student_id: resolved.student_id,
              result,
              device_id: resolved.device_id,
              from: resolved.from,
              to: resolved.to,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
