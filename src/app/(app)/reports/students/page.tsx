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

export default async function StudentsReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePermission("students.read");

  const resolved = await searchParams;
  const page = Number(resolved.page) > 0 ? Number(resolved.page) : 1;
  const q = resolved.q?.toString().trim() ?? "";
  const status = resolved.status === "active" || resolved.status === "inactive" ? resolved.status : "all";
  const classGroupId = toPositiveInt(resolved.classGroupId);
  const schoolYear = toPositiveInt(resolved.schoolYear);
  const perPage = 15;
  const skip = (page - 1) * perPage;

  const where: Prisma.StudentWhereInput = {};
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { registrationNumber: { contains: q, mode: "insensitive" } },
      ...(digits ? [{ cpf: { contains: digits } }] : []),
      { email: { contains: q, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
      {
        guardians: {
          some: {
            guardian: {
              name: { contains: q, mode: "insensitive" },
            },
          },
        },
      },
      ...(digits
        ? [
            {
              guardians: {
                some: {
                  guardian: {
                    cpf: { contains: digits },
                  },
                },
              },
            },
          ]
        : []),
    ];
  }

  if (status === "active") {
    where.isActive = true;
  }
  if (status === "inactive") {
    where.isActive = false;
  }

  if (classGroupId || schoolYear) {
    where.enrollments = {
      some: {
        ...(classGroupId ? { classGroupId } : {}),
        ...(schoolYear ? { classGroup: { schoolYear } } : {}),
      },
    };
  }

  const classGroupsPromise = prisma.classGroup.findMany({
    select: { id: true, name: true, schoolYear: true },
    orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
  });

  const [students, total, classGroups] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        cpf: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        guardians: {
          select: {
            guardianId: true,
            guardian: {
              select: {
                name: true,
                cpf: true,
              },
            },
          },
        },
        enrollments: {
          where: { status: "active" },
          select: {
            id: true,
            classGroup: {
              select: { name: true, schoolYear: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.student.count({ where }),
    classGroupsPromise,
  ]);

  const years = Array.from(new Set(classGroups.map((group) => group.schoolYear))).sort((a, b) => b - a);
  const exportQuery = {
    q,
    status: status !== "all" ? status : undefined,
    classGroupId: classGroupId ? String(classGroupId) : undefined,
    schoolYear: schoolYear ? String(schoolYear) : undefined,
  };
  const csvHref = buildReportExportHref("students", "csv", exportQuery);
  const pdfHref = buildReportExportHref("students", "pdf", exportQuery);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>Relatório de Alunos</CardTitle>
        <p className="text-sm text-muted-foreground">Total encontrado: {total}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="students-q">
              Busca
            </label>
            <Input
              id="students-q"
              name="q"
              defaultValue={q}
              placeholder="Aluno, responsável, matrícula, CPF, e-mail ou telefone"
              className="w-full min-w-72"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="students-status">
              Situação
            </label>
            <select
              id="students-status"
              name="status"
              defaultValue={status}
              className={`${reportSelectClassName} min-w-44`}
            >
              <option value="all">Todas</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="students-year">
              Ano letivo
            </label>
            <select
              id="students-year"
              name="schoolYear"
              defaultValue={schoolYear ? String(schoolYear) : ""}
              className={`${reportSelectClassName} min-w-36`}
            >
              <option value="">Todos</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="students-class-group">
              Turma
            </label>
            <select
              id="students-class-group"
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
            <Link href="/reports/students">Limpar</Link>
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
                <TableHead>Contato</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Turmas Ativas</TableHead>
                <TableHead>Responsáveis</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length ? (
                students.map((student) => {
                  const classLabels = student.enrollments.map(
                    (enrollment) => `${enrollment.classGroup.schoolYear} - ${enrollment.classGroup.name}`
                  );
                  const visibleClasses = classLabels.slice(0, 2);
                  const extraClasses = classLabels.length - visibleClasses.length;
                  const guardians = student.guardians.map((link) => link.guardian);
                  const visibleGuardians = guardians.slice(0, 3);
                  const extraGuardians = guardians.length - visibleGuardians.length;

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{student.name}</div>
                        <p className="text-xs text-muted-foreground">
                          Matrícula: {student.registrationNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">CPF: {student.cpf}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <p>{student.email || "—"}</p>
                        <p className="text-xs text-muted-foreground">{student.phone || "—"}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={student.isActive ? "default" : "secondary"}>
                          {student.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        {classLabels.length ? (
                          <div className="space-y-1">
                            {visibleClasses.map((label) => (
                              <p key={label} className="text-sm">
                                {label}
                              </p>
                            ))}
                            {extraClasses > 0 ? (
                              <p className="text-xs text-muted-foreground">+{extraClasses} turma(s)</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem turma ativa</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {guardians.length ? (
                          <div className="space-y-1">
                            {visibleGuardians.map((guardian) => (
                              <p key={`${guardian.cpf}-${guardian.name}`} className="text-sm">
                                {guardian.name}
                              </p>
                            ))}
                            {extraGuardians > 0 ? (
                              <p className="text-xs text-muted-foreground">
                                +{extraGuardians} responsável(eis)
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem responsáveis</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">{formatDate(student.createdAt)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Nenhum aluno encontrado para os filtros informados.
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
          basePath="/reports/students"
          query={exportQuery}
        />
      </CardContent>
    </Card>
  );
}
