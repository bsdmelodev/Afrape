import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { GuardianTable } from "./components/guardian-table";
import type { GuardianRow } from "./types";

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("guardians.read");
  const canWrite = hasPermission(user, "guardians.write");

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
          ...(digits ? [{ cpf: { contains: digits } }] : []),
          { email: { contains: q, mode: "insensitive" as const } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};

  const [guardians, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
      include: {
        studentLinks: {
          include: {
            student: {
              select: { id: true, name: true, registrationNumber: true },
            },
          },
        },
      },
    }),
    prisma.guardian.count({ where }),
  ]);

  const rows: GuardianRow[] = guardians.map((guardian) => ({
    id: guardian.id,
    name: guardian.name,
    cpf: guardian.cpf,
    email: guardian.email,
    phone: guardian.phone,
    createdAt: formatDate(guardian.createdAt),
    students: guardian.studentLinks.map((link) => ({
      id: link.student.id,
      name: link.student.name,
      registrationNumber: link.student.registrationNumber,
    })),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome, CPF, e-mail ou telefone"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <GuardianTable data={rows} canWrite={canWrite} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/guardians"
        query={{ q }}
      />
    </div>
  );
}
