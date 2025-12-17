"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const guardianSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 11, "CPF deve ter 11 dígitos"),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
});

export type GuardianInput = z.infer<typeof guardianSchema>;

function normalize(input: GuardianInput) {
  const phoneDigits = input.phone?.replace(/\D/g, "") || undefined;

  return {
    name: input.name.trim(),
    cpf: input.cpf,
    email: input.email?.trim() || undefined,
    phone: phoneDigits,
  };
}

export async function createGuardian(data: GuardianInput) {
  await requirePermission("guardians.write");
  const parsed = guardianSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.guardian.create({ data: normalize(parsed.data) });
    revalidatePath("/guardians");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, { P2002: "CPF já cadastrado." }),
    };
  }
}

export async function updateGuardian(id: number, data: GuardianInput) {
  await requirePermission("guardians.write");
  const parsed = guardianSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.guardian.update({ where: { id }, data: normalize(parsed.data) });
    revalidatePath("/guardians");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, { P2002: "CPF já cadastrado." }),
    };
  }
}

export async function deleteGuardian(id: number) {
  await requirePermission("guardians.write");
  try {
    await prisma.guardian.delete({ where: { id } });
    revalidatePath("/guardians");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: responsável vinculado a aluno(s).",
      }),
    };
  }
}
