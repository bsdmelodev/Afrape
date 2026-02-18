import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractBearerToken,
  findActiveDeviceByToken,
  processTelemetryReading,
  toIsoDateOrNow,
} from "@/lib/monitoring";

const bodySchema = z.object({
  room_id: z.coerce.number().int().positive("room_id inválido"),
  temperature: z.coerce.number(),
  humidity: z.coerce.number(),
  measured_at: z.string().optional(),
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

  let measuredAt: Date;
  try {
    measuredAt = toIsoDateOrNow(parsed.data.measured_at);
  } catch {
    return NextResponse.json({ error: "measured_at inválido." }, { status: 400 });
  }

  const result = await processTelemetryReading({
    device: deviceResult.device,
    roomId: parsed.data.room_id,
    temperature: parsed.data.temperature,
    humidity: parsed.data.humidity,
    measuredAt,
  });

  if (!result.ok) {
    if (result.reason === "DEVICE_INACTIVE" || result.reason === "INVALID_DEVICE") {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }

    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ status: "OK" });
}
