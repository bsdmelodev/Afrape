import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { buildReportExportHref, reportSelectClassName } from "../definitions";

type Search = {
  page?: string;
  q?: string;
  schoolYear?: string;
  shift?: string;
  status?: string;
};

const SHIFT_LABELS: Record<number, string> = {
  1: "Manhã",
  2: "Tarde",
  3: "Noite",
  4: "Integral",
};

function toPositiveInt(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function ClassGroupsReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("class_groups.read");

  const resolved = await searchParams;
  const page = Number(resolved.page) > 0 ? Number(resolved.page) : 1;
  const q = resolved.q?.toString().trim() ?? "";
  const schoolYear = toPositiveInt(resolved.schoolYear);
  const shift = toPositiveInt(resolved.shift);
  const status = resolved.status === "active" || resolved.status === "inactive" ? resolved.status : "all";
  const perPage = 15;
  const skip = (page - 1) * perPage;

  const where: Prisma.ClassGroupWhereInput = {};
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }
  if (schoolYear) {
    where.schoolYear = schoolYear;
  }
  if (shift) {
    where.shift = shift;
  }
  if (status === "active") {
    where.isActive = true;
  }
  if (status === "inactive") {
    where.isActive = false;
  }

  const [groups, total, years] = await Promise.all([
    prisma.classGroup.findMany({
      where,
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      skip,
      take: perPage,
      select: {
        id: true,
        name: true,
        schoolYear: true,
        shift: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            classSubjects: true,
          },
        },
      },
    }),
    prisma.classGroup.count({ where }),
    prisma.classGroup.findMany({
      select: { schoolYear: true },
      distinct: ["schoolYear"],
      orderBy: { schoolYear: "desc" },
    }),
  ]);
  const exportQuery = {
    q,
    schoolYear: schoolYear ? String(schoolYear) : undefined,
    shift: shift ? String(shift) : undefined,
    status: status !== "all" ? status : undefined,
  };
  const csvHref = buildReportExportHref("class-groups", "csv", exportQuery);
  const pdfHref = buildReportExportHref("class-groups", "pdf", exportQuery);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Relatório de Turmas</CardTitle>
        <p className="text-sm text-muted-foreground">Total encontrado: {total}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="class-groups-q">
              Busca
            </label>
            <Input
              id="class-groups-q"
              name="q"
              defaultValue={q}
              placeholder="Nome da turma"
              className="w-full min-w-72"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="class-groups-year">
              Ano letivo
            </label>
            <select
              id="class-groups-year"
              name="schoolYear"
              defaultValue={schoolYear ? String(schoolYear) : ""}
              className={`${reportSelectClassName} min-w-36`}
            >
              <option value="">Todos</option>
              {years.map((item) => (
                <option key={item.schoolYear} value={item.schoolYear}>
                  {item.schoolYear}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="class-groups-shift">
              Turno
            </label>
            <select
              id="class-groups-shift"
              name="shift"
              defaultValue={shift ? String(shift) : ""}
              className={`${reportSelectClassName} min-w-40`}
            >
              <option value="">Todos</option>
              <option value="1">Manhã</option>
              <option value="2">Tarde</option>
              <option value="3">Noite</option>
              <option value="4">Integral</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="class-groups-status">
              Situação
            </label>
            <select
              id="class-groups-status"
              name="status"
              defaultValue={status}
              className={`${reportSelectClassName} min-w-40`}
            >
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </div>

          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/reports/class-groups">Limpar</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={csvHref}>Exportar CSV</a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={pdfHref}>Exportar PDF</a>
          </Button>
        </form>

        <div className="overflow-x-auto rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turma</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Matrículas</TableHead>
                <TableHead>Componentes</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length ? (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.schoolYear}</TableCell>
                    <TableCell>{group.shift ? SHIFT_LABELS[group.shift] ?? `Turno ${group.shift}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>{group._count.enrollments}</TableCell>
                    <TableCell>{group._count.classSubjects}</TableCell>
                    <TableCell>{formatDate(group.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhuma turma encontrada para os filtros informados.
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
          basePath="/reports/class-groups"
          query={exportQuery}
        />
      </CardContent>
    </Card>
  );
}
