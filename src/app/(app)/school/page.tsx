import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/rbac";
import type { SchoolInput } from "./actions";
import { prisma } from "@/lib/prisma";
import { SchoolForm } from "./school-form";

async function getSchoolSafe() {
  try {
    const exists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      "select exists (select 1 from information_schema.tables where table_name = 'school')"
    );
    if (!exists[0]?.exists) return null;
    try {
      return await prisma.school.findFirst({
        select: {
          name: true,
          cnpj: true,
          ie: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          phone: true,
          email: true,
          website: true,
          logoUrl: true,
        },
      });
    } catch (err) {
      console.warn("Falha ao consultar school; execute prisma/sql/school.sql", err);
      return null;
    }
  } catch (error) {
    console.warn("Tabela school não encontrada. Execute prisma/sql/school.sql se necessário.", error);
    return null;
  }
}

export default async function SchoolPage() {
  const user = await requirePermission("school.read");

  const schoolRow = await getSchoolSafe();
  const initial: SchoolInput = {
    name: schoolRow?.name ?? "",
    cnpj: schoolRow?.cnpj ?? "",
    ie: schoolRow?.ie ?? "",
    address: schoolRow?.address ?? "",
    city: schoolRow?.city ?? "",
    state: schoolRow?.state ?? "",
    zip: schoolRow?.zip ?? "",
    phone: schoolRow?.phone ?? "",
    email: schoolRow?.email ?? "",
    website: schoolRow?.website ?? "",
    logoUrl: schoolRow?.logoUrl ?? "",
  };

  const canEdit = user.permissions.includes("school.write");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Escola</h1>
          <p className="text-muted-foreground">
            Cadastre as informações institucionais. Apenas um registro é permitido.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da escola</CardTitle>
        </CardHeader>
        <CardContent>
          <SchoolForm initial={initial} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
