export type ReportDefinition = {
  key:
    | "students"
    | "guardians"
    | "class-groups"
    | "subjects"
    | "enrollments"
    | "teachers";
  label: string;
  href: string;
  permission: string;
  description: string;
};

export const reportDefinitions: ReportDefinition[] = [
  {
    key: "students",
    label: "Alunos",
    href: "/reports/students",
    permission: "students.read",
    description: "Relatório de alunos com filtros por turma, ano e situação.",
  },
  {
    key: "guardians",
    label: "Responsáveis",
    href: "/reports/guardians",
    permission: "guardians.read",
    description: "Relação de responsáveis com vínculo de alunos.",
  },
  {
    key: "class-groups",
    label: "Turmas",
    href: "/reports/class-groups",
    permission: "class_groups.read",
    description: "Turmas por ano/turno e indicadores de uso.",
  },
  {
    key: "subjects",
    label: "Disciplinas",
    href: "/reports/subjects",
    permission: "subjects.read",
    description: "Disciplinas com código e utilização em turmas.",
  },
  {
    key: "enrollments",
    label: "Matrículas",
    href: "/reports/enrollments",
    permission: "enrollments.read",
    description: "Matrículas por aluno, turma, ano e status.",
  },
  {
    key: "teachers",
    label: "Professores",
    href: "/reports/teachers",
    permission: "teachers.read",
    description: "Professores com situação e alocações.",
  },
];

export const reportPermissions = reportDefinitions.map((item) => item.permission);

export const reportSelectClassName =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

type ExportFormat = "csv" | "pdf";

export function buildReportExportHref(
  report: ReportDefinition["key"],
  format: ExportFormat,
  query: Record<string, string | undefined>
) {
  const params = new URLSearchParams({ report, format });
  Object.entries(query).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, value);
  });
  return `/api/reports/export?${params.toString()}`;
}
