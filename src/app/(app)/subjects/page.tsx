import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { SubjectTable } from "./components/subject-table";
import type { SubjectRow } from "./types";

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("subjects.read");
  const canWrite = hasPermission(user, "subjects.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: perPage,
    }),
    prisma.subject.count({ where }),
  ]);

  const rows: SubjectRow[] = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    createdAt: formatDate(subject.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome ou código"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <SubjectTable data={rows} canWrite={canWrite} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/subjects"
        query={{ q }}
      />
    </div>
  );
}
