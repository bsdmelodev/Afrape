import Link from "next/link";
import type { Prisma } from "@prisma/client";
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
  codeFilter?: string;
  inUse?: string;
};

export default async function SubjectsReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("subjects.read");

  const resolved = await searchParams;
  const page = Number(resolved.page) > 0 ? Number(resolved.page) : 1;
  const q = resolved.q?.toString().trim() ?? "";
  const codeFilter =
    resolved.codeFilter === "with_code" || resolved.codeFilter === "without_code"
      ? resolved.codeFilter
      : "all";
  const inUse = resolved.inUse === "yes" || resolved.inUse === "no" ? resolved.inUse : "all";
  const perPage = 15;
  const skip = (page - 1) * perPage;

  const andFilters: Prisma.SubjectWhereInput[] = [];
  if (q) {
    andFilters.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (codeFilter === "with_code") {
    andFilters.push({
      code: {
        not: null,
      },
    });
  }
  if (codeFilter === "without_code") {
    andFilters.push({
      OR: [{ code: null }, { code: "" }],
    });
  }

  if (inUse === "yes") {
    andFilters.push({ classSubjects: { some: {} } });
  }
  if (inUse === "no") {
    andFilters.push({ classSubjects: { none: {} } });
  }

  const where: Prisma.SubjectWhereInput = andFilters.length ? { AND: andFilters } : {};

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        _count: {
          select: {
            classSubjects: true,
          },
        },
      },
    }),
    prisma.subject.count({ where }),
  ]);
  const exportQuery = {
    q,
    codeFilter: codeFilter !== "all" ? codeFilter : undefined,
    inUse: inUse !== "all" ? inUse : undefined,
  };
  const csvHref = buildReportExportHref("subjects", "csv", exportQuery);
  const pdfHref = buildReportExportHref("subjects", "pdf", exportQuery);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Relatório de Disciplinas</CardTitle>
        <p className="text-sm text-muted-foreground">Total encontrado: {total}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="subjects-q">
              Busca
            </label>
            <Input
              id="subjects-q"
              name="q"
              defaultValue={q}
              placeholder="Nome ou código"
              className="w-full min-w-72"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="subjects-code-filter">
              Código
            </label>
            <select
              id="subjects-code-filter"
              name="codeFilter"
              defaultValue={codeFilter}
              className={`${reportSelectClassName} min-w-44`}
            >
              <option value="all">Todos</option>
              <option value="with_code">Com código</option>
              <option value="without_code">Sem código</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="subjects-in-use">
              Uso em turmas
            </label>
            <select
              id="subjects-in-use"
              name="inUse"
              defaultValue={inUse}
              className={`${reportSelectClassName} min-w-44`}
            >
              <option value="all">Todos</option>
              <option value="yes">Em uso</option>
              <option value="no">Sem uso</option>
            </select>
          </div>

          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/reports/subjects">Limpar</Link>
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
                <TableHead>Disciplina</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Turmas vinculadas</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length ? (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>{subject.code || "—"}</TableCell>
                    <TableCell>{subject._count.classSubjects}</TableCell>
                    <TableCell>{formatDate(subject.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhuma disciplina encontrada para os filtros informados.
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
          basePath="/reports/subjects"
          query={exportQuery}
        />
      </CardContent>
    </Card>
  );
}
