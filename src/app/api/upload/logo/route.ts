import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo maior que 5MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), buffer);

  const currentUrl = formData.get("currentUrl");
  if (typeof currentUrl === "string" && currentUrl.startsWith("/uploads/")) {
    const safeRelative = currentUrl.replace("/uploads/", "");
    const toDelete = path.join(uploadDir, safeRelative);
    if (toDelete.startsWith(uploadDir)) {
      try {
        await fs.unlink(toDelete);
      } catch (err: any) {
        if (err?.code !== "ENOENT") {
          console.warn("Não foi possível remover logo antigo:", err);
        }
      }
    }
  }

  return NextResponse.json({ url: `/uploads/${fileName}` });
}
