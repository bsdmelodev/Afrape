import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/rbac";
import { ProfileForm } from "./profile-form";
import { formatCpf } from "@/lib/utils";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="text-muted-foreground">Atualize seus dados e senha.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seus dados</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              name: user.name,
              email: user.email,
              cpf: formatCpf(user.cpf),
              avatarUrl: user.avatarUrl ?? undefined,
              password: "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
