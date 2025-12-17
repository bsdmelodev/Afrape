"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const sessionSchema = z.object({
  classSubjectId: z.number().int().positive("Selecione o componente"),
  termId: z.number().int().positive("Selecione o período").optional(),
  sessionDate: z.string().min(1, "Data é obrigatória"),
  lessonNumber: z.number().int().positive().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  content: z.string().optional(),
  launchedByTeacherId: z.number().int().positive("Selecione o professor"),
});

export type SessionInput = z.infer<typeof sessionSchema>;

function normalize(input: SessionInput) {
  const baseDate = input.sessionDate;
  const parseTime = (value?: string | null) => {
    if (!value) return null;
    const candidate = `${baseDate}T${value}`;
    const dt = new Date(candidate);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  return {
    classSubjectId: input.classSubjectId,
    termId: input.termId ?? null,
    sessionDate: new Date(input.sessionDate),
    lessonNumber: input.lessonNumber ?? null,
    startsAt: parseTime(input.startsAt),
    endsAt: parseTime(input.endsAt),
    content: input.content?.trim() || null,
    launchedByTeacherId: input.launchedByTeacherId,
  };
}

export async function createSession(data: SessionInput) {
  await requirePermission("attendance.write");
  const parsed = sessionSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.attendanceSession.create({ data: normalize(parsed.data) });
    revalidatePath("/attendance");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe sessão com este componente/data/aula.",
        P2003: "Referência inválida.",
      }),
    };
  }
}

export async function updateSession(id: number, data: SessionInput) {
  await requirePermission("attendance.write");
  const parsed = sessionSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.attendanceSession.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/attendance");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "Já existe sessão com este componente/data/aula.",
        P2003: "Referência inválida.",
      }),
    };
  }
}

export async function deleteSession(id: number) {
  await requirePermission("attendance.write");
  try {
    await prisma.attendanceSession.delete({ where: { id } });
    revalidatePath("/attendance");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: sessão possui registros de frequência ou notas associadas.",
      }),
    };
  }
}
