import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { TermGradeTable } from "./components/term-grade-table";
import type {
  TermGradeClassSubjectOption,
  TermGradeEnrollmentOption,
  TermGradeRow,
  TermGradeTermOption,
} from "./types";

export default async function TermGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("term_grades.read");
  const canWrite = hasPermission(user, "term_grades.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const numeric = Number(q);
  const where = q
    ? {
        OR: [
          {
            enrollment: {
              student: {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { registrationNumber: { contains: q, mode: "insensitive" as const } },
                ],
              },
            },
          },
          {
            classSubject: {
              subject: {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { code: { contains: q, mode: "insensitive" as const } },
                ],
              },
            },
          },
          {
            classSubject: {
              classGroup: {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  ...(Number.isInteger(numeric) ? [{ schoolYear: numeric }] : []),
                ],
              },
            },
          },
          { term: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [records, total] = await Promise.all([
    prisma.termGrade.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        enrollment: {
          select: {
            id: true,
            student: { select: { name: true, registrationNumber: true } },
            classGroup: { select: { name: true, schoolYear: true } },
          },
        },
        classSubject: {
          select: {
            id: true,
            subject: { select: { name: true, code: true } },
            classGroup: { select: { name: true, schoolYear: true } },
          },
        },
        term: { select: { id: true, name: true, schoolYear: true } },
      },
    }),
    prisma.termGrade.count({ where }),
  ]);

  const enrollments: TermGradeEnrollmentOption[] = await prisma.enrollment
    .findMany({
      include: {
        student: { select: { name: true, registrationNumber: true } },
        classGroup: { select: { name: true, schoolYear: true } },
      },
      orderBy: [
        { classGroup: { schoolYear: "desc" } },
        { classGroup: { name: "asc" } },
      ],
    })
    .then((list) =>
      list.map((e) => ({
        id: e.id,
        label: `${e.classGroup.schoolYear} — ${e.classGroup.name} • ${e.student.name} (${e.student.registrationNumber})`,
      }))
    );

  const classSubjects: TermGradeClassSubjectOption[] = await prisma.classSubject
    .findMany({
      include: {
        classGroup: { select: { name: true, schoolYear: true } },
        subject: { select: { name: true, code: true } },
      },
      orderBy: [
        { classGroup: { schoolYear: "desc" } },
        { classGroup: { name: "asc" } },
      ],
    })
    .then((records) =>
      records.map((r) => ({
        id: r.id,
        label: `${r.classGroup.schoolYear} — ${r.classGroup.name} • ${r.subject.name}${
          r.subject.code ? ` (${r.subject.code})` : ""
        }`,
      }))
    );

  const terms: TermGradeTermOption[] = await prisma.academicTerm
    .findMany({ orderBy: { schoolYear: "desc" } })
    .then((list) => list.map((t) => ({ id: t.id, label: `${t.schoolYear} — ${t.name}` })));

  const rows: TermGradeRow[] = records.map((record) => ({
    id: record.id,
    enrollmentId: record.enrollmentId,
    enrollmentLabel: `${record.enrollment.classGroup.schoolYear} — ${record.enrollment.classGroup.name} • ${record.enrollment.student.registrationNumber}`,
    studentName: record.enrollment.student.name,
    classGroupName: record.enrollment.classGroup.name,
    classGroupYear: record.enrollment.classGroup.schoolYear,
    classSubjectId: record.classSubjectId,
    classSubjectName: record.classSubject.subject.name,
    termId: record.termId,
    termName: `${record.term.schoolYear} — ${record.term.name}`,
    grade: record.grade ? Number(record.grade) : null,
    absencesCount: record.absencesCount,
    attendancePercentage: record.attendancePercentage ? Number(record.attendancePercentage) : null,
    isClosed: record.isClosed,
    createdAt: formatDate(record.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por aluno, turma ou disciplina"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <TermGradeTable
        data={rows}
        canWrite={canWrite}
        enrollments={enrollments}
        classSubjects={classSubjects}
        terms={terms}
      />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/term-grades"
        query={{ q }}
      />
    </div>
  );
}
