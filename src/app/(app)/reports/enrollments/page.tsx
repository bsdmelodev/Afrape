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
  status?: string;
  classGroupId?: string;
  schoolYear?: string;
};

function toPositiveInt(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function EnrollmentsReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("enrollments.read");

  const resolved = await searchParams;
  const page = Number(resolved.page) > 0 ? Number(resolved.page) : 1;
  const q = resolved.q?.toString().trim() ?? "";
  const status = resolved.status?.toString().trim() || "all";
  const classGroupId = toPositiveInt(resolved.classGroupId);
  const schoolYear = toPositiveInt(resolved.schoolYear);
  const perPage = 15;
  const skip = (page - 1) * perPage;

  const where: Prisma.EnrollmentWhereInput = {};
  if (q) {
    const numeric = Number(q);
    const digits = q.replace(/\D/g, "");

    where.OR = [
      { student: { name: { contains: q, mode: "insensitive" } } },
      { student: { registrationNumber: { contains: q, mode: "insensitive" } } },
      ...(digits ? [{ student: { cpf: { contains: digits } } }] : []),
      { classGroup: { name: { contains: q, mode: "insensitive" } } },
      ...(Number.isInteger(numeric) ? [{ classGroup: { schoolYear: numeric } }] : []),
    ];
  }

  if (status !== "all") {
    where.status = status;
  }
  if (classGroupId) {
    where.classGroupId = classGroupId;
  }
  if (schoolYear) {
    where.classGroup = {
      schoolYear,
    };
  }

  const [enrollments, total, classGroups, years, statuses] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        leftAt: true,
        createdAt: true,
        student: {
          select: {
            name: true,
            registrationNumber: true,
            cpf: true,
          },
        },
        classGroup: {
          select: {
            name: true,
            schoolYear: true,
          },
        },
      },
    }),
    prisma.enrollment.count({ where }),
    prisma.classGroup.findMany({
      select: { id: true, name: true, schoolYear: true },
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
    }),
    prisma.classGroup.findMany({
      select: { schoolYear: true },
      distinct: ["schoolYear"],
      orderBy: { schoolYear: "desc" },
    }),
    prisma.enrollment.findMany({
      select: { status: true },
      distinct: ["status"],
      orderBy: { status: "asc" },
    }),
  ]);
  const exportQuery = {
    q,
    status: status !== "all" ? status : undefined,
    classGroupId: classGroupId ? String(classGroupId) : undefined,
    schoolYear: schoolYear ? String(schoolYear) : undefined,
  };
  const csvHref = buildReportExportHref("enrollments", "csv", exportQuery);
  const pdfHref = buildReportExportHref("enrollments", "pdf", exportQuery);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Relatório de Matrículas</CardTitle>
        <p className="text-sm text-muted-foreground">Total encontrado: {total}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="enrollments-q">
              Busca
            </label>
            <Input
              id="enrollments-q"
              name="q"
              defaultValue={q}
              placeholder="Aluno, matrícula, CPF, turma ou ano"
              className="w-full min-w-72"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="enrollments-status">
              Status
            </label>
            <select
              id="enrollments-status"
              name="status"
              defaultValue={status}
              className={`${reportSelectClassName} min-w-44`}
            >
              <option value="all">Todos</option>
              {statuses.map((item) => (
                <option key={item.status} value={item.status}>
                  {item.status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="enrollments-year">
              Ano letivo
            </label>
            <select
              id="enrollments-year"
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
            <label className="text-sm font-medium" htmlFor="enrollments-class-group">
              Turma
            </label>
            <select
              id="enrollments-class-group"
              name="classGroupId"
              defaultValue={classGroupId ? String(classGroupId) : ""}
              className={`${reportSelectClassName} min-w-56`}
            >
              <option value="">Todas</option>
              {classGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.schoolYear} - {group.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/reports/enrollments">Limpar</Link>
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
                <TableHead>Aluno</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de matrícula</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.length ? (
                enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="align-top">
                      <div className="font-medium">{enrollment.student.name}</div>
                      <p className="text-xs text-muted-foreground">
                        Matrícula: {enrollment.student.registrationNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">CPF: {enrollment.student.cpf}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      {enrollment.classGroup.schoolYear} - {enrollment.classGroup.name}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>
                        {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">{formatDate(enrollment.enrolledAt)}</TableCell>
                    <TableCell className="align-top">{formatDate(enrollment.leftAt) || "—"}</TableCell>
                    <TableCell className="align-top">{formatDate(enrollment.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhuma matrícula encontrada para os filtros informados.
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
          basePath="/reports/enrollments"
          query={exportQuery}
        />
      </CardContent>
    </Card>
  );
}
