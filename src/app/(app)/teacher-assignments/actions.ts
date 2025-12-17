"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const assignmentSchema = z.object({
  classSubjectId: z.number().int().positive("Selecione o componente"),
  teacherId: z.number().int().positive("Selecione o professor"),
  role: z.coerce.number().int().min(1).max(3).default(1),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;

function normalize(input: AssignmentInput) {
  return {
    classSubjectId: input.classSubjectId,
    teacherId: input.teacherId,
    role: input.role ?? 1,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  };
}

export async function createAssignment(data: AssignmentInput) {
  await requirePermission("teacher_assignments.write");
  const parsed = assignmentSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.teacherAssignment.create({ data: normalize(parsed.data) });
    revalidatePath("/teacher-assignments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Este professor já está vinculado a este componente.",
        P2003: "Professor ou componente inválido.",
      }),
    };
  }
}

export async function updateAssignment(id: number, data: AssignmentInput) {
  await requirePermission("teacher_assignments.write");
  const parsed = assignmentSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.teacherAssignment.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/teacher-assignments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Este professor já está vinculado a este componente.",
        P2003: "Professor ou componente inválido.",
      }),
    };
  }
}

export async function deleteAssignment(id: number) {
  await requirePermission("teacher_assignments.write");
  try {
    await prisma.teacherAssignment.delete({ where: { id } });
    revalidatePath("/teacher-assignments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: vínculo utilizado em frequência, avaliações ou fechamento.",
      }),
    };
  }
}
