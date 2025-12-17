"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const groupSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  permissionIds: z.array(z.number().int()).default([]),
});

export type GroupInput = z.infer<typeof groupSchema>;

const restrictedPermissionCodes = ["settings.read", "settings.write"];

async function filterRestrictedPermissions(permissionIds: number[], isMaster: boolean) {
  if (isMaster || permissionIds.length === 0) return permissionIds;
  const restricted = await prisma.permission.findMany({
    where: { code: { in: restrictedPermissionCodes } },
    select: { id: true },
  });
  const restrictedIds = new Set(restricted.map((p) => p.id));
  return permissionIds.filter((id) => !restrictedIds.has(id));
}

function isMasterGroupName(name: string) {
  return name.trim().toLowerCase() === "master";
}

export async function createGroup(data: GroupInput) {
  const user = await requirePermission("groups.write");
  const isMaster = user.group.name === "Master";
  const parsed = groupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }
  if (!isMaster && isMasterGroupName(parsed.data.name)) {
    return { error: "Apenas usuários Master podem criar o grupo Master." };
  }
  const permissionIds = await filterRestrictedPermissions(parsed.data.permissionIds, isMaster);

  try {
    await prisma.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        groupPermissions: {
          createMany: {
            data: permissionIds.map((permissionId) => ({
              permissionId,
            })),
          },
        },
      },
    });
    revalidatePath("/groups");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Nome de grupo já cadastrado.",
      }),
    };
  }
}

export async function updateGroup(id: number, data: GroupInput) {
  const user = await requirePermission("groups.write");
  const isMaster = user.group.name === "Master";
  const parsed = groupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }
  if (!isMaster && isMasterGroupName(parsed.data.name)) {
    return { error: "Apenas usuários Master podem renomear para Master." };
  }

  try {
    const existing = await prisma.userGroup.findUnique({ where: { id } });
    if (!existing) {
      return { error: "Grupo não encontrado." };
    }
    if (existing.name === "Master" && !isMaster) {
      return { error: "Apenas usuários Master podem alterar o grupo Master." };
    }
    const permissionIds = await filterRestrictedPermissions(parsed.data.permissionIds, isMaster);
    await prisma.$transaction([
      prisma.groupPermission.deleteMany({ where: { groupId: id } }),
      prisma.userGroup.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description?.trim() || null,
          groupPermissions: {
            createMany: {
              data: permissionIds.map((permissionId) => ({
                permissionId,
              })),
            },
          },
        },
      }),
    ]);
    revalidatePath("/groups");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Nome de grupo já cadastrado.",
      }),
    };
  }
}

export async function deleteGroup(id: number) {
  const user = await requirePermission("groups.write");
  const isMaster = user.group.name === "Master";
  try {
    const existing = await prisma.userGroup.findUnique({ where: { id } });
    if (!existing) {
      return { error: "Grupo não encontrado." };
    }
    if (existing.name === "Master" && !isMaster) {
      return { error: "Apenas usuários Master podem excluir o grupo Master." };
    }
    await prisma.userGroup.delete({ where: { id } });
    revalidatePath("/groups");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: grupo vinculado a usuários ou permissões.",
      }),
    };
  }
}
