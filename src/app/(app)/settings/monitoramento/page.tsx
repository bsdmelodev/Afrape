import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureMonitoringSettings, MONITORING_PERMISSIONS } from "@/lib/monitoring";
import { requirePermission } from "@/lib/rbac";
import { MonitoringSettingsForm } from "../../monitoramento/components/monitoring-settings-form";

export default async function MonitoringSettingsPage() {
  await requirePermission(MONITORING_PERMISSIONS.ADMIN_SETTINGS);

  const settings = await ensureMonitoringSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações • Monitoramento</h1>
        <p className="text-sm text-muted-foreground">
          Thresholds, intervalos e regras para controle de acesso e telemetria.
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
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
