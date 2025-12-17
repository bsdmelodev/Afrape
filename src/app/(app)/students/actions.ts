"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const studentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  birthDate: z.string().optional(),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  guardians: z
    .array(
      z.object({
        guardianId: z.number(),
        relationship: z.string().min(1, "Informe o vínculo"),
        isPrimary: z.boolean().optional().default(false),
        isFinancial: z.boolean().optional().default(false),
        livesWithStudent: z.boolean().optional().default(false),
        guardianName: z.string().optional(),
      })
    )
    .min(1, "Adicione ao menos um responsável"),
});

export type StudentInput = z.infer<typeof studentSchema>;

function normalize(input: StudentInput) {
  const guardians = input.guardians.map((g) => ({
    guardianId: Number(g.guardianId),
    relationship: g.relationship.trim(),
    isPrimary: g.isPrimary ?? false,
    isFinancial: g.isFinancial ?? false,
    livesWithStudent: g.livesWithStudent ?? false,
  }));

  const studentData = {
    name: input.name,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    cpf: input.cpf.replace(/\D/g, ""),
    email: input.email?.trim() || undefined,
    phone: input.phone?.replace(/\D/g, "") || undefined,
    isActive: input.isActive ?? true,
  };

  return { studentData, guardians };
}

export async function createStudent(data: StudentInput) {
  await requirePermission("students.write");
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const { studentData, guardians } = normalize(parsed.data);
      const student = await tx.student.create({ data: studentData });
      await tx.studentGuardian.createMany({
        data: guardians.map((g) => ({
          studentId: student.id,
          guardianId: g.guardianId,
          relationship: g.relationship,
          isPrimary: g.isPrimary,
          isFinancial: g.isFinancial,
          livesWithStudent: g.livesWithStudent,
        })),
      });
    });
    revalidatePath("/students");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "CPF ou matrícula já cadastrados.",
      }),
    };
  }
}

export async function updateStudent(id: number, data: StudentInput) {
  await requirePermission("students.write");
  const parsed = studentSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const { studentData, guardians } = normalize(parsed.data);
      await tx.student.update({ where: { id }, data: studentData });
      await tx.studentGuardian.deleteMany({ where: { studentId: id } });
      await tx.studentGuardian.createMany({
        data: guardians.map((g) => ({
          studentId: id,
          guardianId: g.guardianId,
          relationship: g.relationship,
          isPrimary: g.isPrimary,
          isFinancial: g.isFinancial,
          livesWithStudent: g.livesWithStudent,
        })),
      });
    });
    revalidatePath("/students");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "CPF ou matrícula já cadastrados.",
      }),
    };
  }
}

export async function deleteStudent(id: number) {
  await requirePermission("students.write");
  try {
    await prisma.student.delete({ where: { id } });
    revalidatePath("/students");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: o aluno possui matrículas, frequência ou notas vinculadas.",
      }),
    };
  }
}
