import crypto from "crypto";
import type { AccessResult, Device, MonitoringSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MONITORING_PERMISSIONS = {
  VIEW: "MONITORING_VIEW",
  MANAGE: "MONITORING_MANAGE",
  ADMIN_SETTINGS: "ADMIN_MONITORING_SETTINGS",
  HARDWARE_SIMULATOR: "ADMIN_HARDWARE_SIMULATOR",
} as const;

export type AccessReason =
  | "OK"
  | "STUDENT_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "DEVICE_INACTIVE"
  | "INVALID_DEVICE";

export type ReadingStatus = "OK" | "ATENCAO" | "CRITICO";

const DEFAULT_MONITORING_SETTINGS = {
  tempMin: "20.00",
  tempMax: "28.00",
  humMin: "40.00",
  humMax: "70.00",
  telemetryIntervalSeconds: 60,
  unlockDurationSeconds: 5,
  allowOnlyActiveStudents: true,
} as const;

function toNumber(value: unknown) {
  return Number(value);
}

export function toIsoDateOrNow(input?: string | null) {
  if (!input) return new Date();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return date;
}

export async function ensureMonitoringSettings() {
  const existing = await prisma.monitoringSettings.findFirst({
    orderBy: { id: "asc" },
  });
  if (existing) return existing;
  return prisma.monitoringSettings.create({ data: DEFAULT_MONITORING_SETTINGS });
}

export function evaluateReadingStatus(
  temperature: number,
  humidity: number,
  settings: Pick<MonitoringSettings, "tempMin" | "tempMax" | "humMin" | "humMax">
): ReadingStatus {
  const tempMin = toNumber(settings.tempMin);
  const tempMax = toNumber(settings.tempMax);
  const humMin = toNumber(settings.humMin);
  const humMax = toNumber(settings.humMax);

  const isCritical =
    temperature < tempMin - 2 ||
    temperature > tempMax + 2 ||
    humidity < humMin - 2 ||
    humidity > humMax + 2;

  if (isCritical) return "CRITICO";

  const isWarning =
    temperature < tempMin ||
    temperature > tempMax ||
    humidity < humMin ||
    humidity > humMax;

  return isWarning ? "ATENCAO" : "OK";
}

export function generateDeviceToken() {
  return `dev-${crypto.randomBytes(24).toString("hex")}`;
}

export function extractBearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function findActiveDeviceByToken(token: string) {
  const device = await prisma.device.findUnique({ where: { token } });
  if (!device) return { status: "NOT_FOUND" as const, device: null };
  if (!device.isActive) return { status: "INACTIVE" as const, device };
  return { status: "OK" as const, device };
}

type ProcessAccessInput = {
  device: Device;
  studentId: number;
  occurredAt: Date;
};

export async function processAccessEvent(input: ProcessAccessInput) {
  const settings = await ensureMonitoringSettings();

  let result: AccessResult = "DENY";
  let reason: AccessReason = "INVALID_DEVICE";

  if (!input.device.isActive) {
    reason = "DEVICE_INACTIVE";
  } else if (input.device.type !== "PORTARIA") {
    reason = "INVALID_DEVICE";
  } else {
    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, isActive: true },
    });

    if (!student) {
      reason = "STUDENT_NOT_FOUND";
    } else if (settings.allowOnlyActiveStudents && !student.isActive) {
      reason = "STUDENT_INACTIVE";
    } else {
      result = "ALLOW";
      reason = "OK";
    }
  }

  await prisma.accessEvent.create({
    data: {
      deviceId: input.device.id,
      studentId: input.studentId,
      result,
      reason,
      occurredAt: input.occurredAt,
    },
  });

  return {
    result,
    reason,
    unlockDurationSeconds: settings.unlockDurationSeconds,
  };
}

type ProcessTelemetryInput = {
  device: Device;
  roomId: number;
  temperature: number;
  humidity: number;
  measuredAt: Date;
};

export async function processTelemetryReading(input: ProcessTelemetryInput) {
  if (!input.device.isActive) {
    return { ok: false as const, reason: "DEVICE_INACTIVE" as const };
  }

  if (input.device.type !== "SALA") {
    return { ok: false as const, reason: "INVALID_DEVICE" as const };
  }

  const room = await prisma.room.findUnique({ where: { id: input.roomId }, select: { id: true } });
  if (!room) {
    return { ok: false as const, reason: "ROOM_NOT_FOUND" as const };
  }

  if (input.device.roomId && input.device.roomId !== input.roomId) {
    return { ok: false as const, reason: "ROOM_MISMATCH" as const };
  }

  if (!input.device.roomId) {
    await prisma.device.update({
      where: { id: input.device.id },
      data: { roomId: input.roomId },
    });
  }

  await prisma.telemetryReading.create({
    data: {
      deviceId: input.device.id,
      roomId: input.roomId,
      temperature: input.temperature,
      humidity: input.humidity,
      measuredAt: input.measuredAt,
    },
  });

  return { ok: true as const };
}
