import { promises as fs } from "fs";
import path from "path";

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

type SupportedImage = {
  mime: string;
  extension: string;
};

const SUPPORTED_IMAGES: SupportedImage[] = [
  { mime: "image/jpeg", extension: "jpg" },
  { mime: "image/png", extension: "png" },
  { mime: "image/webp", extension: "webp" },
  { mime: "image/gif", extension: "gif" },
];

const ALLOWED_MIME_TYPES = new Set(SUPPORTED_IMAGES.map((item) => item.mime));

function hasPrefix(buffer: Buffer, signature: number[]) {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function detectImageBySignature(buffer: Buffer): SupportedImage | null {
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }

  if (hasPrefix(buffer, [0x47, 0x49, 0x46, 0x38])) {
    return { mime: "image/gif", extension: "gif" };
  }

  const isRiff = hasPrefix(buffer, [0x52, 0x49, 0x46, 0x46]); // RIFF
  const hasWebpHeader =
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50; // WEBP

  if (isRiff && hasWebpHeader) {
    return { mime: "image/webp", extension: "webp" };
  }

  return null;
}

export type UploadValidationResult = {
  buffer: Buffer;
  mime: string;
  extension: string;
};

export async function validateImageUpload(file: File): Promise<UploadValidationResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Tipo de arquivo não suportado");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Arquivo maior que 5MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageBySignature(buffer);
  if (!detected) {
    throw new Error("Arquivo inválido ou não suportado");
  }

  if (detected.mime !== file.type) {
    throw new Error("Tipo de arquivo divergente do conteúdo");
  }

  return {
    buffer,
    mime: detected.mime,
    extension: detected.extension,
  };
}

export async function ensureUploadDir() {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

function toSafeCurrentUploadPath(currentUrl: string, uploadDir: string) {
  if (!currentUrl.startsWith("/uploads/")) return null;

  const relative = currentUrl.slice("/uploads/".length);
  if (!relative) return null;
  if (!/^[a-zA-Z0-9._/-]+$/.test(relative)) return null;
  if (relative.includes("..")) return null;

  const root = path.resolve(uploadDir);
  const resolved = path.resolve(uploadDir, relative);
  if (resolved === root) return null;
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;

  return resolved;
}

export async function deletePreviousUpload(currentUrl: string | null, uploadDir: string) {
  if (!currentUrl) return;

  const toDelete = toSafeCurrentUploadPath(currentUrl, uploadDir);
  if (!toDelete) return;

  try {
    await fs.unlink(toDelete);
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    if (code !== "ENOENT") {
      console.warn("Não foi possível remover arquivo antigo:", error);
    }
  }
}
