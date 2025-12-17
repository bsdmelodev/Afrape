import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { requirePermission, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { ClassSubjectTable } from "./components/class-subject-table";
import type {
  ClassGroupOption,
  ClassSubjectRow,
  SubjectOption,
} from "./types";

export default async function ClassSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("class_subjects.read");
  const canWrite = hasPermission(user, "class_subjects.write");

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
            {
              classGroup: {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  ...(Number.isInteger(numeric) ? [{ schoolYear: numeric }] : []),
                ],
              },
            },
            {
              subject: {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { code: { contains: q, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        }
      : {};

  const [records, total] = await Promise.all([
    prisma.classSubject.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        classGroup: { select: { id: true, name: true, schoolYear: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.classSubject.count({ where }),
  ]);

  const classGroups: ClassGroupOption[] = await prisma.classGroup.findMany({
    orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
    select: { id: true, name: true, schoolYear: true },
  });

  const subjects: SubjectOption[] = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  const rows: ClassSubjectRow[] = records.map((record) => ({
    id: record.id,
    classGroupId: record.classGroupId,
    classGroupName: record.classGroup.name,
    classGroupYear: record.classGroup.schoolYear,
    subjectId: record.subjectId,
    subjectName: record.subject.name,
    subjectCode: record.subject.code,
    workloadMinutes: record.workloadMinutes,
    createdAt: formatDate(record.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por turma, ano ou disciplina"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <ClassSubjectTable
        data={rows}
        canWrite={canWrite}
        classGroups={classGroups}
        subjects={subjects}
      />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/class-subjects"
        query={{ q }}
      />
    </div>
  );
}
