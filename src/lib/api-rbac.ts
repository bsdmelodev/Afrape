import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/rbac";

export async function requireApiPermission(code: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  if (!hasPermission(user, code)) {
    return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }

  return { user };
}

export async function requireApiAnyPermission(codes: string[]) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  if (!codes.some((code) => hasPermission(user, code))) {
    return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }

  return { user };
}
