"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";

const schoolSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  ie: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  website: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  logoUrl: z.string().optional().transform((v) => v?.trim() || undefined),
});

export type SchoolInput = z.infer<typeof schoolSchema>;

function normalize(input: SchoolInput) {
  return {
    name: input.name.trim(),
    cnpj: input.cnpj?.trim() || "",
    ie: input.ie?.trim() || "",
    address: input.address?.trim() || "",
    city: input.city?.trim() || "",
    state: input.state?.trim() || "",
    zip: input.zip?.trim() || "",
    phone: input.phone?.trim() || "",
    email: input.email?.trim() || "",
    website: input.website?.trim() || "",
    logoUrl: input.logoUrl?.trim() || "",
  };
}

export async function saveSchool(data: SchoolInput) {
  await requirePermission("school.write");
  const parsed = schoolSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    const payload = normalize(parsed.data);
    const existing = await prisma.school.findFirst();
    if (existing) {
      await prisma.school.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.school.create({ data: payload });
    }
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        default: "Erro ao salvar informações da escola.",
      }),
    };
  }
}
