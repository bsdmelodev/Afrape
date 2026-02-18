import crypto from "crypto";
import type { AccessResult, Device, MonitoringSettings } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const MONITORING_PERMISSIONS = {
  VIEW: "MONITORING_VIEW",
  MANAGE: "MONITORING_MANAGE",
  ADMIN_SETTINGS: "ADMIN_MONITORING_SETTINGS",
  HARDWARE_SIMULATOR: "ADMIN_HARDWARE_SIMULATOR",
} as const;

export const SENSOR_MODELS = ["SHT31", "SHT35"] as const;
export const RFID_READER_MODELS = ["PN532"] as const;

export type SupportedSensorModel = (typeof SENSOR_MODELS)[number];
export type SupportedRfidReaderModel = (typeof RFID_READER_MODELS)[number];

export type MonitoringHardwareProfile = {
  transport: "HTTP_REST";
  esp32: {
    connectivity: "WIFI";
  };
  telemetry: {
    sensorModel: SupportedSensorModel;
    supportedSensorModels: SupportedSensorModel[];
    i2cAddress: string;
    endpoint: string;
  };
  access: {
    readerModel: SupportedRfidReaderModel;
    frequencyMHz: number;
    endpoint: string;
  };
};

export type AccessReason =
  | "OK"
  | "STUDENT_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "DEVICE_INACTIVE"
  | "INVALID_DEVICE";

export type ReadingStatus = "OK" | "ATENCAO" | "CRITICO";

const hardwareProfileSchema = z.object({
  transport: z.literal("HTTP_REST").default("HTTP_REST"),
  esp32: z
    .object({
      connectivity: z.literal("WIFI").default("WIFI"),
    })
    .default({ connectivity: "WIFI" }),
  telemetry: z
    .object({
      sensorModel: z.enum(SENSOR_MODELS).default("SHT31"),
      supportedSensorModels: z.array(z.enum(SENSOR_MODELS)).default(["SHT31", "SHT35"]),
      i2cAddress: z.string().min(1).default("0x44"),
      endpoint: z.string().min(1).default("/api/iot/telemetry"),
    })
    .default({
      sensorModel: "SHT31",
      supportedSensorModels: ["SHT31", "SHT35"],
      i2cAddress: "0x44",
      endpoint: "/api/iot/telemetry",
    }),
  access: z
    .object({
      readerModel: z.enum(RFID_READER_MODELS).default("PN532"),
      frequencyMHz: z.number().positive().default(13.56),
      endpoint: z.string().min(1).default("/api/iot/access"),
    })
    .default({
      readerModel: "PN532",
      frequencyMHz: 13.56,
      endpoint: "/api/iot/access",
    }),
});

const DEFAULT_HARDWARE_PROFILE: MonitoringHardwareProfile = {
  transport: "HTTP_REST",
  esp32: {
    connectivity: "WIFI",
  },
  telemetry: {
    sensorModel: "SHT31",
    supportedSensorModels: ["SHT31", "SHT35"],
    i2cAddress: "0x44",
    endpoint: "/api/iot/telemetry",
  },
  access: {
    readerModel: "PN532",
    frequencyMHz: 13.56,
    endpoint: "/api/iot/access",
  },
};

const DEFAULT_MONITORING_SETTINGS = {
  tempMin: "20.00",
  tempMax: "28.00",
  humMin: "40.00",
  humMax: "70.00",
  telemetryIntervalSeconds: 60,
  unlockDurationSeconds: 5,
  allowOnlyActiveStudents: true,
  hardwareProfile: DEFAULT_HARDWARE_PROFILE,
} as const;

function toNumber(value: unknown) {
  return Number(value);
}

function normalizeEndpoint(path: string | undefined, fallback: string) {
  const value = path?.trim();
  if (!value) return fallback;
  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeI2cAddress(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) return "0x44";
  if (!/^0x[0-9a-fA-F]{2}$/.test(value)) return "0x44";
  return `0x${value.slice(2).toUpperCase()}`;
}

export function resolveMonitoringHardwareProfile(raw: unknown): MonitoringHardwareProfile {
  const parsed = hardwareProfileSchema.safeParse(raw);
  const base = parsed.success ? parsed.data : DEFAULT_HARDWARE_PROFILE;

  const sensorModel = base.telemetry.sensorModel;
  const supportedSensorModels = Array.from(
    new Set([sensorModel, ...base.telemetry.supportedSensorModels])
  );

  return {
    transport: "HTTP_REST",
    esp32: {
      connectivity: "WIFI",
    },
    telemetry: {
      sensorModel,
      supportedSensorModels,
      i2cAddress: normalizeI2cAddress(base.telemetry.i2cAddress),
      endpoint: normalizeEndpoint(base.telemetry.endpoint, "/api/iot/telemetry"),
    },
    access: {
      readerModel: "PN532",
      frequencyMHz:
        Number.isFinite(base.access.frequencyMHz) && base.access.frequencyMHz > 0
          ? Number(base.access.frequencyMHz)
          : 13.56,
      endpoint: normalizeEndpoint(base.access.endpoint, "/api/iot/access"),
    },
  };
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
  if (existing) {
    const normalizedHardwareProfile = resolveMonitoringHardwareProfile(existing.hardwareProfile);
    const normalizedJson = JSON.stringify(normalizedHardwareProfile);
    const currentJson = JSON.stringify(existing.hardwareProfile ?? null);

    if (currentJson !== normalizedJson) {
      return prisma.monitoringSettings.update({
        where: { id: existing.id },
        data: { hardwareProfile: normalizedHardwareProfile },
      });
    }

    return existing;
  }
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
  metadata?: {
    cardUid?: string;
    readerModel?: SupportedRfidReaderModel;
    frequencyMHz?: number;
    transport?: "HTTP_REST";
    connectivity?: "WIFI";
  };
};

export async function processAccessEvent(input: ProcessAccessInput) {
  const settings = await ensureMonitoringSettings();
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);

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
      metadata: {
        transport: input.metadata?.transport ?? hardwareProfile.transport,
        connectivity: input.metadata?.connectivity ?? hardwareProfile.esp32.connectivity,
        readerModel: input.metadata?.readerModel ?? hardwareProfile.access.readerModel,
        frequencyMHz: input.metadata?.frequencyMHz ?? hardwareProfile.access.frequencyMHz,
        cardUid: input.metadata?.cardUid ?? null,
      },
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
  metadata?: {
    sensorModel?: SupportedSensorModel;
    i2cAddress?: string;
    transport?: "HTTP_REST";
    connectivity?: "WIFI";
  };
};

export async function processTelemetryReading(input: ProcessTelemetryInput) {
  const settings = await ensureMonitoringSettings();
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);

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
      metadata: {
        transport: input.metadata?.transport ?? hardwareProfile.transport,
        connectivity: input.metadata?.connectivity ?? hardwareProfile.esp32.connectivity,
        sensorModel: input.metadata?.sensorModel ?? hardwareProfile.telemetry.sensorModel,
        i2cAddress: input.metadata?.i2cAddress
          ? normalizeI2cAddress(input.metadata.i2cAddress)
          : hardwareProfile.telemetry.i2cAddress,
      },
      measuredAt: input.measuredAt,
    },
  });

  return { ok: true as const };
}
