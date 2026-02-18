import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import { generateDeviceToken, MONITORING_PERMISSIONS } from "@/lib/monitoring";

const typeSchema = z.enum(["PORTARIA", "SALA"]);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: typeSchema.optional(),
  room_id: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
  regenerate_token: z.boolean().optional(),
});

async function getId(context: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await context.params;
  const id = Number((params as { id: string }).id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.VIEW);
  if ("error" in auth) return auth.error;

  const id = await getId(context);
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      room: { select: { id: true, name: true } },
    },
  });

  if (!device) return NextResponse.json({ error: "Dispositivo não encontrado." }, { status: 404 });

  return NextResponse.json(device);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.MANAGE);
  if ("error" in auth) return auth.error;

  const id = await getId(context);
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.device.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Dispositivo não encontrado." }, { status: 404 });

  const nextType = parsed.data.type ?? current.type;
  const roomId =
    nextType === "PORTARIA"
      ? null
      : parsed.data.room_id === undefined
        ? current.roomId
        : parsed.data.room_id;

  const baseData = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
    ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
    ...(parsed.data.is_active !== undefined ? { isActive: parsed.data.is_active } : {}),
    roomId,
  };
  let token = parsed.data.regenerate_token ? generateDeviceToken() : undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const updated = await prisma.device.update({
        where: { id },
        data: {
          ...baseData,
          ...(token ? { token } : {}),
        },
      });
      return NextResponse.json(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        parsed.data.regenerate_token &&
        attempt < 2
      ) {
        token = generateDeviceToken();
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        return NextResponse.json({ error: "room_id inválido." }, { status: 400 });
      }

      console.error(error);
      return NextResponse.json({ error: "Erro ao atualizar dispositivo." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Falha ao atualizar token." }, { status: 500 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.MANAGE);
  if ("error" in auth) return auth.error;

  const id = await getId(context);
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  try {
    await prisma.device.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Dispositivo não encontrado." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Não é possível excluir dispositivo com eventos/leitura vinculados." },
          { status: 409 }
        );
      }
    }
    console.error(error);
    return NextResponse.json({ error: "Erro ao excluir dispositivo." }, { status: 500 });
  }
}
