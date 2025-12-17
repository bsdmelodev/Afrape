import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import type { GroupRow } from "./types";
import { GroupTable } from "./components/group-table";

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("groups.read");
  const canWrite = hasPermission(user, "groups.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const where =
    q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const [groups, total, permissions] = await Promise.all([
    prisma.userGroup.findMany({
      where,
      include: {
        groupPermissions: {
          include: { permission: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.userGroup.count({ where }),
    prisma.permission.findMany({ orderBy: { code: "asc" } }),
  ]);

  const allPermissions = permissions.map((p) => ({
    id: p.id,
    code: p.code,
    description: p.description,
  }));

  const rows: GroupRow[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    permissions: g.groupPermissions.map((gp) => gp.permission.code),
    createdAt: formatDate(g.createdAt),
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome ou descrição do grupo"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <GroupTable data={rows} canWrite={canWrite} allPermissions={allPermissions} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/groups"
        query={{ q }}
      />
    </div>
  );
}
