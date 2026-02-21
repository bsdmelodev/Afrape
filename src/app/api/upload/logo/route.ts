import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import crypto from "crypto";
import path from "path";
import { requireApiPermission } from "@/lib/api-rbac";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  deletePreviousUpload,
  ensureUploadDir,
  validateImageUpload,
} from "@/lib/upload";

export async function POST(request: Request) {
  const auth = await requireApiPermission("school.write");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(request.headers);
  const rateLimit = consumeRateLimit({
    key: `upload:logo:user:${auth.user.id}:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  let upload: Awaited<ReturnType<typeof validateImageUpload>>;
  try {
    upload = await validateImageUpload(file);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Arquivo inválido ou não suportado";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const fileName = `${crypto.randomUUID()}.${upload.extension}`;
  const uploadDir = await ensureUploadDir();

  await fs.writeFile(path.join(uploadDir, fileName), upload.buffer);

  const currentUrl = formData.get("currentUrl");
  if (typeof currentUrl === "string") {
    await deletePreviousUpload(currentUrl, uploadDir);
  }

  return NextResponse.json({ url: `/uploads/${fileName}` });
}
