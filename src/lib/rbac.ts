import { redirect } from "next/navigation";
import { CurrentUser, getCurrentUser } from "./current-user";

export function hasPermission(user: CurrentUser, code: string) {
  return user.permissions.includes(code);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requirePermission(code: string) {
  const user = await requireUser();
  if (!hasPermission(user, code)) {
    throw new Error("Você não tem permissão para executar esta ação.");
  }
  return user;
}

export async function requireAnyPermission(codes: string[]) {
  const user = await requireUser();
  if (!codes.some((code) => hasPermission(user, code))) {
    throw new Error("Você não tem permissão para executar esta ação.");
  }
  return user;
}
