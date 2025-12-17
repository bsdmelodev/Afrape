import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { ScoreTable } from "./components/score-table";
import type { AssessmentOption, EnrollmentOption, ScoreRow } from "./types";

export default async function AssessmentScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("assessments.read");
  const canWrite = hasPermission(user, "assessments.write");

  const resolved = await searchParams;
  const page = Number(resolved?.page) > 0 ? Number(resolved?.page) : 1;
  const q = resolved?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const where = q
    ? {
        OR: [
          { assessment: { title: { contains: q, mode: "insensitive" as const } } },
          {
            assessment: {
              classSubject: {
                subject: { name: { contains: q, mode: "insensitive" as const } },
              },
            },
          },
          { enrollment: { student: { name: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : {};

  const [scores, total] = await Promise.all([
    prisma.assessmentScore.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            assessmentDate: true,
            classSubject: {
              select: {
                classGroup: { select: { name: true, schoolYear: true } },
                subject: { select: { name: true } },
              },
            },
          },
        },
        enrollment: {
          select: {
            id: true,
            student: { select: { name: true, registrationNumber: true } },
            classGroup: { select: { name: true, schoolYear: true } },
          },
        },
      },
    }),
    prisma.assessmentScore.count({ where }),
  ]);

  const assessments: AssessmentOption[] = await prisma.assessment
    .findMany({
      orderBy: { assessmentDate: "desc" },
      include: {
        classSubject: {
          select: {
            classGroup: { select: { name: true, schoolYear: true } },
            subject: { select: { name: true, code: true } },
          },
        },
      },
    })
    .then((list) =>
      list.map((a) => ({
        id: a.id,
        label: `${formatDate(a.assessmentDate)} • ${a.title} — ${a.classSubject.subject.name} (${a.classSubject.subject.code ?? "s/ código"}) • ${a.classSubject.classGroup.schoolYear} ${a.classSubject.classGroup.name}`,
      }))
    );

  const enrollments: EnrollmentOption[] = await prisma.enrollment
    .findMany({
      include: {
        student: { select: { name: true, registrationNumber: true } },
        classGroup: { select: { name: true, schoolYear: true } },
      },
      orderBy: [
        { classGroup: { schoolYear: "desc" } },
        { classGroup: { name: "asc" } },
        { student: { name: "asc" } },
      ],
    })
    .then((list) =>
      list.map((e) => ({
        id: e.id,
        label: `${e.classGroup.schoolYear} ${e.classGroup.name} • ${e.student.name} (${e.student.registrationNumber ?? "s/ matrícula"})`,
      }))
    );

  const rows: ScoreRow[] = scores.map((score) => ({
    assessmentId: score.assessmentId,
    enrollmentId: score.enrollmentId,
    assessmentTitle: score.assessment.title,
    assessmentDate: formatDate(score.assessment.assessmentDate),
    classGroupName: score.assessment.classSubject.classGroup.name,
    classGroupYear: score.assessment.classSubject.classGroup.schoolYear,
    subjectName: score.assessment.classSubject.subject.name,
    studentName: score.enrollment.student.name,
    registrationNumber: score.enrollment.student.registrationNumber,
    score: score.score ? Number(score.score) : null,
    isAbsent: score.isAbsent,
    isExcused: score.isExcused,
    notes: score.notes,
    createdAt: formatDate(score.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por avaliação, aluno ou disciplina"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <ScoreTable data={rows} canWrite={canWrite} assessments={assessments} enrollments={enrollments} />

      <Pagination page={page} perPage={perPage} total={total} basePath="/assessment-scores" query={{ q }} />
    </div>
  );
}
