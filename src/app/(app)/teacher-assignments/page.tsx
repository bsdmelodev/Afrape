import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { AssignmentTable } from "./components/assignment-table";
import type {
  AssignmentClassSubjectOption,
  AssignmentRow,
  AssignmentTeacherOption,
} from "./types";

export default async function TeacherAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("teacher_assignments.read");
  const canWrite = hasPermission(user, "teacher_assignments.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const yearNumber = Number(q);
  const where = q
    ? {
        OR: [
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
                  ...(Number.isInteger(yearNumber) ? [{ schoolYear: yearNumber }] : []),
                ],
              },
            },
          },
          {
            teacher: {
              OR: [
                { user: { name: { contains: q, mode: "insensitive" as const } } },
                { user: { email: { contains: q, mode: "insensitive" as const } } },
              ],
            },
          },
        ],
      }
    : {};

  const [assignments, total] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
        teacher: { select: { id: true, user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.teacherAssignment.count({ where }),
  ]);

  const classSubjects: AssignmentClassSubjectOption[] = await prisma.classSubject
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
      records.map((record) => ({
        id: record.id,
        label: `${record.classGroup.schoolYear} — ${record.classGroup.name} • ${record.subject.name}${record.subject.code ? ` (${record.subject.code})` : ""}`,
      }))
    );

  const teachers: AssignmentTeacherOption[] = await prisma.teacher
    .findMany({
      where: { isActive: true },
      select: { id: true, user: { select: { name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    })
    .then((records) => records.map((t) => ({ id: t.id, name: t.user.name, email: t.user.email })));

  const rows: AssignmentRow[] = assignments.map((assignment) => ({
    id: assignment.id,
    classSubjectId: assignment.classSubjectId,
    classSubjectName: assignment.classSubject.subject.name,
    classGroupName: assignment.classSubject.classGroup.name,
    classGroupYear: assignment.classSubject.classGroup.schoolYear,
    teacherId: assignment.teacherId,
    teacherName: assignment.teacher.user.name,
    teacherEmail: assignment.teacher.user.email,
    role: assignment.role,
    startsAt: formatDate(assignment.startsAt),
    endsAt: formatDate(assignment.endsAt),
    createdAt: formatDate(assignment.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por professor, turma ou disciplina"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <AssignmentTable
        data={rows}
        canWrite={canWrite}
        classSubjects={classSubjects}
        teachers={teachers}
      />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/teacher-assignments"
        query={{ q }}
      />
    </div>
  );
}
