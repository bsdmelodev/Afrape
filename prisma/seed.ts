import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatório para rodar o seed");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const permissionDefinitions = [
  { code: "students.read", description: "Visualizar alunos" },
  { code: "students.write", description: "Criar/editar/excluir alunos" },
  { code: "guardians.read", description: "Visualizar responsáveis" },
  { code: "guardians.write", description: "Criar/editar/excluir responsáveis" },
  { code: "class_groups.read", description: "Visualizar turmas" },
  { code: "class_groups.write", description: "Criar/editar/excluir turmas" },
  { code: "subjects.read", description: "Visualizar disciplinas" },
  { code: "subjects.write", description: "Criar/editar/excluir disciplinas" },
  { code: "enrollments.read", description: "Visualizar matrículas" },
  { code: "enrollments.write", description: "Criar/editar/excluir matrículas" },
  { code: "teachers.read", description: "Visualizar professores" },
  { code: "teachers.write", description: "Criar/editar/excluir professores" },
  { code: "class_subjects.read", description: "Visualizar componentes de turma" },
  { code: "class_subjects.write", description: "Criar/editar/excluir componentes de turma" },
  { code: "teacher_assignments.read", description: "Visualizar alocações de professores" },
  {
    code: "teacher_assignments.write",
    description: "Criar/editar/excluir alocações de professores",
  },
  { code: "academic_terms.read", description: "Visualizar períodos acadêmicos" },
  { code: "academic_terms.write", description: "Criar/editar/excluir períodos acadêmicos" },
  { code: "attendance.read", description: "Visualizar frequência" },
  { code: "attendance.write", description: "Registrar/editar frequência" },
  { code: "assessments.read", description: "Visualizar avaliações" },
  { code: "assessments.write", description: "Criar/editar/excluir avaliações" },
  { code: "term_grades.read", description: "Visualizar fechamento de notas" },
  { code: "term_grades.write", description: "Registrar/editar fechamento de notas" },
  { code: "users.read", description: "Visualizar usuários" },
  { code: "users.write", description: "Criar/editar/excluir usuários" },
  { code: "groups.read", description: "Visualizar grupos" },
  { code: "groups.write", description: "Criar/editar/excluir grupos" },
  { code: "permissions.read", description: "Visualizar permissões" },
  { code: "permissions.write", description: "Criar/editar/excluir permissões" },
  { code: "school.read", description: "Visualizar dados da escola" },
  { code: "school.write", description: "Criar/editar dados da escola" },
  { code: "settings.read", description: "Visualizar configurações" },
  { code: "settings.write", description: "Executar ações administrativas em configurações" },
];

const permissionCodes = permissionDefinitions.map((p) => p.code);
const adminPermissions = permissionCodes.filter(
  (code) => code !== "settings.read" && code !== "settings.write"
);

const groups = [
  {
    name: "Master",
    description: "Acesso total ao sistema",
    permissions: permissionCodes,
  },
  {
    name: "Admin",
    description: "Acesso completo (exceto Configurações)",
    permissions: adminPermissions,
  },
  {
    name: "Secretaria",
    description: "Gestão acadêmica e de matrículas",
    permissions: [
      "students.read",
      "students.write",
      "guardians.read",
      "guardians.write",
      "class_groups.read",
      "class_groups.write",
      "subjects.read",
      "subjects.write",
      "enrollments.read",
      "enrollments.write",
      "term_grades.read",
    ],
  },
  {
    name: "Professor",
    description: "Lançamento de frequência e avaliações",
    permissions: [
      "students.read",
      "class_groups.read",
      "subjects.read",
      "attendance.write",
      "assessments.write",
      "term_grades.read",
    ],
  },
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@escola.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const masterEmail = "bruno@rocketup.com.br";
  const masterPassword = "123456";
  const masterName = "Bruno Master";

  await prisma.school.upsert({
    where: { id: 1 },
    update: { name: "Escola Modelo" },
    create: { name: "Escola Modelo" },
  });

  const permissions = await Promise.all(
    permissionDefinitions.map(({ code, description }) =>
      prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      })
    )
  );

  const permissionMap = new Map(permissions.map((p) => [p.code, p]));

  for (const group of groups) {
    const groupRecord = await prisma.userGroup.upsert({
      where: { name: group.name },
      update: { description: group.description },
      create: { name: group.name, description: group.description },
    });

    await prisma.groupPermission.deleteMany({ where: { groupId: groupRecord.id } });

    for (const code of group.permissions) {
      const permission = permissionMap.get(code);
      if (!permission) continue;
      await prisma.groupPermission.upsert({
        where: {
          groupId_permissionId: {
            groupId: groupRecord.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { groupId: groupRecord.id, permissionId: permission.id },
      });
    }
  }

  const adminGroup = await prisma.userGroup.findUniqueOrThrow({ where: { name: "Admin" } });
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const masterGroup = await prisma.userGroup.findUniqueOrThrow({ where: { name: "Master" } });
  const masterHash = await bcrypt.hash(masterPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      groupId: adminGroup.id,
      cpf: "99999999999",
      passwordHash,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      groupId: adminGroup.id,
      cpf: "99999999999",
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: masterEmail },
    update: {
      name: masterName,
      groupId: masterGroup.id,
      cpf: "88888888888",
      passwordHash: masterHash,
      isActive: true,
    },
    create: {
      email: masterEmail,
      name: masterName,
      groupId: masterGroup.id,
      cpf: "88888888888",
      passwordHash: masterHash,
      isActive: true,
    },
  });

  console.log(
    "Seed concluído. Admin:",
    adminEmail,
    "(trocar a senha futuramente). Master:",
    masterEmail
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
