import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import {
  ensureMonitoringSettings,
  evaluateReadingStatus,
  MONITORING_PERMISSIONS,
} from "@/lib/monitoring";

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseInterval(interval: string | null) {
  const now = new Date();
  if (interval === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
  const perPage = parseBoundedInt(searchParams.get("per_page"), { fallback: 30, min: 1, max: 200 });
  const roomId = parseBoundedInt(searchParams.get("room_id"), { fallback: 0, min: 0, max: 1_000_000_000 });
  const deviceId = parseBoundedInt(searchParams.get("device_id"), { fallback: 0, min: 0, max: 1_000_000_000 });
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const intervalFrom = parseInterval(searchParams.get("interval"));

  const where = {
    ...(roomId > 0 ? { roomId } : {}),
    ...(deviceId > 0 ? { deviceId } : {}),
    measuredAt: {
      gte: from ?? intervalFrom,
      ...(to ? { lte: to } : {}),
    },
  };

  const [settings, readings, total] = await Promise.all([
    ensureMonitoringSettings(),
    prisma.telemetryReading.findMany({
      where,
      include: {
        room: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
      },
      orderBy: { measuredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.telemetryReading.count({ where }),
  ]);

  const items = readings.map((reading) => {
    const temperature = Number(reading.temperature);
    const humidity = Number(reading.humidity);
    const sensorModel = metadataValue(reading.metadata, "sensorModel");
    const i2cAddress = metadataValue(reading.metadata, "i2cAddress");
    return {
      id: reading.id,
      room: reading.room,
      device: reading.device,
      temperature,
      humidity,
      sensor_model: sensorModel ?? null,
      i2c_address: i2cAddress ?? null,
      metadata: reading.metadata ?? null,
      measured_at: reading.measuredAt,
      created_at: reading.createdAt,
      status: evaluateReadingStatus(temperature, humidity, settings),
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    per_page: perPage,
  });
}
