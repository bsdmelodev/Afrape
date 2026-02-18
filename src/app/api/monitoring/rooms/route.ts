import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring";

const bodySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  location: z.string().optional(),
  is_active: z.boolean().optional(),
});

function parseBoundedInt(
  value: string | null,
  {
    fallback,
    min,
    max,
  }: {
    fallback: number;
    min: number;
    max: number;
  }
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export async function GET(request: Request) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.VIEW);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const page = parseBoundedInt(searchParams.get("page"), { fallback: 1, min: 1, max: 1_000_000 });
  const perPage = parseBoundedInt(searchParams.get("per_page"), { fallback: 20, min: 1, max: 100 });
  const q = searchParams.get("q")?.trim() ?? "";

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { location: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.room.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        _count: {
          select: {
            devices: true,
            telemetryReadings: true,
          },
        },
      },
    }),
    prisma.room.count({ where }),
  ]);

  return NextResponse.json({
    items: rows,
    total,
    page,
    per_page: perPage,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.MANAGE);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const room = await prisma.room.create({
    data: {
      name: parsed.data.name.trim(),
      location: parsed.data.location?.trim() || null,
      isActive: parsed.data.is_active ?? true,
    },
  });

  return NextResponse.json(room, { status: 201 });
}
