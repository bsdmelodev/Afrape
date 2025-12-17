import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import type { PermissionRow } from "./types";
import { PermissionTable } from "./components/permission-table";

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("permissions.read");
  const canWrite = hasPermission(user, "permissions.write");

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const where =
    q.length > 0
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const [permissions, total] = await Promise.all([
    prisma.permission.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take: perPage,
    }),
    prisma.permission.count({ where }),
  ]);

  const rows: PermissionRow[] = permissions.map((p) => ({
    id: p.id,
    code: p.code,
    description: p.description,
  }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por código ou descrição"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <PermissionTable data={rows} canWrite={canWrite} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/permissions"
        query={{ q }}
      />
    </div>
  );
}
