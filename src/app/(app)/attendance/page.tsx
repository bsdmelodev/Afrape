import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/formatters";
import { formatCpf, formatPhone } from "@/lib/utils";
import { SessionTable } from "./components/session-table";
import type {
  AttendanceClassSubjectOption,
  AttendanceRow,
  AttendanceTeacherOption,
  AttendanceTermOption,
} from "./types";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("attendance.read");
  const canWrite = hasPermission(user, "attendance.write");

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

  const [sessions, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      orderBy: { sessionDate: "desc" },
      skip,
      take: perPage,
      include: {
        classSubject: {
          select: {
            id: true,
            classGroup: { select: { name: true, schoolYear: true } },
            subject: { select: { name: true } },
          },
        },
        term: { select: { id: true, name: true, schoolYear: true } },
        teacher: {
          select: { id: true, user: { select: { name: true, email: true, cpf: true, phone: true } } },
        },
      },
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  const classSubjects: AttendanceClassSubjectOption[] = await prisma.classSubject
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

  const terms: AttendanceTermOption[] = await prisma.academicTerm
    .findMany({ orderBy: { schoolYear: "desc" } })
    .then((list) => list.map((t) => ({ id: t.id, name: t.name, schoolYear: t.schoolYear })));

  const teachers: AttendanceTeacherOption[] = await prisma.teacher
    .findMany({
      where: { isActive: true },
      orderBy: { user: { name: "asc" } },
      select: { id: true, user: { select: { name: true, email: true } } },
    })
    .then((list) => list.map((t) => ({ id: t.id, name: t.user.name, email: t.user.email })));

  const rows: AttendanceRow[] = sessions.map((session) => ({
    id: session.id,
    classSubjectId: session.classSubjectId,
    classSubjectName: session.classSubject.subject.name,
    classGroupName: session.classSubject.classGroup.name,
    classGroupYear: session.classSubject.classGroup.schoolYear,
    termId: session.termId,
    termName: session.term ? `${session.term.schoolYear} — ${session.term.name}` : null,
    sessionDate: formatDate(session.sessionDate),
    lessonNumber: session.lessonNumber,
    startsAt: session.startsAt ? formatTime(session.startsAt) : null,
    endsAt: session.endsAt ? formatTime(session.endsAt) : null,
    content: session.content,
    teacherId: session.launchedByTeacherId,
    teacherName: session.teacher.user.name,
    teacherEmail: session.teacher.user.email,
    teacherCpf: formatCpf(session.teacher.user.cpf),
    teacherPhone: formatPhone(session.teacher.user.phone),
    createdAt: formatDate(session.createdAt),
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

      <SessionTable
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
        basePath="/attendance"
        query={{ q }}
      />
    </div>
  );
}
