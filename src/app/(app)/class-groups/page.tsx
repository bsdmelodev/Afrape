import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { ClassGroupTable } from "./components/class-group-table";
import type { ClassGroupRow } from "./types";

const SHIFT_LABELS: Record<number, string> = {
  1: "Manhã",
  2: "Tarde",
  3: "Noite",
  4: "Integral",
};

function resolveShiftQuery(q: string) {
  const normalized = q.trim().toLowerCase();
  const entry = Object.entries(SHIFT_LABELS).find(([, label]) =>
    label.toLowerCase().startsWith(normalized)
  );
  return entry ? Number(entry[0]) : null;
}

export default async function ClassGroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("class_groups.read");
  const canWrite = hasPermission(user, "class_groups.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const numeric = Number(q);
  const shiftQuery = q ? resolveShiftQuery(q) : null;
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          ...(Number.isInteger(numeric) ? [{ schoolYear: numeric }] : []),
          ...(shiftQuery ? [{ shift: shiftQuery }] : []),
        ],
      }
    : {};

  const [groups, total] = await Promise.all([
    prisma.classGroup.findMany({
      where,
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      skip,
      take: perPage,
    }),
    prisma.classGroup.count({ where }),
  ]);

  const rows: ClassGroupRow[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    schoolYear: group.schoolYear,
    shift: group.shift ? SHIFT_LABELS[group.shift] ?? `Turno ${group.shift}` : null,
    isActive: group.isActive,
    createdAt: formatDate(group.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome, turno ou ano"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <ClassGroupTable data={rows} canWrite={canWrite} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/class-groups"
        query={{ q }}
      />
    </div>
  );
}
