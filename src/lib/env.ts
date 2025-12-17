import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET é obrigatório"),
  DIRECT_URL: z.string().optional(),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  DIRECT_URL: process.env.DIRECT_URL,
});

if (!parsed.success) {
  throw new Error("Variáveis de ambiente inválidas: " + parsed.error.message);
}

export const env = {
  ...parsed.data,
  DIRECT_URL: parsed.data.DIRECT_URL || undefined,
};
