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
  linked?: string;
};

export default async function GuardiansReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("guardians.read");

  const resolved = await searchParams;
  const page = Number(resolved.page) > 0 ? Number(resolved.page) : 1;
  const q = resolved.q?.toString().trim() ?? "";
  const linked =
    resolved.linked === "with_students" || resolved.linked === "without_students"
      ? resolved.linked
      : "all";
  const perPage = 15;
  const skip = (page - 1) * perPage;

  const where: Prisma.GuardianWhereInput = {};

  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      ...(digits ? [{ cpf: { contains: digits } }] : []),
      { email: { contains: q, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ];
  }

  if (linked === "with_students") {
    where.studentLinks = { some: {} };
  }
  if (linked === "without_students") {
    where.studentLinks = { none: {} };
  }

  const [guardians, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
      select: {
        id: true,
        name: true,
        cpf: true,
        email: true,
        phone: true,
        createdAt: true,
        studentLinks: {
          select: {
            student: {
              select: { id: true, name: true, registrationNumber: true },
            },
          },
        },
      },
    }),
    prisma.guardian.count({ where }),
  ]);
  const exportQuery = {
    q,
    linked: linked !== "all" ? linked : undefined,
  };
  const csvHref = buildReportExportHref("guardians", "csv", exportQuery);
  const pdfHref = buildReportExportHref("guardians", "pdf", exportQuery);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Relatório de Responsáveis</CardTitle>
        <p className="text-sm text-muted-foreground">Total encontrado: {total}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="guardians-q">
              Busca
            </label>
            <Input
              id="guardians-q"
              name="q"
              defaultValue={q}
              placeholder="Nome, CPF, e-mail ou telefone"
              className="w-full min-w-72"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="guardians-linked">
              Vínculo com aluno
            </label>
            <select
              id="guardians-linked"
              name="linked"
              defaultValue={linked}
              className={`${reportSelectClassName} min-w-52`}
            >
              <option value="all">Todos</option>
              <option value="with_students">Com alunos</option>
              <option value="without_students">Sem alunos</option>
            </select>
          </div>

          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/reports/guardians">Limpar</Link>
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
                <TableHead>Responsável</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Alunos Vinculados</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guardians.length ? (
                guardians.map((guardian) => {
                  const students = guardian.studentLinks.map((link) => link.student);
                  const visibleStudents = students.slice(0, 3);
                  const extra = students.length - visibleStudents.length;

                  return (
                    <TableRow key={guardian.id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{guardian.name}</div>
                        <p className="text-xs text-muted-foreground">CPF: {guardian.cpf}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <p>{guardian.email || "—"}</p>
                        <p className="text-xs text-muted-foreground">{guardian.phone || "—"}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        {students.length ? (
                          <div className="space-y-1">
                            {visibleStudents.map((student) => (
                              <p key={student.id} className="text-sm">
                                {student.name}{" "}
                                <span className="text-xs text-muted-foreground">
                                  ({student.registrationNumber})
                                </span>
                              </p>
                            ))}
                            {extra > 0 ? (
                              <p className="text-xs text-muted-foreground">+{extra} aluno(s)</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem vínculo</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">{formatDate(guardian.createdAt)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhum responsável encontrado para os filtros informados.
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
          basePath="/reports/guardians"
          query={exportQuery}
        />
      </CardContent>
    </Card>
  );
}
