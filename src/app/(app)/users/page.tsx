import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { formatPhone, formatCpf } from "@/lib/utils";
import type { GroupOption, UserRow } from "./types";
import { UserTable } from "./components/user-table";
import type { Prisma } from "@prisma/client";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const user = await requirePermission("users.read");
  const canWrite = hasPermission(user, "users.write");
  const isMaster = user.group.name === "Master";

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch?.page) > 0 ? Number(resolvedSearch?.page) : 1;
  const q = resolvedSearch?.q?.toString().trim() ?? "";
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const baseWhere: Prisma.UserWhereInput =
    q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { group: { name: { contains: q, mode: "insensitive" as const } } },
            { phone: { contains: q.replace(/\D/g, "") } },
          ],
        }
      : {};

  const where: Prisma.UserWhereInput = isMaster
    ? baseWhere
    : Object.keys(baseWhere).length
      ? { AND: [baseWhere, { group: { name: { not: "Master" } } }] }
      : { group: { name: { not: "Master" } } };

  const [users, total, groups] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { group: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.user.count({ where }),
    prisma.userGroup.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    groupId: u.groupId,
    groupName: u.group.name,
    isActive: u.isActive,
    cpf: formatCpf(u.cpf),
    phone: formatPhone(u.phone),
    avatarUrl: u.avatarUrl,
    createdAt: formatDate(u.createdAt),
    lastLoginAt: formatDate(u.lastLoginAt),
  }));

  const groupOptions: GroupOption[] = groups
    .filter((g) => isMaster || g.name !== "Master")
    .map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-center gap-3" method="get">
        <Input
          name="q"
          placeholder="Buscar por nome, e-mail ou grupo"
          defaultValue={q}
          className="w-full max-w-sm"
        />
        <Button type="submit">Buscar</Button>
      </form>

      <UserTable data={rows} groups={groupOptions} canWrite={canWrite} />

      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        basePath="/users"
        query={{ q }}
      />
    </div>
  );
}
