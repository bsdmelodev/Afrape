import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import { MONITORING_PERMISSIONS } from "@/lib/monitoring";

const bodySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").optional(),
  location: z.string().optional(),
  is_active: z.boolean().optional(),
});

async function getId(context: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await context.params;
  const id = Number((params as { id: string }).id);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
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

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          roomId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      },
      telemetryReadings: {
        orderBy: { measuredAt: "desc" },
        take: 50,
        include: {
          device: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!room) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });

  return NextResponse.json(room);
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const room = await prisma.room.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.location !== undefined
          ? { location: parsed.data.location.trim() || null }
          : {}),
        ...(parsed.data.is_active !== undefined ? { isActive: parsed.data.is_active } : {}),
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Erro ao atualizar sala." }, { status: 500 });
  }
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
    await prisma.room.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Não é possível excluir sala com leituras vinculadas." },
          { status: 409 }
        );
      }
    }
    console.error(error);
    return NextResponse.json({ error: "Erro ao excluir sala." }, { status: 500 });
  }
}
