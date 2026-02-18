import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ensureMonitoringSettings,
  MONITORING_PERMISSIONS,
  resolveMonitoringHardwareProfile,
} from "@/lib/monitoring";
import { requirePermission } from "@/lib/rbac";
import { MonitoringSettingsForm } from "../../monitoring/components/monitoring-settings-form";

export default async function MonitoringSettingsPage() {
  await requirePermission(MONITORING_PERMISSIONS.ADMIN_SETTINGS);

  const settings = await ensureMonitoringSettings();
  const hardwareProfile = resolveMonitoringHardwareProfile(settings.hardwareProfile);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações • Monitoramento</h1>
        <p className="text-sm text-muted-foreground">
          Thresholds, intervalos e perfil de hardware ESP32/Wi-Fi (SHT31/SHT35 + PN532) via HTTP REST.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros básicos</CardTitle>
        </CardHeader>
        <CardContent>
          <MonitoringSettingsForm
            defaultValues={{
              tempMin: Number(settings.tempMin),
              tempMax: Number(settings.tempMax),
              humMin: Number(settings.humMin),
              humMax: Number(settings.humMax),
              telemetryIntervalSeconds: settings.telemetryIntervalSeconds,
              unlockDurationSeconds: settings.unlockDurationSeconds,
              allowOnlyActiveStudents: settings.allowOnlyActiveStudents,
              hardwareProfile: {
                telemetry: {
                  sensorModel: hardwareProfile.telemetry.sensorModel,
                  i2cAddress: hardwareProfile.telemetry.i2cAddress,
                  endpoint: hardwareProfile.telemetry.endpoint,
                },
                access: {
                  readerModel: hardwareProfile.access.readerModel,
                  frequencyMHz: hardwareProfile.access.frequencyMHz,
                  endpoint: hardwareProfile.access.endpoint,
                },
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
