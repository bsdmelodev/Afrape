import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { requirePermission, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { TeacherTable } from "./components/teacher-table";
import type { TeacherRow, UserOption } from "./types";
import type { Prisma } from "@prisma/client";

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("teachers.read");
  const canWrite = hasPermission(user, "teachers.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const digits = q.replace(/\D/g, "");
  const where: Prisma.TeacherWhereInput = q
    ? {
        OR: [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
          ...(digits ? [{ user: { cpf: { contains: digits } } }] : []),
          ...(digits ? [{ user: { phone: { contains: digits } } }] : []),
        ],
      }
    : {};

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        user: { select: { id: true, name: true, email: true, cpf: true, phone: true } },
      },
    }),
    prisma.teacher.count({ where }),
  ]);

  const userOptions: UserOption[] = await prisma.user
    .findMany({
      where: { isActive: true, group: { name: "Professor" } },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
        teacher: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    })
    .then((users) =>
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        cpf: u.cpf ?? null,
        phone: u.phone ?? null,
        teacherId: u.teacher?.id ?? null,
      }))
    );

  const rows: TeacherRow[] = teachers.map((teacher) => ({
    id: teacher.id,
    userId: teacher.userId,
    userName: teacher.user.name,
    userEmail: teacher.user.email,
    userCpf: teacher.user.cpf,
    userPhone: teacher.user.phone,
    isActive: teacher.isActive,
    createdAt: formatDate(teacher.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome, e-mail ou CPF"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <TeacherTable data={rows} canWrite={canWrite} userOptions={userOptions} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/teachers"
        query={{ q }}
      />
    </div>
  );
}
