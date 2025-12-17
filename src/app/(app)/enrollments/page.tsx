import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { EnrollmentTable } from "./components/enrollment-table";
import type { EnrollmentRow, Option } from "./types";

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("enrollments.read");
  const canWrite = hasPermission(user, "enrollments.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const numeric = Number(q);
  const where = q
    ? {
        OR: [
          { student: { name: { contains: q, mode: "insensitive" as const } } },
          { student: { registrationNumber: { contains: q, mode: "insensitive" as const } } },
          {
            classGroup: {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                ...(Number.isInteger(numeric) ? [{ schoolYear: numeric }] : []),
              ],
            },
          },
        ],
      }
    : {};

  const [enrollments, total, students, classGroups] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        student: { select: { name: true, id: true } },
        classGroup: { select: { name: true, schoolYear: true, id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.enrollment.count({ where }),
    prisma.student.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.classGroup.findMany({
      where: { isActive: true },
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      select: { id: true, name: true, schoolYear: true },
    }),
  ]);

  const enrollmentRows: EnrollmentRow[] = enrollments.map((enrollment) => ({
    id: enrollment.id,
    studentId: enrollment.studentId,
    classGroupId: enrollment.classGroupId,
    studentName: enrollment.student.name,
    classGroupName: `${enrollment.classGroup.schoolYear} - ${enrollment.classGroup.name}`,
    status: enrollment.status,
    enrolledAt: formatDate(enrollment.enrolledAt),
    leftAt: formatDate(enrollment.leftAt),
    createdAt: formatDate(enrollment.createdAt),
  }));

  const studentOptions: Option[] = students.map((s) => ({ id: s.id, label: s.name }));
  const classGroupOptions: Option[] = classGroups.map((g) => ({
    id: g.id,
    label: `${g.schoolYear} - ${g.name}`,
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por aluno, turma ou matrícula"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <EnrollmentTable
        data={enrollmentRows}
        canWrite={canWrite}
        students={studentOptions}
        classGroups={classGroupOptions}
      />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/enrollments"
        query={{ q }}
      />
    </div>
  );
}
