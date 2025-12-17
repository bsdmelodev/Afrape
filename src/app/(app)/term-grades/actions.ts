"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";
import { getCurrentUser } from "@/lib/current-user";

const termGradeSchema = z.object({
  enrollmentId: z.number().int().positive("Selecione a matrícula"),
  classSubjectId: z.number().int().positive("Selecione o componente"),
  termId: z.number().int().positive("Selecione o período"),
  grade: z.number().optional(),
  absencesCount: z.number().int().min(0).optional(),
  attendancePercentage: z.number().min(0).max(100).optional(),
  isClosed: z.boolean().optional(),
});

export type TermGradeInput = z.infer<typeof termGradeSchema>;

function normalize(input: TermGradeInput, closedByUserId: number | null) {
  return {
    enrollmentId: input.enrollmentId,
    classSubjectId: input.classSubjectId,
    termId: input.termId,
    grade: input.grade ?? null,
    absencesCount: input.absencesCount ?? 0,
    attendancePercentage: input.attendancePercentage ?? null,
    isClosed: input.isClosed ?? false,
    closedAt: input.isClosed ? new Date() : null,
    closedByUserId: input.isClosed ? closedByUserId : null,
  };
}

export async function createTermGrade(data: TermGradeInput) {
  await requirePermission("term_grades.write");
  const parsed = termGradeSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const user = await getCurrentUser();
  const normalized = normalize(parsed.data, user?.id ?? null);

  try {
    await prisma.termGrade.create({ data: normalized });
    revalidatePath("/term-grades");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe fechamento para esta matrícula/componente/período.",
        P2003: "Referência inválida.",
      }),
    };
  }
}

export async function updateTermGrade(id: number, data: TermGradeInput) {
  await requirePermission("term_grades.write");
  const parsed = termGradeSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const user = await getCurrentUser();
  const normalized = normalize(parsed.data, user?.id ?? null);

  try {
    await prisma.termGrade.update({ where: { id }, data: normalized });
    revalidatePath("/term-grades");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe fechamento para esta matrícula/componente/período.",
        P2003: "Referência inválida.",
      }),
    };
  }
}

export async function deleteTermGrade(id: number) {
  await requirePermission("term_grades.write");
  try {
    await prisma.termGrade.delete({ where: { id } });
    revalidatePath("/term-grades");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: registro vinculado a notas.",
      }),
    };
  }
}

export async function recalcTermGrade(id: number) {
  await requirePermission("term_grades.write");
  const termGrade = await prisma.termGrade.findUnique({
    where: { id },
    include: {
      enrollment: true,
      classSubject: true,
      term: true,
    },
  });

  if (!termGrade) return { error: "Fechamento não encontrado." };

  const scores = await prisma.assessmentScore.findMany({
    where: {
      enrollmentId: termGrade.enrollmentId,
      assessment: {
        classSubjectId: termGrade.classSubjectId,
        termId: termGrade.termId,
      },
    },
    include: {
      assessment: {
        select: {
          weight: true,
        },
      },
    },
  });

  const withScores = scores.filter((s) => s.score !== null);
  if (withScores.length === 0) {
    return { error: "Nenhuma nota lançada para este período/componente." };
  }

  const totalWeight = withScores.reduce((sum, s) => sum + Number(s.assessment.weight), 0);
  if (totalWeight === 0) {
    return { error: "Pesos inválidos para cálculo." };
  }

  const weighted = withScores.reduce(
    (sum, s) => sum + Number(s.score || 0) * Number(s.assessment.weight),
    0
  );
  const average = weighted / totalWeight;

  await prisma.termGrade.update({
    where: { id },
    data: { grade: Number(average.toFixed(2)) },
  });
  revalidatePath("/term-grades");
  return { success: true };
}
