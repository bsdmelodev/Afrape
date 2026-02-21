"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";
import { hashPassword } from "@/lib/auth";
import { requireUser } from "@/lib/rbac";

const avatarUrlSchema = z
  .union([
    z.string().url(),
    z.string().regex(/^\/uploads\/[a-zA-Z0-9._/-]+$/, "URL do avatar inválida"),
    z.literal(""),
  ])
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const profileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  cpf: z
    .string()
    .optional()
    .transform((v) => v?.replace(/\D/g, "") || "")
    .refine((v) => v.length === 0 || v.length === 11, "CPF deve ter 11 dígitos"),
  password: z
    .string()
    .min(6, "Senha mínima de 6 caracteres")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  avatarUrl: avatarUrlSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateProfile(data: ProfileInput) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const { password, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = {
    name: rest.name,
    email: rest.email,
    avatarUrl: rest.avatarUrl,
    cpf: rest.cpf || null,
  };

  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2002: "E-mail ou CPF já cadastrado.",
      }),
    };
  }
}
