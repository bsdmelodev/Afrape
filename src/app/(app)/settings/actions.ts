"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";

const firstNames = [
  "Ana", "Bruno", "Carlos", "Daniel", "Eduardo", "Fernanda", "Gabriel", "Helena", "Igor", "Joana",
  "Katia", "Lucas", "Marina", "Nicolas", "Olivia", "Paula", "Rafael", "Sofia", "Thiago", "Vitor",
  "Amanda", "Beatriz", "Caio", "Diego", "Elisa", "Filipe", "Giovana", "Hugo", "Isabela", "Juliana",
  "Karen", "Leandro", "Manuela", "Natália", "Otávio", "Patrícia", "Renato", "Sara", "Talita", "Vinicius",
  "Alana", "Bianca", "Clara", "Davi", "Estela", "Felipe", "Gustavo", "Heitor", "Ingrid", "Jéssica",
  "Larissa", "Mirella", "Noah", "Pedro", "Raissa", "Samuel", "Tatiana", "Yasmin", "Caue", "Ruan",
];

const surnameStarts = [
  "Almeida", "Barros", "Campos", "Dias", "Esteves", "Ferraz", "Gomes", "Henrique", "Ibrahim", "Jardim",
  "Lima", "Macedo", "Nascimento", "Oliveira", "Pereira", "Queiroz", "Ramos", "Silva", "Teixeira", "Uchoa",
  "Vaz", "Xavier", "Yamada", "Zago", "Mendes", "Costa",
];

const surnameEnds = [
  "Alves", "Batista", "Cardoso", "Duarte", "Estevao", "Fernandes", "Garcia", "Holler", "Iglesias", "Jesus",
  "Klein", "Leite", "Martins", "Nunes", "Oliveira", "Porto", "Quintana", "Rocha", "Souza", "Tavares",
  "Urbano", "Vieira", "Walter", "Ximenes", "Yamamoto", "Zanetti", "Borges", "Cavalcanti", "Domingues", "Furtado",
  "Guedes", "Haddad", "Ibiapina", "Junqueira", "Lopes", "Monteiro", "Neves", "Ozório", "Pacheco", "Quevedo",
  "Ribeiro", "Santos", "Torres", "Valente", "Werneck", "Zimmer", "Assis", "Barbosa", "Campos", "Diniz",
];

function buildSurnames() {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const start of surnameStarts) {
    for (const end of surnameEnds) {
      const surname = `${start} ${end}`;
      if (!seen.has(surname)) {
        seen.add(surname);
        result.push(surname);
        if (result.length >= 500) return result;
      }
    }
  }
  return result;
}

const surnamePool = buildSurnames();

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${pick(firstNames)} ${pick(surnamePool)}`;
}

function randomCpf(seed: number) {
  return String(60000000000 + seed).padStart(11, "0");
}

function randomPhone(seed: number) {
  const base = String(900000000 + seed).padStart(9, "0");
  return `11${base}`;
}

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
    code: "MONITORING_VIEW",
    description: "Visualizar dashboards, leituras e eventos de monitoramento",
  },
  {
    code: "MONITORING_MANAGE",
    description: "Gerenciar salas, portarias e dispositivos de monitoramento",
  },
  {
    code: "ADMIN_MONITORING_SETTINGS",
    description: "Alterar configurações administrativas do monitoramento",
  },
  {
    code: "ADMIN_HARDWARE_SIMULATOR",
    description: "Acessar simulador de hardware de monitoramento",
  },
];

const adminPermissions = permissionDefinitions
  .map((p) => p.code)
  .filter((code) => code !== "settings.read" && code !== "settings.write");

const seedGroups = [
  {
    name: "Master",
    description: "Acesso total ao sistema",
    permissions: permissionDefinitions.map((p) => p.code),
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

export async function populateDemoData() {
  await requirePermission("settings.write");

  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "Demo@123456";
  const demoHash = await hashPassword(demoPassword);

  // 1) Permissões e grupos
  const permissions = await Promise.all(
    permissionDefinitions.map(({ code, description }) =>
      prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      })
    )
  );
  const permissionMap = new Map(permissions.map((p) => [p.code, p.id]));

  const groupRecords = new Map<string, number>();
  for (const group of seedGroups) {
    const groupRecord = await prisma.userGroup.upsert({
      where: { name: group.name },
      update: { description: group.description },
      create: { name: group.name, description: group.description },
    });
    groupRecords.set(group.name, groupRecord.id);
    await prisma.groupPermission.deleteMany({ where: { groupId: groupRecord.id } });
    for (const code of group.permissions) {
      const pid = permissionMap.get(code);
      if (!pid) continue;
      await prisma.groupPermission.create({ data: { groupId: groupRecord.id, permissionId: pid } });
    }
  }

  // 2) Escola
  try {
    await prisma.school.upsert({
      where: { id: 1 },
      update: { name: "Escola Modelo", city: "São Paulo", state: "SP", phone: "1130000000" },
      create: { name: "Escola Modelo", city: "São Paulo", state: "SP", phone: "1130000000" },
    });
  } catch (err) {
    console.warn("Tabela school indisponível para popular", err);
  }

  // 2.1) Monitoramento (singleton + sala/device de exemplo)
  const monitoringDefaults = {
    tempMin: "20.00",
    tempMax: "28.00",
    humMin: "40.00",
    humMax: "70.00",
    telemetryIntervalSeconds: 60,
    unlockDurationSeconds: 5,
    allowOnlyActiveStudents: true,
  };
  const currentSettings = await prisma.monitoringSettings.findFirst({ select: { id: true } });
  if (currentSettings) {
    await prisma.monitoringSettings.update({
      where: { id: currentSettings.id },
      data: monitoringDefaults,
    });
  } else {
    await prisma.monitoringSettings.create({ data: monitoringDefaults });
  }

  let sampleRoom = await prisma.room.findFirst({ where: { name: "Sala 101" } });
  if (!sampleRoom) {
    sampleRoom = await prisma.room.create({
      data: { name: "Sala 101", location: "Bloco A", isActive: true },
    });
  }

  await prisma.device.upsert({
    where: { token: "dev-sala-101-token" },
    update: {
      name: "Sensor Sala 101",
      type: "SALA",
      roomId: sampleRoom.id,
      isActive: true,
    },
    create: {
      name: "Sensor Sala 101",
      type: "SALA",
      roomId: sampleRoom.id,
      isActive: true,
      token: "dev-sala-101-token",
    },
  });

  await prisma.device.upsert({
    where: { token: "dev-portaria-principal-token" },
    update: {
      name: "Portaria Principal",
      type: "PORTARIA",
      roomId: null,
      isActive: true,
    },
    create: {
      name: "Portaria Principal",
      type: "PORTARIA",
      roomId: null,
      isActive: true,
      token: "dev-portaria-principal-token",
    },
  });

  // 3) Usuários secretaria (2) e professor (5)
  const userPayloads = [
    { name: randomName(), email: "secretaria1@escola.local", group: "Secretaria" },
    { name: randomName(), email: "secretaria2@escola.local", group: "Secretaria" },
    { name: randomName(), email: "prof1@escola.local", group: "Professor" },
    { name: randomName(), email: "prof2@escola.local", group: "Professor" },
    { name: randomName(), email: "prof3@escola.local", group: "Professor" },
    { name: randomName(), email: "prof4@escola.local", group: "Professor" },
    { name: randomName(), email: "prof5@escola.local", group: "Professor" },
  ];

  const users = [];
  for (const u of userPayloads) {
    const groupId = groupRecords.get(u.group);
    if (!groupId) continue;
    const phone = randomPhone(10000 + Math.floor(Math.random() * 9000));
    const cpf = randomCpf(90000 + Math.floor(Math.random() * 9000));
    const record = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, groupId, passwordHash: demoHash, phone, cpf },
      create: {
        email: u.email,
        name: u.name,
        groupId,
        phone,
        cpf,
        passwordHash: demoHash,
        avatarUrl: null,
      },
    });
    users.push(record);
  }

  const professorUsers = users.filter((u) => u.email.startsWith("prof"));
  const teachers = [];
  for (const prof of professorUsers) {
    const teacher = await prisma.teacher.upsert({
      where: { userId: prof.id },
      update: { isActive: true },
      create: { userId: prof.id, isActive: true },
    });
    teachers.push(teacher);
  }

  // 4) Turmas (5)
  const classGroupPayloads = [
    { name: "6ºA", schoolYear: 2025, shift: 1 },
    { name: "6ºB", schoolYear: 2025, shift: 2 },
    { name: "7ºA", schoolYear: 2025, shift: 1 },
    { name: "7ºB", schoolYear: 2025, shift: 2 },
    { name: "8ºA", schoolYear: 2025, shift: 1 },
  ];
  const classGroups = [];
  for (const cg of classGroupPayloads) {
    const record = await prisma.classGroup.upsert({
      where: { schoolYear_name: { schoolYear: cg.schoolYear, name: cg.name } },
      update: { shift: cg.shift },
      create: cg,
    });
    classGroups.push(record);
  }

  // 5) Disciplinas (10)
  const subjectPayloads = [
    "Matemática",
    "Português",
    "História",
    "Geografia",
    "Ciências",
    "Inglês",
    "Artes",
    "Educação Física",
    "Física",
    "Química",
  ].map((name, idx) => ({ name, code: `DISC-${idx + 1}` }));
  const subjects = [];
  for (const s of subjectPayloads) {
    const record = await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: s,
    });
    subjects.push(record);
  }

  // 6) Responsáveis (30)
  const guardians = [];
  for (let i = 0; i < 30; i++) {
    const cpf = randomCpf(1000 + i);
    const g = await prisma.guardian.upsert({
      where: { cpf },
      update: { name: randomName(), email: `resp${i + 1}@mail.com`, phone: randomPhone(2000 + i) },
      create: {
        name: randomName(),
        cpf,
        email: `resp${i + 1}@mail.com`,
        phone: randomPhone(2000 + i),
      },
    });
    guardians.push(g);
  }

  // 7) Alunos (10) com responsáveis (até 3)
  const students = [];
  for (let i = 0; i < 10; i++) {
    const cpf = randomCpf(5000 + i);
    const student = await prisma.student.upsert({
      where: { cpf },
      update: { name: randomName(), email: `aluno${i + 1}@mail.com`, phone: randomPhone(6000 + i) },
      create: {
        name: randomName(),
        cpf,
        email: `aluno${i + 1}@mail.com`,
        phone: randomPhone(6000 + i),
      },
    });
    students.push(student);

    const start = (i * 3) % guardians.length;
    const slice = guardians.slice(start, start + 3);
    for (let j = 0; j < slice.length; j++) {
      await prisma.studentGuardian.upsert({
        where: {
          studentId_guardianId: { studentId: student.id, guardianId: slice[j].id },
        },
        update: {
          relationship: j === 0 ? "Responsável" : "Contato",
          isPrimary: j === 0,
          livesWithStudent: j === 0,
          isFinancial: j === 0,
        },
        create: {
          studentId: student.id,
          guardianId: slice[j].id,
          relationship: j === 0 ? "Responsável" : "Contato",
          isPrimary: j === 0,
          livesWithStudent: j === 0,
          isFinancial: j === 0,
        },
      });
    }
  }

  // 8) Matrículas distribuídas
  const enrollments = [];
  for (let i = 0; i < students.length; i++) {
    const group = classGroups[i % classGroups.length];
    const existing = await prisma.enrollment.findFirst({
      where: { studentId: students[i].id, classGroupId: group.id },
    });
    const record =
      existing ||
      (await prisma.enrollment.create({
        data: { studentId: students[i].id, classGroupId: group.id, status: "active" },
      }));
    enrollments.push(record);
  }

  // 9) Turma x Disciplina (2 por turma)
  const classSubjects = [];
  for (const [idx, group] of classGroups.entries()) {
    const chosen = [subjects[(idx * 2) % subjects.length], subjects[(idx * 2 + 1) % subjects.length]];
    for (const subj of chosen) {
      const record = await prisma.classSubject.upsert({
        where: { classGroupId_subjectId: { classGroupId: group.id, subjectId: subj.id } },
        update: {},
        create: { classGroupId: group.id, subjectId: subj.id, workloadMinutes: 2000 },
      });
      classSubjects.push(record);
    }
  }

  // 10) Atribuir professores às turmas/disciplinas
  for (const [idx, cs] of classSubjects.entries()) {
    const teacher = teachers[idx % teachers.length];
    if (!teacher) continue;
    const found = await prisma.teacherAssignment.findFirst({
      where: { classSubjectId: cs.id, teacherId: teacher.id },
    });
    if (!found) {
      await prisma.teacherAssignment.create({
        data: { classSubjectId: cs.id, teacherId: teacher.id, role: 1 },
      });
    }
  }

  // 11) Períodos letivos
  const terms = [];
  const termPayloads = [
    { schoolYear: 2025, name: "1º Bimestre", termOrder: 1, startsAt: new Date("2025-02-01"), endsAt: new Date("2025-03-31") },
    { schoolYear: 2025, name: "2º Bimestre", termOrder: 2, startsAt: new Date("2025-04-01"), endsAt: new Date("2025-06-30") },
  ];
  for (const t of termPayloads) {
    const term = await prisma.academicTerm.upsert({
      where: { schoolYear_termOrder: { schoolYear: t.schoolYear, termOrder: t.termOrder } },
      update: {},
      create: t,
    });
    terms.push(term);
  }

  // 12) Frequência: sessões + presenças
  const sessions = [];
  for (const [idx, cs] of classSubjects.entries()) {
    const teacherAssign = await prisma.teacherAssignment.findFirst({ where: { classSubjectId: cs.id } });
    if (!teacherAssign) continue;
    const sessionDate = new Date(`2025-02-${10 + (idx % 5)}`);
    const existingSession = await prisma.attendanceSession.findFirst({
      where: { classSubjectId: cs.id, sessionDate, lessonNumber: 1 },
    });
    const session =
      existingSession ??
      (await prisma.attendanceSession.create({
        data: {
          classSubjectId: cs.id,
          termId: terms[0].id,
          sessionDate,
          lessonNumber: 1,
          launchedByTeacherId: teacherAssign.teacherId,
        },
      }));
    sessions.push(session);

    const groupEnrollments = enrollments.filter((e) => e.classGroupId === cs.classGroupId);
    for (const [eIdx, enr] of groupEnrollments.entries()) {
      await prisma.attendanceRecord.upsert({
        where: { attendanceSessionId_enrollmentId: { attendanceSessionId: session.id, enrollmentId: enr.id } },
        update: {
          status: eIdx % 5 === 0 ? "late" : "present",
          minutesLate: eIdx % 5 === 0 ? 5 : null,
        },
        create: {
          attendanceSessionId: session.id,
          enrollmentId: enr.id,
          status: eIdx % 5 === 0 ? "late" : "present",
          minutesLate: eIdx % 5 === 0 ? 5 : null,
        },
      });
    }
  }

  // 13) Avaliações + notas
  const assessments = [];
  for (const [idx, cs] of classSubjects.entries()) {
    const teacherAssign = await prisma.teacherAssignment.findFirst({ where: { classSubjectId: cs.id } });
    if (!teacherAssign) continue;
    const assessmentDate = new Date(`2025-03-${10 + (idx % 10)}`);
    const assessment =
      (await prisma.assessment.findFirst({
        where: {
          classSubjectId: cs.id,
          termId: terms[idx % terms.length].id,
          title: `Avaliação ${idx + 1}`,
          assessmentDate,
        },
      })) ??
      (await prisma.assessment.create({
        data: {
          classSubjectId: cs.id,
          termId: terms[idx % terms.length].id,
          title: `Avaliação ${idx + 1}`,
          assessmentType: "exam",
          assessmentDate,
          maxScore: 10,
          weight: 1,
          createdByTeacherId: teacherAssign.teacherId,
        },
      }));
    assessments.push(assessment);

    const groupEnrollments = enrollments.filter((e) => e.classGroupId === cs.classGroupId);
    for (const [eIdx, enr] of groupEnrollments.entries()) {
      const score = eIdx % 6 === 0 ? null : 6 + (eIdx % 4); // alguns ausentes/null
      await prisma.assessmentScore.upsert({
        where: { assessmentId_enrollmentId: { assessmentId: assessment.id, enrollmentId: enr.id } },
        update: {
          score: score ?? undefined,
          isAbsent: score === null,
        },
        create: {
          assessmentId: assessment.id,
          enrollmentId: enr.id,
          score: score ?? undefined,
          isAbsent: score === null,
        },
      });
    }
  }

  // 14) Fechamento (term_grades)
  for (const enr of enrollments) {
    const relatedClassSubjects = classSubjects.filter((cs) => cs.classGroupId === enr.classGroupId);
    for (const cs of relatedClassSubjects) {
      for (const term of terms) {
        const scores = await prisma.assessmentScore.findMany({
          where: {
            enrollmentId: enr.id,
            assessment: { classSubjectId: cs.id, termId: term.id },
          },
        });
        if (scores.length === 0) continue;
        const valid = scores.filter((s) => s.score !== null && s.score !== undefined);
        const avg = valid.length > 0 ? valid.reduce((sum, s) => sum + Number(s.score), 0) / valid.length : null;
        await prisma.termGrade.upsert({
          where: {
            enrollmentId_classSubjectId_termId: {
              enrollmentId: enr.id,
              classSubjectId: cs.id,
              termId: term.id,
            },
          },
          update: { grade: avg ?? null },
          create: {
            enrollmentId: enr.id,
            classSubjectId: cs.id,
            termId: term.id,
            grade: avg ?? null,
          },
        });
      }
    }
  }

  return { success: true };
}

export async function generateSampleStudents() {
  await requirePermission("users.write");
  const base = Date.now() % 100000;

  // Garantir responsáveis extras
  const guardians = [];
  for (let i = 0; i < 10; i++) {
    const cpf = randomCpf(base + 100 + i);
    const g = await prisma.guardian.upsert({
      where: { cpf },
      update: { name: randomName(), email: `auto.resp.${base + i}@mail.com`, phone: randomPhone(base + 200 + i) },
      create: {
        name: randomName(),
        cpf,
        email: `auto.resp.${base + i}@mail.com`,
        phone: randomPhone(base + 200 + i),
      },
    });
    guardians.push(g);
  }

  // Criar 5 alunos e vincular 2 responsáveis
  for (let i = 0; i < 5; i++) {
    const cpf = randomCpf(base + 500 + i);
    const student = await prisma.student.upsert({
      where: { cpf },
      update: { name: randomName(), email: `auto.aluno.${base + i}@mail.com`, phone: randomPhone(base + 600 + i) },
      create: {
        name: randomName(),
        cpf,
        email: `auto.aluno.${base + i}@mail.com`,
        phone: randomPhone(base + 600 + i),
      },
    });

    const g1 = guardians[(i * 2) % guardians.length];
    const g2 = guardians[(i * 2 + 1) % guardians.length];

    for (const [idx, g] of [g1, g2].entries()) {
      await prisma.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: student.id, guardianId: g.id } },
        update: {
          relationship: idx === 0 ? "Responsável" : "Contato",
          isPrimary: idx === 0,
          livesWithStudent: idx === 0,
          isFinancial: idx === 0,
        },
        create: {
          studentId: student.id,
          guardianId: g.id,
          relationship: idx === 0 ? "Responsável" : "Contato",
          isPrimary: idx === 0,
          livesWithStudent: idx === 0,
          isFinancial: idx === 0,
        },
      });
    }
  }

  return { success: true };
}

export async function generateSampleProfessors() {
  await requirePermission("users.write");
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "Demo@123456";
  const demoHash = await hashPassword(demoPassword);
  const base = Date.now() % 100000;

  // Garantir grupo Professor
  const professorGroup = await prisma.userGroup.upsert({
    where: { name: "Professor" },
    update: {},
    create: { name: "Professor", description: "Lançamento de frequência e avaliações" },
  });

  const users = [];
  for (let i = 0; i < 5; i++) {
    const email = `prof.auto.${base + i}@escola.local`;
    const name = randomName();
    const phone = randomPhone(base + 700 + i);
    const cpf = randomCpf(base + 800 + i);
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, groupId: professorGroup.id, passwordHash: demoHash, phone, cpf },
      create: {
        email,
        name,
        groupId: professorGroup.id,
        phone,
        cpf,
        passwordHash: demoHash,
        isActive: true,
      },
    });
    users.push(user);
  }

  for (const user of users) {
    await prisma.teacher.upsert({
      where: { userId: user.id },
      update: { isActive: true },
      create: { userId: user.id, isActive: true },
    });
  }

  return { success: true };
}

export async function resetDatabase() {
  await requirePermission("settings.write");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@escola.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const masterEmail = "bruno@rocketup.com.br";
  const masterPassword = "123456";
  const masterName = "Bruno Master";

  const tableExists = async (table: string) => {
    try {
      const res = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `select exists (select 1 from information_schema.tables where table_schema = current_schema() and table_name = '${table}')`
      );
      return Boolean(res[0]?.exists);
    } catch (err) {
      console.warn(`Falha ao verificar tabela ${table}`, err);
      return false;
    }
  };

  const orderedTables = [
    "access_events",
    "telemetry_readings",
    "devices",
    "rooms",
    "monitoring_settings",
    "attendance_records",
    "attendance_sessions",
    "assessment_scores",
    "assessments",
    "term_grades",
    "teacher_assignments",
    "class_subjects",
    "enrollments",
    "student_guardians",
    "teachers",
    "students",
    "guardians",
    "class_groups",
    "subjects",
    "academic_terms",
    "group_permissions",
    "users",
    "user_groups",
    "permissions",
    "school",
  ];

  for (const table of orderedTables) {
    if (await tableExists(table)) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      } catch (err) {
        console.warn(`Falha ao limpar tabela ${table}`, err);
      }
    }
  }

  if (await tableExists("school")) {
    try {
      await prisma.school.create({ data: { name: "Escola Modelo" } });
    } catch (err) {
      console.warn("Não foi possível criar registro default em school (tabela divergente?)", err);
    }
  }

  if (await tableExists("monitoring_settings")) {
    try {
      await prisma.monitoringSettings.create({
        data: {
          tempMin: "20.00",
          tempMax: "28.00",
          humMin: "40.00",
          humMax: "70.00",
          telemetryIntervalSeconds: 60,
          unlockDurationSeconds: 5,
          allowOnlyActiveStudents: true,
        },
      });
    } catch (err) {
      console.warn("Não foi possível criar monitoramento default", err);
    }
  }

  if (await tableExists("rooms")) {
    try {
      const sampleRoom = await prisma.room.create({
        data: { name: "Sala 101", location: "Bloco A", isActive: true },
      });

      if (await tableExists("devices")) {
        await prisma.device.create({
          data: {
            name: "Sensor Sala 101",
            type: "SALA",
            roomId: sampleRoom.id,
            isActive: true,
            token: "dev-sala-101-token",
          },
        });
        await prisma.device.create({
          data: {
            name: "Portaria Principal",
            type: "PORTARIA",
            roomId: null,
            isActive: true,
            token: "dev-portaria-principal-token",
          },
        });
      }
    } catch (err) {
      console.warn("Não foi possível criar seed inicial de monitoramento", err);
    }
  }

  const permissions = await Promise.all(
    permissionDefinitions.map(({ code, description }) =>
      prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      })
    )
  );

  const permissionMap = new Map(permissions.map((p) => [p.code, p.id]));

  for (const group of seedGroups) {
    const groupRecord = await prisma.userGroup.upsert({
      where: { name: group.name },
      update: { description: group.description },
      create: { name: group.name, description: group.description },
    });

    await prisma.groupPermission.deleteMany({ where: { groupId: groupRecord.id } });

    for (const code of group.permissions) {
      const permissionId = permissionMap.get(code);
      if (!permissionId) continue;
      await prisma.groupPermission.create({
        data: { groupId: groupRecord.id, permissionId },
      });
    }
  }

  const adminGroup = await prisma.userGroup.findUniqueOrThrow({ where: { name: "Admin" } });
  const passwordHash = await hashPassword(adminPassword);
  const adminCpf = (process.env.SEED_ADMIN_CPF || "00000000000").replace(/\D/g, "").padEnd(11, "0");
  const masterGroup = await prisma.userGroup.findUniqueOrThrow({ where: { name: "Master" } });
  const masterHash = await hashPassword(masterPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      groupId: adminGroup.id,
      passwordHash,
      cpf: adminCpf,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      groupId: adminGroup.id,
      passwordHash,
      cpf: adminCpf,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: masterEmail },
    update: {
      name: masterName,
      groupId: masterGroup.id,
      passwordHash: masterHash,
      cpf: "88888888888",
      isActive: true,
    },
    create: {
      email: masterEmail,
      name: masterName,
      groupId: masterGroup.id,
      passwordHash: masterHash,
      cpf: "88888888888",
      isActive: true,
    },
  });

  return { success: true };
}
