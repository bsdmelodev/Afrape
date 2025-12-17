import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatters";
import { TermTable } from "./components/term-table";
import type { TermRow } from "./types";

export default async function AcademicTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("academic_terms.read");
  const canWrite = hasPermission(user, "academic_terms.write");

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
            { name: { contains: q, mode: "insensitive" as const } },
            ...(Number.isInteger(numeric) ? [{ schoolYear: numeric }, { termOrder: numeric }] : []),
          ],
        }
      : {};

  const [terms, total] = await Promise.all([
    prisma.academicTerm.findMany({
      where,
      orderBy: { schoolYear: "desc" },
      skip,
      take: perPage,
    }),
    prisma.academicTerm.count({ where }),
  ]);

  const rows: TermRow[] = terms.map((term) => ({
    id: term.id,
    schoolYear: term.schoolYear,
    name: term.name,
    termOrder: term.termOrder,
    startsAt: formatDate(term.startsAt),
    endsAt: formatDate(term.endsAt),
    createdAt: formatDate(term.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome, ano ou ordem"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <TermTable data={rows} canWrite={canWrite} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/academic-terms"
        query={{ q }}
      />
    </div>
  );
}
