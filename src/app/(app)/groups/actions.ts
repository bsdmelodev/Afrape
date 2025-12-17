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

export async function createGroup(data: GroupInput) {
  await requirePermission("groups.write");
  const parsed = groupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  try {
    await prisma.userGroup.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        groupPermissions: {
          createMany: {
            data: parsed.data.permissionIds.map((permissionId) => ({
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
  await requirePermission("groups.write");
  const parsed = groupSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  try {
    await prisma.$transaction([
      prisma.groupPermission.deleteMany({ where: { groupId: id } }),
      prisma.userGroup.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description?.trim() || null,
          groupPermissions: {
            createMany: {
              data: parsed.data.permissionIds.map((permissionId) => ({
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
  await requirePermission("groups.write");
  try {
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
