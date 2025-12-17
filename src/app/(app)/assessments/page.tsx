import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { AssessmentTable } from "./components/assessment-table";
import type {
  AssessmentClassSubjectOption,
  AssessmentRow,
  AssessmentTeacherOption,
  AssessmentTermOption,
} from "./types";

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("assessments.read");
  const canWrite = hasPermission(user, "assessments.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const numeric = Number(q);
  const where =
    q.length > 0
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { assessmentType: { contains: q, mode: "insensitive" as const } },
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
            { teacher: { user: { name: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {};

  const [assessments, total] = await Promise.all([
    prisma.assessment.findMany({
      where,
      orderBy: { assessmentDate: "desc" },
      skip,
      take: perPage,
      include: {
        classSubject: {
          select: {
            id: true,
            classGroup: { select: { name: true, schoolYear: true } },
            subject: { select: { name: true, code: true } },
          },
        },
        term: { select: { id: true, name: true, schoolYear: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.assessment.count({ where }),
  ]);

  const classSubjects: AssessmentClassSubjectOption[] = await prisma.classSubject
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

  const terms: AssessmentTermOption[] = await prisma.academicTerm
    .findMany({ orderBy: { schoolYear: "desc" } })
    .then((list) => list.map((t) => ({ id: t.id, name: t.name, schoolYear: t.schoolYear })));

  const teachers: AssessmentTeacherOption[] = await prisma.teacher
    .findMany({
      where: { isActive: true },
      orderBy: { user: { name: "asc" } },
      select: { id: true, user: { select: { name: true } } },
    })
    .then((list) => list.map((t) => ({ id: t.id, name: t.user.name })));

  const rows: AssessmentRow[] = assessments.map((assessment) => ({
    id: assessment.id,
    classSubjectId: assessment.classSubjectId,
    classSubjectName: assessment.classSubject.subject.name,
    classGroupName: assessment.classSubject.classGroup.name,
    classGroupYear: assessment.classSubject.classGroup.schoolYear,
    termId: assessment.termId,
    termName: `${assessment.term.schoolYear} — ${assessment.term.name}`,
    title: assessment.title,
    assessmentType: assessment.assessmentType,
    assessmentDate: formatDate(assessment.assessmentDate),
    weight: Number(assessment.weight),
    maxScore: Number(assessment.maxScore),
    isPublished: assessment.isPublished,
    createdByTeacherId: assessment.createdByTeacherId,
    createdByTeacherName: assessment.teacher.user.name,
    createdAt: formatDate(assessment.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por título, professor, turma ou disciplina"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <AssessmentTable
        data={rows}
        canWrite={canWrite}
        classSubjects={classSubjects}
        terms={terms}
        teachers={teachers}
      />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/assessments"
        query={{ q }}
      />
    </div>
  );
}
