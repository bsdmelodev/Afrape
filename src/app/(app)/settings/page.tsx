import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, UserCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { DataActions } from "./components/data-actions";

export default async function SettingsPage() {
  const user = await requirePermission("settings.read");

  const permissions = user.permissions ?? [];
  const canWrite = permissions.includes("settings.write");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="text-muted-foreground">Informações da conta e permissões atuais.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <UserCircle2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <CardTitle>{user?.name ?? "Usuário"}</CardTitle>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Grupo:</span>
            <Badge variant="secondary">{user?.group.name ?? "—"}</Badge>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-semibold">Permissões</span>
          </div>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma permissão listada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.map((code) => (
                <Badge key={code} variant="outline">
                  {code}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>População de dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gere rapidamente dados de exemplo (turmas, disciplinas, responsáveis, alunos,
              matrículas, componentes, períodos, sessões e notas).
            </p>
            <DataActions />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
