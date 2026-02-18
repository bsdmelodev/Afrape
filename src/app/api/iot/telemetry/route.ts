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
  sensor_model: z.enum(["SHT31", "SHT35"]).optional(),
  i2c_address: z
    .string()
    .trim()
    .regex(/^0[xX][0-9A-Fa-f]{2}$/, "i2c_address inválido")
    .optional(),
  transport: z.literal("HTTP_REST").optional(),
  connectivity: z.literal("WIFI").optional(),
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
    metadata: {
      sensorModel: parsed.data.sensor_model,
      i2cAddress: parsed.data.i2c_address,
      transport: parsed.data.transport,
      connectivity: parsed.data.connectivity,
    },
  });

  if (!result.ok) {
    if (result.reason === "DEVICE_INACTIVE" || result.reason === "INVALID_DEVICE") {
      return NextResponse.json({ error: result.reason }, { status: 403 });
    }

    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ status: "OK" });
}
