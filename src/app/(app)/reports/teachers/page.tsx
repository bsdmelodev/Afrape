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
  allocation?: string;
};

export default async function TeachersReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("teachers.read");

  const resolved = await searchParams;
  const page = Number(resolved.page) > 0 ? Number(resolved.page) : 1;
  const q = resolved.q?.toString().trim() ?? "";
  const status = resolved.status === "active" || resolved.status === "inactive" ? resolved.status : "all";
  const allocation =
    resolved.allocation === "with_assignment" || resolved.allocation === "without_assignment"
      ? resolved.allocation
      : "all";
  const perPage = 15;
  const skip = (page - 1) * perPage;

  const where: Prisma.TeacherWhereInput = {};
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      ...(digits ? [{ user: { cpf: { contains: digits } } }] : []),
      ...(digits ? [{ user: { phone: { contains: digits } } }] : []),
    ];
  }

  if (status === "active") {
    where.isActive = true;
  }
  if (status === "inactive") {
    where.isActive = false;
  }

  if (allocation === "with_assignment") {
    where.teacherAssignments = { some: {} };
  }
  if (allocation === "without_assignment") {
    where.teacherAssignments = { none: {} };
  }

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      select: {
        id: true,
        isActive: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
            cpf: true,
            phone: true,
          },
        },
        _count: {
          select: {
            teacherAssignments: true,
          },
        },
      },
    }),
    prisma.teacher.count({ where }),
  ]);
  const exportQuery = {
    q,
    status: status !== "all" ? status : undefined,
    allocation: allocation !== "all" ? allocation : undefined,
  };
  const csvHref = buildReportExportHref("teachers", "csv", exportQuery);
  const pdfHref = buildReportExportHref("teachers", "pdf", exportQuery);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Relatório de Professores</CardTitle>
        <p className="text-sm text-muted-foreground">Total encontrado: {total}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="teachers-q">
              Busca
            </label>
            <Input
              id="teachers-q"
              name="q"
              defaultValue={q}
              placeholder="Nome, e-mail, CPF ou telefone"
              className="w-full min-w-72"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="teachers-status">
              Situação
            </label>
            <select
              id="teachers-status"
              name="status"
              defaultValue={status}
              className={`${reportSelectClassName} min-w-44`}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="teachers-allocation">
              Alocação
            </label>
            <select
              id="teachers-allocation"
              name="allocation"
              defaultValue={allocation}
              className={`${reportSelectClassName} min-w-52`}
            >
              <option value="all">Todos</option>
              <option value="with_assignment">Com alocação</option>
              <option value="without_assignment">Sem alocação</option>
            </select>
          </div>

          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/reports/teachers">Limpar</Link>
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
                <TableHead>Professor</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Alocações</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length ? (
                teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="align-top">
                      <div className="font-medium">{teacher.user.name}</div>
                      <p className="text-xs text-muted-foreground">CPF: {teacher.user.cpf || "—"}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <p>{teacher.user.email}</p>
                      <p className="text-xs text-muted-foreground">{teacher.user.phone || "—"}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={teacher.isActive ? "default" : "secondary"}>
                        {teacher.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">{teacher._count.teacherAssignments}</TableCell>
                    <TableCell className="align-top">{formatDate(teacher.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhum professor encontrado para os filtros informados.
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
          basePath="/reports/teachers"
          query={exportQuery}
        />
      </CardContent>
    </Card>
  );
}
