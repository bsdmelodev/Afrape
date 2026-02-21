import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import pg from "pg";
import {
  BASE_GROUP_DEFINITIONS,
  BASE_PERMISSION_DEFINITIONS,
  getSeedIdentityConfig,
  MONITORING_DEFAULTS,
  type SeedIdentityConfig,
  SCHOOL_DEFAULT,
} from "../src/lib/bootstrap-data";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatório para rodar o seed");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function ensureSchool() {
  await prisma.school.upsert({
    where: { id: 1 },
    update: SCHOOL_DEFAULT,
    create: SCHOOL_DEFAULT,
  });
}

async function ensureMonitoringSettings() {
  const currentSettings = await prisma.monitoringSettings.findFirst({
    select: { id: true },
  });

  if (currentSettings) {
    await prisma.monitoringSettings.update({
      where: { id: currentSettings.id },
      data: MONITORING_DEFAULTS,
    });
    return;
  }

  await prisma.monitoringSettings.create({ data: MONITORING_DEFAULTS });
}

async function seedPermissions() {
  const permissions = await Promise.all(
    BASE_PERMISSION_DEFINITIONS.map(({ code, description }) =>
      prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      })
    )
  );

  return new Map(permissions.map((permission) => [permission.code, permission.id]));
}

async function seedGroups(permissionMap: Map<string, number>) {
  for (const group of BASE_GROUP_DEFINITIONS) {
    const groupRecord = await prisma.userGroup.upsert({
      where: { name: group.name },
      update: { description: group.description },
      create: { name: group.name, description: group.description },
    });

    await prisma.groupPermission.deleteMany({ where: { groupId: groupRecord.id } });

    const groupPermissions = group.permissions
      .map((code) => permissionMap.get(code))
      .filter((permissionId): permissionId is number => typeof permissionId === "number")
      .map((permissionId) => ({
        groupId: groupRecord.id,
        permissionId,
      }));

    if (groupPermissions.length === 0) continue;

    await prisma.groupPermission.createMany({
      data: groupPermissions,
      skipDuplicates: true,
    });
  }
}

async function seedDefaultUsers(config: SeedIdentityConfig) {
  const [masterGroup, masterPasswordHash] = await Promise.all([
    prisma.userGroup.findUniqueOrThrow({ where: { name: "Master" } }),
    bcrypt.hash(config.masterPassword, 10),
  ]);

  await prisma.user.upsert({
    where: { email: config.masterEmail },
    update: {
      name: config.masterName,
      groupId: masterGroup.id,
      cpf: config.masterCpf,
      passwordHash: masterPasswordHash,
      isActive: true,
    },
    create: {
      email: config.masterEmail,
      name: config.masterName,
      groupId: masterGroup.id,
      cpf: config.masterCpf,
      passwordHash: masterPasswordHash,
      isActive: true,
    },
  });
}

async function main() {
  const config = getSeedIdentityConfig();

  await ensureSchool();
  await ensureMonitoringSettings();

  const permissionMap = await seedPermissions();
  await seedGroups(permissionMap);
  await seedDefaultUsers(config);

  console.log(
    "Seed concluído. Master:",
    config.masterEmail
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
