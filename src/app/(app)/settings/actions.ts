"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";
import { parsePrismaError } from "@/lib/action-utils";
import {
  BASE_GROUP_DEFINITIONS,
  BASE_PERMISSION_DEFINITIONS,
  DEMO_MONITORING_DEVICES,
  DEMO_MONITORING_ROOM,
  getSeedIdentityConfig,
  MONITORING_DEFAULTS,
  SCHOOL_DEFAULT,
  SCHOOL_DEMO_DEFAULT,
} from "@/lib/bootstrap-data";
import { generateDeviceToken } from "@/lib/monitoring";

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

type DbClient = Prisma.TransactionClient | typeof prisma;

async function upsertPermissionsAndGroups(db: DbClient = prisma) {
  const permissions = await Promise.all(
    BASE_PERMISSION_DEFINITIONS.map(({ code, description }) =>
      db.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      })
    )
  );

  const permissionMap = new Map(permissions.map((permission) => [permission.code, permission.id]));
  const groupRecords = new Map<string, number>();

  for (const group of BASE_GROUP_DEFINITIONS) {
    const groupRecord = await db.userGroup.upsert({
      where: { name: group.name },
      update: { description: group.description },
      create: { name: group.name, description: group.description },
    });

    groupRecords.set(group.name, groupRecord.id);
    await db.groupPermission.deleteMany({ where: { groupId: groupRecord.id } });

    const groupPermissions = group.permissions
      .map((code) => permissionMap.get(code))
      .filter((permissionId): permissionId is number => typeof permissionId === "number")
      .map((permissionId) => ({
        groupId: groupRecord.id,
        permissionId,
      }));

    if (groupPermissions.length === 0) continue;

    await db.groupPermission.createMany({
      data: groupPermissions,
      skipDuplicates: true,
    });
  }

  return { groupRecords };
}

async function upsertMonitoringDefaults(db: DbClient = prisma) {
  const currentSettings = await db.monitoringSettings.findFirst({ select: { id: true } });
  if (currentSettings) {
    await db.monitoringSettings.update({
      where: { id: currentSettings.id },
      data: MONITORING_DEFAULTS,
    });
    return;
  }
  await db.monitoringSettings.create({ data: MONITORING_DEFAULTS });
}

async function upsertMonitoringDemoInfra(db: DbClient = prisma) {
  let sampleRoom = await db.room.findFirst({ where: { name: DEMO_MONITORING_ROOM.name } });
  if (!sampleRoom) {
    sampleRoom = await db.room.create({
      data: { ...DEMO_MONITORING_ROOM, isActive: true },
    });
  }

  for (const device of DEMO_MONITORING_DEVICES) {
    const existing = await db.device.findFirst({
      where: { name: device.name, type: device.type },
      select: { id: true },
    });

    if (existing) {
      await db.device.update({
        where: { id: existing.id },
        data: {
          name: device.name,
          type: device.type,
          roomId: device.roomRequired ? sampleRoom.id : null,
          isActive: true,
        },
      });
      continue;
    }

    await db.device.create({
      data: {
        name: device.name,
        type: device.type,
        roomId: device.roomRequired ? sampleRoom.id : null,
        isActive: true,
        token: generateDeviceToken(),
      },
    });
  }
}

export async function populateDemoData() {
  await requirePermission("settings.write");

  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "Demo@123456";
  const demoHash = await hashPassword(demoPassword);

  // 1) Permissões e grupos
  const { groupRecords } = await upsertPermissionsAndGroups();

  // 2) Escola
  try {
    await prisma.school.upsert({
      where: { id: 1 },
      update: SCHOOL_DEMO_DEFAULT,
      create: SCHOOL_DEMO_DEFAULT,
    });
  } catch (err) {
    console.warn("Tabela school indisponível para popular", err);
  }

  // 2.1) Monitoramento (singleton + sala/device de exemplo)
  await upsertMonitoringDefaults();
  await upsertMonitoringDemoInfra();

  // 3) Usuários secretaria (2) e professor (5)
  const userPayloads = [
    { name: randomName(), email: "secretaria1@email.com.br", group: "Secretaria" },
    { name: randomName(), email: "secretaria2@email.com.br", group: "Secretaria" },
    { name: randomName(), email: "prof1@email.com.br", group: "Professor" },
    { name: randomName(), email: "prof2@email.com.br", group: "Professor" },
    { name: randomName(), email: "prof3@email.com.br", group: "Professor" },
    { name: randomName(), email: "prof4@email.com.br", group: "Professor" },
    { name: randomName(), email: "prof5@email.com.br", group: "Professor" },
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
    const email = `prof.auto.${base + i}@email.com.br`;
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

  let seedConfig: ReturnType<typeof getSeedIdentityConfig>;
  try {
    seedConfig = getSeedIdentityConfig();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao carregar variáveis de seed.",
    };
  }

  const masterHash = await hashPassword(seedConfig.masterPassword);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        TRUNCATE TABLE
          access_events,
          telemetry_readings,
          devices,
          rooms,
          monitoring_settings,
          attendance_records,
          attendance_sessions,
          assessment_scores,
          assessments,
          term_grades,
          teacher_assignments,
          class_subjects,
          enrollments,
          student_guardians,
          teachers,
          students,
          guardians,
          class_groups,
          subjects,
          academic_terms,
          group_permissions,
          users,
          user_groups,
          permissions,
          school
        RESTART IDENTITY CASCADE
      `;

      await tx.school.create({ data: SCHOOL_DEFAULT });
      await tx.monitoringSettings.create({ data: MONITORING_DEFAULTS });

      const sampleRoom = await tx.room.create({
        data: { ...DEMO_MONITORING_ROOM, isActive: true },
      });

      for (const device of DEMO_MONITORING_DEVICES) {
        await tx.device.create({
          data: {
            name: device.name,
            type: device.type,
            roomId: device.roomRequired ? sampleRoom.id : null,
            isActive: true,
            token: generateDeviceToken(),
          },
        });
      }

      const { groupRecords } = await upsertPermissionsAndGroups(tx);

      const masterGroupId = groupRecords.get("Master");
      if (!masterGroupId) {
        throw new Error("Grupo base Master não foi encontrado após reset.");
      }

      await tx.user.upsert({
        where: { email: seedConfig.masterEmail },
        update: {
          name: seedConfig.masterName,
          groupId: masterGroupId,
          passwordHash: masterHash,
          cpf: seedConfig.masterCpf,
          isActive: true,
        },
        create: {
          email: seedConfig.masterEmail,
          name: seedConfig.masterName,
          groupId: masterGroupId,
          passwordHash: masterHash,
          cpf: seedConfig.masterCpf,
          isActive: true,
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      error: parsePrismaError(error, {
        default: "Falha ao resetar banco.",
      }),
    };
  }
}
