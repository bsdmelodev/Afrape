import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractBearerToken,
  findActiveDeviceByToken,
  processAccessEvent,
  toIsoDateOrNow,
} from "@/lib/monitoring";

const bodySchema = z.object({
  student_id: z.coerce.number().int().positive("student_id inválido"),
  occurred_at: z.string().optional(),
});

export async function POST(request: Request) {
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

  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Token do dispositivo ausente." }, { status: 401 });
  }

  const deviceResult = await findActiveDeviceByToken(token);
  if (deviceResult.status === "NOT_FOUND" || !deviceResult.device) {
    return NextResponse.json({ error: "Token de dispositivo inválido." }, { status: 401 });
  }

  let occurredAt: Date;
  try {
    occurredAt = toIsoDateOrNow(parsed.data.occurred_at);
  } catch {
    return NextResponse.json({ error: "occurred_at inválido." }, { status: 400 });
  }

  const result = await processAccessEvent({
    device: deviceResult.device,
    studentId: parsed.data.student_id,
    occurredAt,
  });

  const statusCode =
    result.reason === "DEVICE_INACTIVE" || result.reason === "INVALID_DEVICE" ? 403 : 200;

  return NextResponse.json(
    {
      result: result.result,
      reason: result.reason,
      unlock_duration_seconds: result.unlockDurationSeconds,
    },
    { status: statusCode }
  );
}
