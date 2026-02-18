"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parsePrismaError, parseZodError } from "@/lib/action-utils";
import {
  ensureMonitoringSettings,
  generateDeviceToken,
  MONITORING_PERMISSIONS,
  RFID_READER_MODELS,
  resolveMonitoringHardwareProfile,
  SENSOR_MODELS,
  processAccessEvent,
  processTelemetryReading,
  toIsoDateOrNow,
} from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

const roomSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

const deviceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["PORTARIA", "SALA"]),
  roomId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

const hardwareProfileSchema = z.object({
  telemetry: z.object({
    sensorModel: z.enum(SENSOR_MODELS),
    i2cAddress: z.string().regex(/^0[xX][0-9A-Fa-f]{2}$/, "Endereço I²C inválido (use 0x44/0x45)."),
    endpoint: z.string().min(1, "Informe o endpoint REST de telemetria."),
  }),
  access: z.object({
    readerModel: z.enum(RFID_READER_MODELS),
    frequencyMHz: z.coerce.number().positive("Frequência RFID deve ser positiva."),
    endpoint: z.string().min(1, "Informe o endpoint REST de acesso."),
  }),
});

const monitoringSettingsSchema = z
  .object({
    tempMin: z.coerce.number(),
    tempMax: z.coerce.number(),
    humMin: z.coerce.number(),
    humMax: z.coerce.number(),
    telemetryIntervalSeconds: z.coerce.number().int().positive(),
    unlockDurationSeconds: z.coerce.number().int().positive(),
    allowOnlyActiveStudents: z.boolean(),
    hardwareProfile: hardwareProfileSchema,
  })
  .refine((value) => value.tempMin < value.tempMax, {
    message: "Temp. mínima deve ser menor que máxima.",
    path: ["tempMin"],
  })
  .refine((value) => value.humMin < value.humMax, {
    message: "Umidade mínima deve ser menor que máxima.",
    path: ["humMin"],
  });

const simulateAccessSchema = z.object({
  deviceId: z.number().int().positive("Selecione a portaria"),
  studentId: z.number().int().positive("Informe o ID do aluno"),
  cardUid: z
    .string()
    .trim()
    .regex(/^[0-9A-Fa-f]{4,32}$/, "UID RFID inválido.")
    .optional(),
  occurredAt: z.string().optional(),
  source: z.enum(["manual", "auto"]).optional(),
});

const simulateTelemetrySchema = z.object({
  roomId: z.number().int().positive("Selecione a sala"),
  deviceId: z.number().int().positive("Selecione o dispositivo"),
  temperature: z.number(),
  humidity: z.number(),
  sensorModel: z.enum(SENSOR_MODELS).optional(),
  i2cAddress: z
    .string()
    .trim()
    .regex(/^0[xX][0-9A-Fa-f]{2}$/, "Endereço I²C inválido.")
    .optional(),
  measuredAt: z.string().optional(),
});

const generateTelemetrySchema = z.object({
  roomId: z.number().int().positive(),
  deviceId: z.number().int().positive(),
  baseTemperature: z.number(),
  baseHumidity: z.number(),
  variation: z.number().nonnegative(),
  intervalSeconds: z.number().int().positive(),
  quantity: z.number().int().min(1).max(60),
});

function revalidateMonitoringViews() {
  revalidatePath("/monitoring/overview");
  revalidatePath("/monitoring/rooms");
  revalidatePath("/monitoring/gateways");
  revalidatePath("/monitoring/access-events");
  revalidatePath("/monitoring/readings");
}

function revalidateMonitoringAdminPages() {
  revalidateMonitoringViews();
  revalidatePath("/settings/monitoring");
  revalidatePath("/settings/hardware-simulator");
}

export async function createRoom(data: z.infer<typeof roomSchema>) {
  await requirePermission(MONITORING_PERMISSIONS.MANAGE);

  const parsed = roomSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.room.create({
      data: {
        name: parsed.data.name.trim(),
        location: parsed.data.location?.trim() || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    revalidateMonitoringAdminPages();
    return { success: true };
  } catch (error) {
    return { error: parsePrismaError(error) };
  }
}

export async function updateRoom(id: number, data: z.infer<typeof roomSchema>) {
  await requirePermission(MONITORING_PERMISSIONS.MANAGE);

  const parsed = roomSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    await prisma.room.update({
      where: { id },
      data: {
        name: parsed.data.name.trim(),
        location: parsed.data.location?.trim() || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    revalidateMonitoringAdminPages();
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível atualizar sala com vínculo inválido.",
      }),
    };
  }
}

export async function deleteRoom(id: number) {
  await requirePermission(MONITORING_PERMISSIONS.MANAGE);

  try {
    await prisma.room.delete({ where: { id } });
    revalidateMonitoringAdminPages();
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir sala com leituras vinculadas.",
      }),
    };
  }
}

export async function createDevice(data: z.infer<typeof deviceSchema>) {
  await requirePermission(MONITORING_PERMISSIONS.MANAGE);

  const parsed = deviceSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const roomId = parsed.data.type === "PORTARIA" ? null : parsed.data.roomId ?? null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.device.create({
        data: {
          name: parsed.data.name.trim(),
          type: parsed.data.type,
          roomId,
          isActive: parsed.data.isActive ?? true,
          token: generateDeviceToken(),
        },
      });
      revalidateMonitoringAdminPages();
      return { success: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 2
      ) {
        continue;
      }

      return {
        error: parsePrismaError(error, {
          P2003: "Sala vinculada não encontrada.",
        }),
      };
    }
  }

  return { error: "Falha ao gerar token do dispositivo." };
}

export async function updateDevice(
  id: number,
  data: z.infer<typeof deviceSchema> & { regenerateToken?: boolean }
) {
  await requirePermission(MONITORING_PERMISSIONS.MANAGE);

  const parsed = deviceSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  let token: string | undefined;
  if (data.regenerateToken) {
    token = generateDeviceToken();
  }

  const roomId = parsed.data.type === "PORTARIA" ? null : parsed.data.roomId ?? null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.device.update({
        where: { id },
        data: {
          name: parsed.data.name.trim(),
          type: parsed.data.type,
          roomId,
          isActive: parsed.data.isActive ?? true,
          ...(token ? { token } : {}),
        },
      });
      revalidateMonitoringAdminPages();
      return { success: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        token &&
        attempt < 2
      ) {
        token = generateDeviceToken();
        continue;
      }

      return {
        error: parsePrismaError(error, {
          P2003: "Sala vinculada não encontrada.",
        }),
      };
    }
  }

  return { error: "Falha ao atualizar token do dispositivo." };
}

export async function deleteDevice(id: number) {
  await requirePermission(MONITORING_PERMISSIONS.MANAGE);

  try {
    await prisma.device.delete({ where: { id } });
    revalidateMonitoringAdminPages();
    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        P2003: "Não é possível excluir dispositivo com eventos/leitura vinculados.",
      }),
    };
  }
}

export async function saveMonitoringSettings(data: z.infer<typeof monitoringSettingsSchema>) {
  await requirePermission(MONITORING_PERMISSIONS.ADMIN_SETTINGS);

  const parsed = monitoringSettingsSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  try {
    const current = await ensureMonitoringSettings();
    const normalizedHardwareProfile = resolveMonitoringHardwareProfile({
      transport: "HTTP_REST",
      esp32: { connectivity: "WIFI" },
      telemetry: {
        sensorModel: parsed.data.hardwareProfile.telemetry.sensorModel,
        supportedSensorModels: [...SENSOR_MODELS],
        i2cAddress: parsed.data.hardwareProfile.telemetry.i2cAddress,
        endpoint: parsed.data.hardwareProfile.telemetry.endpoint,
      },
      access: {
        readerModel: parsed.data.hardwareProfile.access.readerModel,
        frequencyMHz: parsed.data.hardwareProfile.access.frequencyMHz,
        endpoint: parsed.data.hardwareProfile.access.endpoint,
      },
    });

    await prisma.monitoringSettings.update({
      where: { id: current.id },
      data: {
        tempMin: parsed.data.tempMin,
        tempMax: parsed.data.tempMax,
        humMin: parsed.data.humMin,
        humMax: parsed.data.humMax,
        telemetryIntervalSeconds: parsed.data.telemetryIntervalSeconds,
        unlockDurationSeconds: parsed.data.unlockDurationSeconds,
        allowOnlyActiveStudents: parsed.data.allowOnlyActiveStudents,
        hardwareProfile: normalizedHardwareProfile,
      },
    });
    revalidateMonitoringAdminPages();
    return { success: true };
  } catch (error) {
    return { error: parsePrismaError(error) };
  }
}

export async function simulateRfidAccess(data: z.infer<typeof simulateAccessSchema>) {
  await requirePermission(MONITORING_PERMISSIONS.HARDWARE_SIMULATOR);

  const parsed = simulateAccessSchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const source = parsed.data.source ?? "manual";

  const studentsCount = await prisma.student.count();
  if (studentsCount === 0) {
    return { error: "Cadastre pelo menos um aluno para gerar entrada RFID." };
  }

  const student = await prisma.student.findUnique({
    where: { id: parsed.data.studentId },
    select: { id: true },
  });
  if (!student) {
    return { error: "Aluno não encontrado. Selecione um aluno existente." };
  }

  const device = await prisma.device.findUnique({ where: { id: parsed.data.deviceId } });
  if (!device) return { error: "Dispositivo não encontrado." };

  if (source === "auto") {
    const lastEvent = await prisma.accessEvent.findFirst({
      where: { deviceId: parsed.data.deviceId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (lastEvent) {
      const elapsedMs = Date.now() - lastEvent.createdAt.getTime();
      const minIntervalMs = 5000;
      if (elapsedMs < minIntervalMs) {
        return {
          success: true,
          skipped: true,
          retryAfterMs: Math.max(minIntervalMs - elapsedMs, 0),
        };
      }
    }
  }

  let occurredAt: Date;
  try {
    occurredAt = toIsoDateOrNow(parsed.data.occurredAt);
  } catch {
    return { error: "Data/hora inválida." };
  }

  const settings = await ensureMonitoringSettings();
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);

  const result = await processAccessEvent({
    device,
    studentId: parsed.data.studentId,
    occurredAt,
    metadata: {
      cardUid: parsed.data.cardUid?.toUpperCase(),
      readerModel: hardwareProfile.access.readerModel,
      frequencyMHz: hardwareProfile.access.frequencyMHz,
      transport: hardwareProfile.transport,
      connectivity: hardwareProfile.esp32.connectivity,
    },
  });

  revalidateMonitoringViews();

  return {
    success: true,
    result: {
      result: result.result,
      reason: result.reason,
      unlockDurationSeconds: result.unlockDurationSeconds,
    },
  };
}

export async function simulateTelemetry(data: z.infer<typeof simulateTelemetrySchema>) {
  await requirePermission(MONITORING_PERMISSIONS.HARDWARE_SIMULATOR);

  const parsed = simulateTelemetrySchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const roomsCount = await prisma.room.count({ where: { isActive: true } });
  if (roomsCount === 0) {
    return { error: "Cadastre pelo menos uma sala ativa para gerar temperatura/umidade." };
  }

  const room = await prisma.room.findFirst({
    where: { id: parsed.data.roomId, isActive: true },
    select: { id: true },
  });
  if (!room) {
    return { error: "Sala não encontrada ou inativa." };
  }

  const device = await prisma.device.findUnique({ where: { id: parsed.data.deviceId } });
  if (!device) return { error: "Dispositivo não encontrado." };

  const settings = await ensureMonitoringSettings();
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);

  let measuredAt: Date;
  try {
    measuredAt = toIsoDateOrNow(parsed.data.measuredAt);
  } catch {
    return { error: "Data/hora inválida." };
  }

  const result = await processTelemetryReading({
    device,
    roomId: parsed.data.roomId,
    temperature: parsed.data.temperature,
    humidity: parsed.data.humidity,
    measuredAt,
    metadata: {
      sensorModel: parsed.data.sensorModel ?? hardwareProfile.telemetry.sensorModel,
      i2cAddress: parsed.data.i2cAddress ?? hardwareProfile.telemetry.i2cAddress,
      transport: hardwareProfile.transport,
      connectivity: hardwareProfile.esp32.connectivity,
    },
  });

  if (!result.ok) {
    return { error: result.reason };
  }

  revalidateMonitoringViews();
  return { success: true };
}

export async function generateTelemetryBatch(data: z.infer<typeof generateTelemetrySchema>) {
  await requirePermission(MONITORING_PERMISSIONS.HARDWARE_SIMULATOR);

  const parsed = generateTelemetrySchema.safeParse(data);
  if (!parsed.success) return { error: parseZodError(parsed.error) };

  const roomsCount = await prisma.room.count({ where: { isActive: true } });
  if (roomsCount === 0) {
    return { error: "Cadastre pelo menos uma sala ativa para gerar temperatura/umidade." };
  }

  const room = await prisma.room.findFirst({
    where: { id: parsed.data.roomId, isActive: true },
    select: { id: true },
  });
  if (!room) {
    return { error: "Sala não encontrada ou inativa." };
  }

  const device = await prisma.device.findUnique({ where: { id: parsed.data.deviceId } });
  if (!device) return { error: "Dispositivo não encontrado." };

  const settings = await ensureMonitoringSettings();
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);

  const now = Date.now();
  for (let idx = 0; idx < parsed.data.quantity; idx += 1) {
    const jitterTemp = (Math.random() * 2 - 1) * parsed.data.variation;
    const jitterHum = (Math.random() * 2 - 1) * parsed.data.variation;
    const measuredAt = new Date(
      now - (parsed.data.quantity - idx - 1) * parsed.data.intervalSeconds * 1000
    );

    const result = await processTelemetryReading({
      device,
      roomId: parsed.data.roomId,
      temperature: parsed.data.baseTemperature + jitterTemp,
      humidity: parsed.data.baseHumidity + jitterHum,
      measuredAt,
      metadata: {
        sensorModel: hardwareProfile.telemetry.sensorModel,
        i2cAddress: hardwareProfile.telemetry.i2cAddress,
        transport: hardwareProfile.transport,
        connectivity: hardwareProfile.esp32.connectivity,
      },
    });

    if (!result.ok) {
      return { error: result.reason };
    }
  }

  revalidateMonitoringViews();
  return { success: true };
}
