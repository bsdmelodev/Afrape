"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const subjectSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
});

export type SubjectInput = z.infer<typeof subjectSchema>;

function normalize(input: SubjectInput) {
  return {
    name: input.name,
    code: input.code?.trim() || undefined,
  };
}

export async function createSubject(data: SubjectInput) {
  await requirePermission("subjects.write");
  const parsed = subjectSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.subject.create({ data: normalize(parsed.data) });
    revalidatePath("/subjects");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, { P2002: "Código já cadastrado." }),
    };
  }
}

export async function updateSubject(id: number, data: SubjectInput) {
  await requirePermission("subjects.write");
  const parsed = subjectSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.subject.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/subjects");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, { P2002: "Código já cadastrado." }),
    };
  }
}

export async function deleteSubject(id: number) {
  await requirePermission("subjects.write");
  try {
    await prisma.subject.delete({ where: { id } });
    revalidatePath("/subjects");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: disciplina vinculada.",
      }),
    };
  }
}
