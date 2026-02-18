import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import { generateDeviceToken, MONITORING_PERMISSIONS } from "@/lib/monitoring";

const deviceTypeSchema = z.enum(["PORTARIA", "SALA"]);

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: deviceTypeSchema,
  room_id: z.coerce.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.VIEW);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type");
  const type: "PORTARIA" | "SALA" | undefined =
    typeParam === "PORTARIA" || typeParam === "SALA" ? typeParam : undefined;
  const roomId = searchParams.get("room_id");
  const active = searchParams.get("active");

  const where: Prisma.DeviceWhereInput = {
    ...(type ? { type } : {}),
    ...(roomId && Number(roomId) > 0 ? { roomId: Number(roomId) } : {}),
    ...(active === "true" ? { isActive: true } : {}),
    ...(active === "false" ? { isActive: false } : {}),
  };

  const devices = await prisma.device.findMany({
    where,
    include: {
      room: { select: { id: true, name: true } },
      _count: {
        select: { accessEvents: true, telemetryReadings: true },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ items: devices });
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const roomId = payload.type === "SALA" ? payload.room_id ?? null : null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const device = await prisma.device.create({
        data: {
          name: payload.name.trim(),
          type: payload.type,
          roomId,
          isActive: payload.is_active ?? true,
          token: generateDeviceToken(),
        },
      });

      return NextResponse.json(device, { status: 201 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 2
      ) {
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        return NextResponse.json({ error: "room_id inválido." }, { status: 400 });
      }

      console.error(error);
      return NextResponse.json({ error: "Erro ao criar dispositivo." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Falha ao gerar token de dispositivo." }, { status: 500 });
}
