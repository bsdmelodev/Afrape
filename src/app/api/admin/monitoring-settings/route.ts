import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import {
  ensureMonitoringSettings,
  MONITORING_PERMISSIONS,
  resolveMonitoringHardwareProfile,
} from "@/lib/monitoring";

const updateSchema = z
  .object({
    temp_min: z.coerce.number(),
    temp_max: z.coerce.number(),
    hum_min: z.coerce.number(),
    hum_max: z.coerce.number(),
    telemetry_interval_seconds: z.coerce.number().int().positive(),
    unlock_duration_seconds: z.coerce.number().int().positive(),
    allow_only_active_students: z.boolean(),
    hardware_profile: z
      .object({
        telemetry: z.object({
          sensor_model: z.enum(["SHT31", "SHT35"]),
          i2c_address: z
            .string()
            .trim()
            .regex(/^0[xX][0-9A-Fa-f]{2}$/, "i2c_address inválido."),
          endpoint: z.string().min(1),
        }),
        access: z.object({
          reader_model: z.literal("PN532"),
          frequency_mhz: z.coerce.number().positive(),
          endpoint: z.string().min(1),
        }),
      })
      .optional(),
  })
  .refine((value) => value.temp_min < value.temp_max, {
    message: "temp_min deve ser menor que temp_max",
    path: ["temp_min"],
  })
  .refine((value) => value.hum_min < value.hum_max, {
    message: "hum_min deve ser menor que hum_max",
    path: ["hum_min"],
  });

function serialize(settings: {
  id: number;
  tempMin: unknown;
  tempMax: unknown;
  humMin: unknown;
  humMax: unknown;
  telemetryIntervalSeconds: number;
  unlockDurationSeconds: number;
  allowOnlyActiveStudents: boolean;
  hardwareProfile: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);
  return {
    id: settings.id,
    temp_min: Number(settings.tempMin),
    temp_max: Number(settings.tempMax),
    hum_min: Number(settings.humMin),
    hum_max: Number(settings.humMax),
    telemetry_interval_seconds: settings.telemetryIntervalSeconds,
    unlock_duration_seconds: settings.unlockDurationSeconds,
    allow_only_active_students: settings.allowOnlyActiveStudents,
    hardware_profile: {
      transport: hardwareProfile.transport,
      connectivity: hardwareProfile.esp32.connectivity,
      telemetry: {
        sensor_model: hardwareProfile.telemetry.sensorModel,
        supported_sensor_models: hardwareProfile.telemetry.supportedSensorModels,
        i2c_address: hardwareProfile.telemetry.i2cAddress,
        endpoint: hardwareProfile.telemetry.endpoint,
      },
      access: {
        reader_model: hardwareProfile.access.readerModel,
        frequency_mhz: hardwareProfile.access.frequencyMHz,
        endpoint: hardwareProfile.access.endpoint,
      },
    },
    created_at: settings.createdAt,
    updated_at: settings.updatedAt,
  };
}

export async function GET() {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.ADMIN_SETTINGS);
  if ("error" in auth) return auth.error;

  const settings = await ensureMonitoringSettings();
  return NextResponse.json(serialize(settings));
}

export async function PUT(request: Request) {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.ADMIN_SETTINGS);
  if ("error" in auth) return auth.error;

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

  const current = await ensureMonitoringSettings();
  const currentHardwareProfile = resolveMonitoringHardwareProfile(current.hardwareProfile);
  const mergedHardwareProfile = resolveMonitoringHardwareProfile({
    transport: "HTTP_REST",
    esp32: { connectivity: "WIFI" },
    telemetry: {
      sensorModel:
        parsed.data.hardware_profile?.telemetry.sensor_model ??
        currentHardwareProfile.telemetry.sensorModel,
      supportedSensorModels: ["SHT31", "SHT35"],
      i2cAddress:
        parsed.data.hardware_profile?.telemetry.i2c_address ??
        currentHardwareProfile.telemetry.i2cAddress,
      endpoint:
        parsed.data.hardware_profile?.telemetry.endpoint ??
        currentHardwareProfile.telemetry.endpoint,
    },
    access: {
      readerModel:
        parsed.data.hardware_profile?.access.reader_model ??
        currentHardwareProfile.access.readerModel,
      frequencyMHz:
        parsed.data.hardware_profile?.access.frequency_mhz ??
        currentHardwareProfile.access.frequencyMHz,
      endpoint:
        parsed.data.hardware_profile?.access.endpoint ??
        currentHardwareProfile.access.endpoint,
    },
  });

  const updated = await prisma.monitoringSettings.update({
    where: { id: current.id },
    data: {
      tempMin: parsed.data.temp_min,
      tempMax: parsed.data.temp_max,
      humMin: parsed.data.hum_min,
      humMax: parsed.data.hum_max,
      telemetryIntervalSeconds: parsed.data.telemetry_interval_seconds,
      unlockDurationSeconds: parsed.data.unlock_duration_seconds,
      allowOnlyActiveStudents: parsed.data.allow_only_active_students,
      hardwareProfile: mergedHardwareProfile,
    },
  });

  return NextResponse.json(serialize(updated));
}
