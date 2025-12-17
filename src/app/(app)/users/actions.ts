"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";
import { hashPassword } from "@/lib/auth";

const baseSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  groupId: z.number().int().positive("Selecione o grupo"),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  phone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10 && v.length <= 11, "Telefone deve ter 10 ou 11 dígitos"),
  isActive: z.boolean().default(true),
  avatarUrl: z.string().optional().transform((v) => v?.trim() || undefined),
});

const createSchema = baseSchema.extend({
  password: z.string().min(6, "Senha mínima de 6 caracteres"),
});

const updateSchema = baseSchema.extend({
  password: z.string().min(6).optional(),
});

export type CreateUserInput = z.infer<typeof createSchema>;
export type UpdateUserInput = z.infer<typeof updateSchema>;

export async function createUser(data: CreateUserInput) {
  await requirePermission("users.write");
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    await prisma.user.create({
      data: {
        ...rest,
        cpf: rest.cpf,
        phone: rest.phone,
        passwordHash,
      },
    });
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "E-mail ou CPF já cadastrado.",
      }),
    };
  }
}

export async function updateUser(id: number, data: UpdateUserInput) {
  await requirePermission("users.write");
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parseZodError(parsed.error) };
  }

  const { password, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  updateData.cpf = rest.cpf;
  updateData.phone = rest.phone;
  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  try {
    await prisma.user.update({
      where: { id },
      data: updateData,
    });
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "E-mail ou CPF já cadastrado.",
      }),
    };
  }
}

export async function deleteUser(id: number) {
  await requirePermission("users.write");
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir: usuário vinculado a professor(es) ou fechamentos de período.",
      }),
    };
  }
}
