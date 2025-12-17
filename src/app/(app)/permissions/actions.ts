"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const permissionSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  description: z.string().optional(),
});

export type PermissionInput = z.infer<typeof permissionSchema>;

export async function createPermission(data: PermissionInput) {
  await requirePermission("permissions.write");
  const parsed = permissionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  try {
    await prisma.permission.create({
      data: {
        code: parsed.data.code,
        description: parsed.data.description?.trim() || null,
      },
    });
    revalidatePath("/permissions");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Código já cadastrado.",
      }),
    };
  }
}

export async function updatePermission(id: number, data: PermissionInput) {
  await requirePermission("permissions.write");
  const parsed = permissionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  try {
    await prisma.permission.update({
      where: { id },
      data: {
        code: parsed.data.code,
        description: parsed.data.description?.trim() || null,
      },
    });
    revalidatePath("/permissions");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Código já cadastrado.",
      }),
    };
  }
}

export async function deletePermission(id: number) {
  await requirePermission("permissions.write");
  try {
    await prisma.permission.delete({ where: { id } });
    revalidatePath("/permissions");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: permissão vinculada a grupos.",
      }),
    };
  }
}
