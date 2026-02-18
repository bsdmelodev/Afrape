import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/api-rbac";
import {
  ensureMonitoringSettings,
  evaluateReadingStatus,
  MONITORING_PERMISSIONS,
} from "@/lib/monitoring";

export async function GET() {
  const auth = await requireApiPermission(MONITORING_PERMISSIONS.VIEW);
  if ("error" in auth) return auth.error;

  const [settings, activeRooms, rooms, recentEvents] = await Promise.all([
    ensureMonitoringSettings(),
    prisma.room.count({ where: { isActive: true } }),
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        telemetryReadings: {
          take: 1,
          orderBy: { measuredAt: "desc" },
          include: { device: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.accessEvent.findMany({
      take: 10,
      orderBy: { occurredAt: "desc" },
      include: {
        device: { select: { id: true, name: true } },
      },
    }),
  ]);

  const latestReadings = rooms
    .map((room) => {
      const latest = room.telemetryReadings[0];
      if (!latest) return null;

      const temperature = Number(latest.temperature);
      const humidity = Number(latest.humidity);

      return {
        room_id: room.id,
        room_name: room.name,
        measured_at: latest.measuredAt,
        device: latest.device,
        temperature,
        humidity,
        status: evaluateReadingStatus(temperature, humidity, settings),
      };
    })
    .filter(Boolean);

  const alerts = latestReadings.filter((reading) => reading?.status !== "OK").length;

  return NextResponse.json({
    cards: {
      active_rooms: activeRooms,
      rooms_with_latest_reading: latestReadings.length,
      alerts,
      last_access_events: recentEvents.length,
    },
    latest_readings: latestReadings,
    last_access_events: recentEvents,
  });
}
