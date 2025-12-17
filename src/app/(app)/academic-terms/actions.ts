"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const termSchema = z.object({
  schoolYear: z.number().int().positive("Ano letivo obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  termOrder: z.number().int().positive("Ordem obrigatória"),
  startsAt: z.string().min(1, "Início obrigatório"),
  endsAt: z.string().min(1, "Fim obrigatório"),
});

export type TermInput = z.infer<typeof termSchema>;

function normalize(input: TermInput) {
  return {
    schoolYear: input.schoolYear,
    name: input.name.trim(),
    termOrder: input.termOrder,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
  };
}

export async function createTerm(data: TermInput) {
  await requirePermission("academic_terms.write");
  const parsed = termSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.academicTerm.create({ data: normalize(parsed.data) });
    revalidatePath("/academic-terms");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe um período com esse ano e ordem.",
      }),
    };
  }
}

export async function updateTerm(id: number, data: TermInput) {
  await requirePermission("academic_terms.write");
  const parsed = termSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.academicTerm.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/academic-terms");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe um período com esse ano e ordem.",
      }),
    };
  }
}

export async function deleteTerm(id: number) {
  await requirePermission("academic_terms.write");
  try {
    await prisma.academicTerm.delete({ where: { id } });
    revalidatePath("/academic-terms");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: período utilizado em outros registros.",
      }),
    };
  }
}
