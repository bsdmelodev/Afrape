"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const teacherSchema = z.object({
  userId: z.number().int().positive("Selecione um usuário"),
  isActive: z.boolean().optional(),
});

export type TeacherInput = z.infer<typeof teacherSchema>;

export async function createTeacher(data: TeacherInput) {
  await requirePermission("teachers.write");
  const parsed = teacherSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!user) return { error: "Usuário não encontrado." };

  try {
    await prisma.teacher.create({
      data: {
        userId: user.id,
        isActive: parsed.data.isActive ?? true,
      },
    });
    revalidatePath("/teachers");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Usuário já cadastrado para outro professor.",
        P2003: "Usuário inválido.",
      }),
    };
  }
}

export async function updateTeacher(id: number, data: TeacherInput) {
  await requirePermission("teachers.write");
  const parsed = teacherSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const existing = await prisma.teacher.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!existing) return { error: "Professor não encontrado." };

  try {
    await prisma.teacher.update({
      where: { id },
      data: {
        // Não permitir trocar o usuário após criação
        userId: existing.userId,
        isActive: parsed.data.isActive ?? true,
      },
    });
    revalidatePath("/teachers");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Usuário já cadastrado para outro professor.",
        P2003: "Usuário inválido.",
      }),
    };
  }
}

export async function deleteTeacher(id: number) {
  await requirePermission("teachers.write");
  try {
    await prisma.teacher.delete({ where: { id } });
    revalidatePath("/teachers");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: professor vinculado a componentes, frequências ou avaliações.",
      }),
    };
  }
}
