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
  card_uid: z
    .string()
    .trim()
    .regex(/^[0-9A-Fa-f]{4,32}$/, "card_uid inválido")
    .optional(),
  reader_model: z.enum(["PN532"]).optional(),
  frequency_mhz: z.coerce.number().positive("frequency_mhz inválido").optional(),
  transport: z.literal("HTTP_REST").optional(),
  connectivity: z.literal("WIFI").optional(),
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
    metadata: {
      cardUid: parsed.data.card_uid,
      readerModel: parsed.data.reader_model,
      frequencyMHz: parsed.data.frequency_mhz,
      transport: parsed.data.transport,
      connectivity: parsed.data.connectivity,
    },
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
