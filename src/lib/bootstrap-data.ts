export type PermissionDefinition = {
  code: string;
  description: string;
};

export type GroupDefinition = {
  name: string;
  description: string;
  permissions: string[];
};

export type SeedIdentityConfig = {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  adminCpf: string;
  masterEmail: string;
  masterPassword: string;
  masterName: string;
  masterCpf: string;
};

type EnvLike = Record<string, string | undefined>;

export const SCHOOL_DEFAULT = {
  name: "Escola Modelo",
} as const;

export const SCHOOL_DEMO_DEFAULT = {
  name: "Escola Modelo",
  city: "São Paulo",
  state: "SP",
  phone: "1130000000",
} as const;

export const BASE_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
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
  { code: "teacher_assignments.write", description: "Criar/editar/excluir alocações de professores" },
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
  {
    code: "monitoring.read",
    description: "Visualizar dashboards, leituras e eventos de monitoramento",
  },
  {
    code: "monitoring.write",
    description: "Gerenciar salas, portarias e dispositivos de monitoramento",
  },
  {
    code: "monitoring_settings.write",
    description: "Alterar configurações administrativas do monitoramento",
  },
  {
    code: "hardware_simulator.write",
    description: "Acessar simulador de hardware de monitoramento",
  },
];

const allPermissionCodes = BASE_PERMISSION_DEFINITIONS.map((permission) => permission.code);
const adminPermissionCodes = allPermissionCodes.filter(
  (code) => code !== "settings.read" && code !== "settings.write"
);

export const BASE_GROUP_DEFINITIONS: GroupDefinition[] = [
  {
    name: "Master",
    description: "Acesso total ao sistema",
    permissions: allPermissionCodes,
  },
  {
    name: "Admin",
    description: "Acesso completo (exceto Configurações)",
    permissions: adminPermissionCodes,
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

export const MONITORING_HARDWARE_PROFILE = {
  transport: "HTTP_REST",
  esp32: {
    connectivity: "WIFI",
  },
  telemetry: {
    sensorModel: "SHT31",
    supportedSensorModels: ["SHT31", "SHT35"],
    i2cAddress: "0x44",
    endpoint: "/api/iot/telemetry",
  },
  access: {
    readerModel: "PN532",
    frequencyMHz: 13.56,
    endpoint: "/api/iot/access",
  },
} as const;

export const MONITORING_DEFAULTS = {
  tempMin: "20.00",
  tempMax: "28.00",
  humMin: "40.00",
  humMax: "70.00",
  telemetryIntervalSeconds: 60,
  unlockDurationSeconds: 5,
  allowOnlyActiveStudents: true,
  hardwareProfile: MONITORING_HARDWARE_PROFILE,
} as const;

export const DEMO_MONITORING_ROOM = {
  name: "Sala 101",
  location: "Bloco A",
} as const;

export const DEMO_MONITORING_DEVICES = [
  {
    token: "dev-sala-101-token",
    name: "Sensor Sala 101",
    type: "SALA" as const,
    roomRequired: true,
  },
  {
    token: "dev-portaria-principal-token",
    name: "Portaria Principal",
    type: "PORTARIA" as const,
    roomRequired: false,
  },
] as const;

export function normalizeCpf(rawValue: string | undefined, fallback = "00000000000") {
  return (rawValue ?? fallback).replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
}

export function getSeedIdentityConfig(env: EnvLike = process.env): SeedIdentityConfig {
  return {
    adminEmail: env.SEED_ADMIN_EMAIL ?? "admin@escola.local",
    adminPassword: env.SEED_ADMIN_PASSWORD ?? "Admin@123456",
    adminName: env.SEED_ADMIN_NAME ?? "Administrador",
    adminCpf: normalizeCpf(env.SEED_ADMIN_CPF, "00000000000"),
    masterEmail: "bruno@rocketup.com.br",
    masterPassword: "123456",
    masterName: "Bruno Master",
    masterCpf: "88888888888",
  };
}
