"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const classSubjectSchema = z.object({
  classGroupId: z.number().int().positive("Selecione a turma"),
  subjectId: z.number().int().positive("Selecione a disciplina"),
  workloadMinutes: z
    .number()
    .int()
    .positive("Informe um número positivo")
    .optional(),
});

export type ClassSubjectInput = z.infer<typeof classSubjectSchema>;

function normalize(input: ClassSubjectInput) {
  return {
    classGroupId: input.classGroupId,
    subjectId: input.subjectId,
    workloadMinutes: input.workloadMinutes ?? null,
  };
}

export async function createClassSubject(data: ClassSubjectInput) {
  await requirePermission("class_subjects.write");
  const parsed = classSubjectSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.classSubject.create({ data: normalize(parsed.data) });
    revalidatePath("/class-subjects");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Esta disciplina já está vinculada a esta turma.",
        P2003: "Turma ou disciplina inválida.",
      }),
    };
  }
}

export async function updateClassSubject(id: number, data: ClassSubjectInput) {
  await requirePermission("class_subjects.write");
  const parsed = classSubjectSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.classSubject.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/class-subjects");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Esta disciplina já está vinculada a esta turma.",
        P2003: "Turma ou disciplina inválida.",
      }),
    };
  }
}

export async function deleteClassSubject(id: number) {
  await requirePermission("class_subjects.write");
  try {
    await prisma.classSubject.delete({ where: { id } });
    revalidatePath("/class-subjects");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: vínculo utilizado em professores, frequência ou avaliações.",
      }),
    };
  }
}
