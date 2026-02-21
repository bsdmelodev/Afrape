import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-rbac";
import { formatDate } from "@/lib/formatters";
import { prisma } from "@/lib/prisma";
import { buildCsv, buildSimpleTablePdf } from "@/lib/report-export";

export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 5000;

type ReportKey =
  | "students"
  | "guardians"
  | "class-groups"
  | "subjects"
  | "enrollments"
  | "teachers";

type ExportFormat = "csv" | "pdf";

type ExportDataset = {
  title: string;
  filePrefix: string;
  headers: string[];
  rows: string[][];
  total: number;
  exported: number;
  appliedFilters: string[];
};

const reportPermissions: Record<ReportKey, string> = {
  students: "students.read",
  guardians: "guardians.read",
  "class-groups": "class_groups.read",
  subjects: "subjects.read",
  enrollments: "enrollments.read",
  teachers: "teachers.read",
};

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sanitizeFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function parseReport(value: string | null): ReportKey | null {
  if (
    value === "students" ||
    value === "guardians" ||
    value === "class-groups" ||
    value === "subjects" ||
    value === "enrollments" ||
    value === "teachers"
  ) {
    return value;
  }
  return null;
}

function parseFormat(value: string | null): ExportFormat | null {
  if (value === "csv" || value === "pdf") return value;
  return null;
}

function toFilterList(entries: Array<[string, string | null | undefined]>) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `${label}: ${value}`);
}

async function getStudentsDataset(search: URLSearchParams): Promise<ExportDataset> {
  const q = search.get("q")?.trim() ?? "";
  const status = search.get("status");
  const classGroupId = parsePositiveInt(search.get("classGroupId"));
  const schoolYear = parsePositiveInt(search.get("schoolYear"));

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
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  if (classGroupId || schoolYear) {
    where.enrollments = {
      some: {
        ...(classGroupId ? { classGroupId } : {}),
        ...(schoolYear ? { classGroup: { schoolYear } } : {}),
      },
    };
  }

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { name: "asc" },
      take: MAX_EXPORT_ROWS,
      select: {
        name: true,
        registrationNumber: true,
        cpf: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { guardians: true },
        },
        guardians: {
          select: {
            guardian: {
              select: {
                name: true,
              },
            },
          },
        },
        enrollments: {
          where: { status: "active" },
          select: {
            classGroup: { select: { name: true, schoolYear: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  const rows = students.map((student) => {
    const classes = student.enrollments
      .map((enrollment) => `${enrollment.classGroup.schoolYear} - ${enrollment.classGroup.name}`)
      .join(" | ");
    const guardians = student.guardians
      .map((link) => link.guardian.name)
      .filter(Boolean)
      .join(" | ");

    return [
      student.name,
      student.registrationNumber,
      student.cpf,
      student.email || "",
      student.phone || "",
      student.isActive ? "Ativo" : "Inativo",
      classes || "Sem turma ativa",
      guardians || "Sem responsáveis",
      String(student._count.guardians),
      formatDate(student.createdAt),
    ];
  });

  return {
    title: "Relatório de Alunos",
    filePrefix: "relatorio-alunos",
    headers: [
      "Aluno",
      "Matricula",
      "CPF",
      "Email",
      "Telefone",
      "Situacao",
      "Turmas Ativas",
      "Responsaveis",
      "Qtde Responsaveis",
      "Criado em",
    ],
    rows,
    total,
    exported: students.length,
    appliedFilters: toFilterList([
      ["Busca", q || null],
      [
        "Situacao",
        status === "active" ? "Ativos" : status === "inactive" ? "Inativos" : null,
      ],
      ["Ano letivo", schoolYear ? String(schoolYear) : null],
      ["Turma (ID)", classGroupId ? String(classGroupId) : null],
    ]),
  };
}

async function getGuardiansDataset(search: URLSearchParams): Promise<ExportDataset> {
  const q = search.get("q")?.trim() ?? "";
  const linked = search.get("linked");

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
  if (linked === "with_students") where.studentLinks = { some: {} };
  if (linked === "without_students") where.studentLinks = { none: {} };

  const [total, guardians] = await Promise.all([
    prisma.guardian.count({ where }),
    prisma.guardian.findMany({
      where,
      orderBy: { name: "asc" },
      take: MAX_EXPORT_ROWS,
      select: {
        name: true,
        cpf: true,
        email: true,
        phone: true,
        createdAt: true,
        studentLinks: {
          select: {
            student: { select: { name: true, registrationNumber: true } },
          },
        },
      },
    }),
  ]);

  const rows = guardians.map((guardian) => {
    const students = guardian.studentLinks
      .map((link) => `${link.student.name} (${link.student.registrationNumber})`)
      .join(" | ");

    return [
      guardian.name,
      guardian.cpf,
      guardian.email || "",
      guardian.phone || "",
      String(guardian.studentLinks.length),
      students || "Sem vinculo",
      formatDate(guardian.createdAt),
    ];
  });

  return {
    title: "Relatório de Responsáveis",
    filePrefix: "relatorio-responsaveis",
    headers: [
      "Responsavel",
      "CPF",
      "Email",
      "Telefone",
      "Qtde Alunos",
      "Alunos Vinculados",
      "Criado em",
    ],
    rows,
    total,
    exported: guardians.length,
    appliedFilters: toFilterList([
      ["Busca", q || null],
      [
        "Vinculo",
        linked === "with_students"
          ? "Com alunos"
          : linked === "without_students"
            ? "Sem alunos"
            : null,
      ],
    ]),
  };
}

async function getClassGroupsDataset(search: URLSearchParams): Promise<ExportDataset> {
  const q = search.get("q")?.trim() ?? "";
  const schoolYear = parsePositiveInt(search.get("schoolYear"));
  const shift = parsePositiveInt(search.get("shift"));
  const status = search.get("status");

  const where: Prisma.ClassGroupWhereInput = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (schoolYear) where.schoolYear = schoolYear;
  if (shift) where.shift = shift;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  const [total, classGroups] = await Promise.all([
    prisma.classGroup.count({ where }),
    prisma.classGroup.findMany({
      where,
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      take: MAX_EXPORT_ROWS,
      select: {
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
  ]);

  const shiftLabel: Record<number, string> = {
    1: "Manha",
    2: "Tarde",
    3: "Noite",
    4: "Integral",
  };

  const rows = classGroups.map((group) => [
    group.name,
    String(group.schoolYear),
    group.shift ? shiftLabel[group.shift] ?? `Turno ${group.shift}` : "",
    group.isActive ? "Ativa" : "Inativa",
    String(group._count.enrollments),
    String(group._count.classSubjects),
    formatDate(group.createdAt),
  ]);

  return {
    title: "Relatório de Turmas",
    filePrefix: "relatorio-turmas",
    headers: [
      "Turma",
      "Ano Letivo",
      "Turno",
      "Situacao",
      "Qtde Matriculas",
      "Qtde Componentes",
      "Criada em",
    ],
    rows,
    total,
    exported: classGroups.length,
    appliedFilters: toFilterList([
      ["Busca", q || null],
      ["Ano letivo", schoolYear ? String(schoolYear) : null],
      ["Turno", shift ? String(shift) : null],
      [
        "Situacao",
        status === "active" ? "Ativas" : status === "inactive" ? "Inativas" : null,
      ],
    ]),
  };
}

async function getSubjectsDataset(search: URLSearchParams): Promise<ExportDataset> {
  const q = search.get("q")?.trim() ?? "";
  const codeFilter = search.get("codeFilter");
  const inUse = search.get("inUse");

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
    andFilters.push({ code: { not: null } });
  }
  if (codeFilter === "without_code") {
    andFilters.push({ OR: [{ code: null }, { code: "" }] });
  }
  if (inUse === "yes") andFilters.push({ classSubjects: { some: {} } });
  if (inUse === "no") andFilters.push({ classSubjects: { none: {} } });

  const where: Prisma.SubjectWhereInput = andFilters.length ? { AND: andFilters } : {};

  const [total, subjects] = await Promise.all([
    prisma.subject.count({ where }),
    prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      take: MAX_EXPORT_ROWS,
      select: {
        name: true,
        code: true,
        createdAt: true,
        _count: {
          select: { classSubjects: true },
        },
      },
    }),
  ]);

  const rows = subjects.map((subject) => [
    subject.name,
    subject.code || "",
    String(subject._count.classSubjects),
    formatDate(subject.createdAt),
  ]);

  return {
    title: "Relatório de Disciplinas",
    filePrefix: "relatorio-disciplinas",
    headers: ["Disciplina", "Codigo", "Turmas Vinculadas", "Criada em"],
    rows,
    total,
    exported: subjects.length,
    appliedFilters: toFilterList([
      ["Busca", q || null],
      [
        "Codigo",
        codeFilter === "with_code"
          ? "Com codigo"
          : codeFilter === "without_code"
            ? "Sem codigo"
            : null,
      ],
      [
        "Uso em turmas",
        inUse === "yes" ? "Em uso" : inUse === "no" ? "Sem uso" : null,
      ],
    ]),
  };
}

async function getEnrollmentsDataset(search: URLSearchParams): Promise<ExportDataset> {
  const q = search.get("q")?.trim() ?? "";
  const status = search.get("status");
  const classGroupId = parsePositiveInt(search.get("classGroupId"));
  const schoolYear = parsePositiveInt(search.get("schoolYear"));

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
  if (status && status !== "all") where.status = status;
  if (classGroupId) where.classGroupId = classGroupId;
  if (schoolYear) where.classGroup = { schoolYear };

  const [total, enrollments] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
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
  ]);

  const rows = enrollments.map((enrollment) => [
    enrollment.student.name,
    enrollment.student.registrationNumber,
    enrollment.student.cpf,
    `${enrollment.classGroup.schoolYear} - ${enrollment.classGroup.name}`,
    enrollment.status,
    formatDate(enrollment.enrolledAt),
    formatDate(enrollment.leftAt) || "",
    formatDate(enrollment.createdAt),
  ]);

  return {
    title: "Relatório de Matrículas",
    filePrefix: "relatorio-matriculas",
    headers: [
      "Aluno",
      "Matricula",
      "CPF",
      "Turma",
      "Status",
      "Data Matricula",
      "Data Saida",
      "Criada em",
    ],
    rows,
    total,
    exported: enrollments.length,
    appliedFilters: toFilterList([
      ["Busca", q || null],
      ["Status", status && status !== "all" ? status : null],
      ["Ano letivo", schoolYear ? String(schoolYear) : null],
      ["Turma (ID)", classGroupId ? String(classGroupId) : null],
    ]),
  };
}

async function getTeachersDataset(search: URLSearchParams): Promise<ExportDataset> {
  const q = search.get("q")?.trim() ?? "";
  const status = search.get("status");
  const allocation = search.get("allocation");

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
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (allocation === "with_assignment") where.teacherAssignments = { some: {} };
  if (allocation === "without_assignment") where.teacherAssignments = { none: {} };

  const [total, teachers] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
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
          select: { teacherAssignments: true },
        },
      },
    }),
  ]);

  const rows = teachers.map((teacher) => [
    teacher.user.name,
    teacher.user.cpf || "",
    teacher.user.email,
    teacher.user.phone || "",
    teacher.isActive ? "Ativo" : "Inativo",
    String(teacher._count.teacherAssignments),
    formatDate(teacher.createdAt),
  ]);

  return {
    title: "Relatório de Professores",
    filePrefix: "relatorio-professores",
    headers: [
      "Professor",
      "CPF",
      "Email",
      "Telefone",
      "Situacao",
      "Qtde Alocacoes",
      "Criado em",
    ],
    rows,
    total,
    exported: teachers.length,
    appliedFilters: toFilterList([
      ["Busca", q || null],
      [
        "Situacao",
        status === "active" ? "Ativos" : status === "inactive" ? "Inativos" : null,
      ],
      [
        "Alocacao",
        allocation === "with_assignment"
          ? "Com alocacao"
          : allocation === "without_assignment"
            ? "Sem alocacao"
            : null,
      ],
    ]),
  };
}

async function getDataset(report: ReportKey, search: URLSearchParams) {
  switch (report) {
    case "students":
      return getStudentsDataset(search);
    case "guardians":
      return getGuardiansDataset(search);
    case "class-groups":
      return getClassGroupsDataset(search);
    case "subjects":
      return getSubjectsDataset(search);
    case "enrollments":
      return getEnrollmentsDataset(search);
    case "teachers":
      return getTeachersDataset(search);
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const report = parseReport(url.searchParams.get("report"));
  const format = parseFormat(url.searchParams.get("format"));

  if (!report || !format) {
    return NextResponse.json(
      { error: "Parâmetros inválidos. Use report e format (csv|pdf)." },
      { status: 400 }
    );
  }

  const permission = reportPermissions[report];
  const auth = await requireApiPermission(permission);
  if (auth.error) return auth.error;

  const dataset = await getDataset(report, url.searchParams);
  if (!dataset) {
    return NextResponse.json({ error: "Relatório não suportado." }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const safePrefix = sanitizeFilenamePart(dataset.filePrefix || "relatorio");
  const filename = `${safePrefix}-${stamp}.${format}`;

  if (format === "csv") {
    const csv = buildCsv(dataset.headers, dataset.rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const filters =
    dataset.appliedFilters.length > 0
      ? dataset.appliedFilters
      : ["Sem filtros adicionais"];
  const subtitleLines = [
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Total filtrado: ${dataset.total} | Exportado: ${dataset.exported}`,
    dataset.total > dataset.exported
      ? `Observação: exportação limitada a ${MAX_EXPORT_ROWS} linhas.`
      : "",
    "Filtros:",
    ...filters.map((filter) => `- ${filter}`),
  ].filter(Boolean);

  const pdf = buildSimpleTablePdf({
    title: dataset.title,
    subtitleLines,
    headers: dataset.headers,
    rows: dataset.rows,
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
