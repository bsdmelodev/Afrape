"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const enrollmentSchema = z.object({
  studentId: z.number().int(),
  classGroupId: z.number().int(),
  status: z.enum(["active", "transferred", "cancelled", "completed"]),
  enrolledAt: z.string().optional(),
  leftAt: z.string().optional(),
});

export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

function normalize(input: EnrollmentInput) {
  return {
    studentId: input.studentId,
    classGroupId: input.classGroupId,
    status: input.status,
    enrolledAt: input.enrolledAt ? new Date(input.enrolledAt) : undefined,
    leftAt: input.leftAt ? new Date(input.leftAt) : null,
  };
}

export async function createEnrollment(data: EnrollmentInput) {
  await requirePermission("enrollments.write");
  const parsed = enrollmentSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.enrollment.create({ data: normalize(parsed.data) });
    revalidatePath("/enrollments");
    return { success: true };
  } catch (error) {
    return { error: parsePrismaError(error) };
  }
}

export async function updateEnrollment(id: number, data: EnrollmentInput) {
  await requirePermission("enrollments.write");
  const parsed = enrollmentSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.enrollment.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/enrollments");
    return { success: true };
  } catch (error) {
    return { error: parsePrismaError(error) };
  }
}

export async function deleteEnrollment(id: number) {
  await requirePermission("enrollments.write");
  try {
    await prisma.enrollment.delete({ where: { id } });
    revalidatePath("/enrollments");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: matrícula vinculada a frequência ou notas.",
      }),
    };
  }
}
