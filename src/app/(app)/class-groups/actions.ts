"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const classGroupSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  schoolYear: z.number().int().min(1900, "Ano inválido"),
  shift: z.number().int().min(1).max(4).optional(),
  isActive: z.boolean().optional(),
});

export type ClassGroupInput = z.infer<typeof classGroupSchema>;

function normalize(input: ClassGroupInput) {
  return {
    name: input.name,
    schoolYear: input.schoolYear,
    shift: input.shift ?? null,
    isActive: input.isActive ?? true,
  };
}

export async function createClassGroup(data: ClassGroupInput) {
  await requirePermission("class_groups.write");
  const parsed = classGroupSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.classGroup.create({ data: normalize(parsed.data) });
    revalidatePath("/class-groups");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe uma turma com esse ano e nome.",
      }),
    };
  }
}

export async function updateClassGroup(id: number, data: ClassGroupInput) {
  await requirePermission("class_groups.write");
  const parsed = classGroupSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.classGroup.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/class-groups");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe uma turma com esse ano e nome.",
      }),
    };
  }
}

export async function deleteClassGroup(id: number) {
  await requirePermission("class_groups.write");
  try {
    await prisma.classGroup.delete({ where: { id } });
    revalidatePath("/class-groups");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: turma com matrículas, componentes ou frequência vinculada.",
      }),
    };
  }
}
