"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const scoreSchema = z.object({
  assessmentId: z.number().int().positive("Selecione a avaliação"),
  enrollmentId: z.number().int().positive("Selecione a matrícula"),
  score: z.number().min(0, "Nota deve ser positiva").optional(),
  isAbsent: z.boolean().optional().default(false),
  isExcused: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export type ScoreInput = z.infer<typeof scoreSchema>;

function normalize(input: ScoreInput) {
  return {
    assessmentId: input.assessmentId,
    enrollmentId: input.enrollmentId,
    score: input.score ?? null,
    isAbsent: input.isAbsent ?? false,
    isExcused: input.isExcused ?? false,
    notes: input.notes?.trim() || null,
  };
}

export async function createScore(data: ScoreInput) {
  await requirePermission("assessments.write");
  const parsed = scoreSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.assessmentScore.create({ data: normalize(parsed.data) });
    revalidatePath("/assessment-scores");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe lançamento para esta avaliação e matrícula.",
        P2003: "Avaliação ou matrícula inválida.",
      }),
    };
  }
}

export async function updateScore(
  assessmentId: number,
  enrollmentId: number,
  data: ScoreInput
) {
  await requirePermission("assessments.write");
  const parsed = scoreSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.assessmentScore.update({
      where: { assessmentId_enrollmentId: { assessmentId, enrollmentId } },
      data: normalize(parsed.data),
    });
    revalidatePath("/assessment-scores");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Avaliação ou matrícula inválida.",
      }),
    };
  }
}

export async function deleteScore(assessmentId: number, enrollmentId: number) {
  await requirePermission("assessments.write");
  try {
    await prisma.assessmentScore.delete({
      where: { assessmentId_enrollmentId: { assessmentId, enrollmentId } },
    });
    revalidatePath("/assessment-scores");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: lançamento utilizado em fechamento.",
      }),
    };
  }
}
