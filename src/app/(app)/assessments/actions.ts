"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const assessmentSchema = z.object({
  classSubjectId: z.number().int().positive("Selecione o componente"),
  termId: z.number().int().positive("Selecione o período"),
  title: z.string().min(1, "Título é obrigatório"),
  assessmentType: z.enum(["exam", "quiz", "homework", "project", "other"]),
  assessmentDate: z.string().min(1, "Data é obrigatória"),
  weight: z.number().positive("Peso deve ser positivo"),
  maxScore: z.number().positive("Nota máxima deve ser positiva"),
  isPublished: z.boolean().optional(),
  createdByTeacherId: z.number().int().positive("Selecione o professor"),
});

export type AssessmentInput = z.infer<typeof assessmentSchema>;

function normalize(input: AssessmentInput) {
  return {
    classSubjectId: input.classSubjectId,
    termId: input.termId,
    title: input.title.trim(),
    assessmentType: input.assessmentType,
    assessmentDate: new Date(input.assessmentDate),
    weight: input.weight,
    maxScore: input.maxScore,
    isPublished: input.isPublished ?? false,
    createdByTeacherId: input.createdByTeacherId,
  };
}

export async function createAssessment(data: AssessmentInput) {
  await requirePermission("assessments.write");
  const parsed = assessmentSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.assessment.create({ data: normalize(parsed.data) });
    revalidatePath("/assessments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Referência inválida.",
      }),
    };
  }
}

export async function updateAssessment(id: number, data: AssessmentInput) {
  await requirePermission("assessments.write");
  const parsed = assessmentSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.assessment.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/assessments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Referência inválida.",
      }),
    };
  }
}

export async function deleteAssessment(id: number) {
  await requirePermission("assessments.write");
  try {
    await prisma.assessment.delete({ where: { id } });
    revalidatePath("/assessments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: avaliação vinculada a notas.",
      }),
    };
  }
}
