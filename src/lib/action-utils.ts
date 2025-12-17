import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export function parsePrismaError(
  error: unknown,
  messages: { P2002?: string; P2003?: string; default?: string } = {}
) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return messages.P2002 ?? "Registro duplicado.";
    }
    if (error.code === "P2003") {
      return messages.P2003 ?? "Não é possível remover pois há vínculos.";
    }
  }
  console.error(error);
  return messages.default ?? "Erro inesperado. Tente novamente.";
}

export function parseZodError(error: unknown, fallback = "Dados inválidos") {
  if (error instanceof ZodError) {
    const messages = error.issues?.map((e) => e.message).filter(Boolean) ?? [];
    if (messages.length > 0) return messages.join("; ");
  }
  // Caso venha um objeto semelhante a ZodError
  const maybeIssues = (error as { issues?: { message?: string }[]; errors?: { message?: string }[] })?.issues;
  const maybeErrors = (error as { errors?: { message?: string }[] })?.errors;
  const messages =
    maybeIssues?.map((e) => e.message).filter(Boolean) ??
    maybeErrors?.map((e) => e.message).filter(Boolean) ??
    [];
  if (messages.length > 0 && messages[0]) return messages.join("; ");
  console.error(error);
  return fallback;
}
