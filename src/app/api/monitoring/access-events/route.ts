import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring";

const resultSchema = z.enum(["ALLOW", "DENY"]);

function parseDate(value: string | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

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
  const studentId = parseBoundedInt(searchParams.get("student_id"), { fallback: 0, min: 0, max: 1_000_000_000 });
  const deviceId = parseBoundedInt(searchParams.get("device_id"), { fallback: 0, min: 0, max: 1_000_000_000 });
  const resultParam = searchParams.get("result");
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));

  const parsedResult = resultParam ? resultSchema.safeParse(resultParam) : null;
  if (resultParam && !parsedResult?.success) {
    return NextResponse.json({ error: "Filtro result inválido." }, { status: 400 });
  }

  const where = {
    ...(studentId > 0 ? { studentId } : {}),
    ...(deviceId > 0 ? { deviceId } : {}),
    ...(parsedResult?.success ? { result: parsedResult.data } : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    prisma.accessEvent.findMany({
      where,
      include: {
        device: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.accessEvent.count({ where }),
  ]);

  return NextResponse.json({
    items: events,
    total,
    page,
    per_page: perPage,
  });
}
