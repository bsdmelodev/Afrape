import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { StudentTable } from "./components/student-table";
import { Pagination } from "@/components/pagination";
import type { StudentRow } from "./types";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("students.read");
  const canWrite = hasPermission(user, "students.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const digits = q.replace(/\D/g, "");
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { registrationNumber: { contains: q, mode: "insensitive" as const } },
          ...(digits ? [{ cpf: { contains: digits } }] : []),
          { email: { contains: q, mode: "insensitive" as const } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        guardians: {
          include: {
            guardian: {
              select: { id: true, name: true, cpf: true, phone: true },
            },
          },
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  const guardianOptions = await prisma.guardian.findMany({
    select: { id: true, name: true, cpf: true },
    orderBy: { name: "asc" },
  });

  const rows: StudentRow[] = students.map((student) => ({
    id: student.id,
    name: student.name,
    registrationNumber: student.registrationNumber,
    birthDate: formatDate(student.birthDate),
    cpf: student.cpf,
    email: student.email,
    phone: student.phone,
    isActive: student.isActive,
    createdAt: formatDate(student.createdAt),
    guardians: student.guardians.map((link) => ({
      guardianId: link.guardianId,
      guardianName: link.guardian.name,
      guardianCpf: link.guardian.cpf,
      guardianPhone: link.guardian.phone,
      relationship: link.relationship,
      isPrimary: link.isPrimary,
      isFinancial: link.isFinancial,
      livesWithStudent: link.livesWithStudent,
    })),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome, matrícula, CPF ou e-mail"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <StudentTable
        data={rows}
        canWrite={canWrite}
        guardianOptions={guardianOptions}
      />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/students"
        query={{ q }}
      />
    </div>
  );
}
