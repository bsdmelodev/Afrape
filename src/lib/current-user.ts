import { cache } from "react";
import { prisma } from "./prisma";
import { readSessionUserId } from "./session";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  cpf?: string | null;
  phone?: string | null;
  group: { id: number; name: string };
  permissions: string[];
  avatarUrl?: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      group: {
        include: {
          groupPermissions: { include: { permission: true } },
        },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const permissions = user.group.groupPermissions.map((gp) => gp.permission.code);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    cpf: user.cpf,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    group: { id: user.group.id, name: user.group.name },
    permissions,
  };
});
