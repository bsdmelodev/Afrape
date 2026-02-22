import { z } from "zod";
import { resolveDatabaseUrl } from "./database-url";

const envSchema = z.object({
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET é obrigatório"),
  DIRECT_URL: z.string().optional(),
  POSTGRES_DB: z.string().min(1, "POSTGRES_DB é obrigatório"),
  POSTGRES_USER: z.string().min(1, "POSTGRES_USER é obrigatório"),
  POSTGRES_PASSWORD: z.string().min(1, "POSTGRES_PASSWORD é obrigatório"),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.string().optional(),
  POSTGRES_SSLMODE: z.string().optional(),
});

const parsed = envSchema.safeParse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  DIRECT_URL: process.env.DIRECT_URL,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
  POSTGRES_SSLMODE: process.env.POSTGRES_SSLMODE,
});

if (!parsed.success) {
  throw new Error("Variáveis de ambiente inválidas: " + parsed.error.message);
}

const dbConnectionUrl = resolveDatabaseUrl(parsed.data);

export const env = {
  ...parsed.data,
  dbConnectionUrl,
  DIRECT_URL: parsed.data.DIRECT_URL || undefined,
};
