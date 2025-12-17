import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/prisma";
import { hasPermission, requireUser } from "@/lib/rbac";
import { formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Users,
  GraduationCap,
  ClipboardList,
  UserRound,
  Layers,
  Notebook,
  School,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr);

  const [
    students,
    guardians,
    classGroups,
    enrollments,
    activeStudents,
    activeClassGroups,
    teachers,
    assessmentsCount,
    sessionsToday,
    recentStudents,
    recentGuardians,
    recentEnrollments,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.guardian.count(),
    prisma.classGroup.count(),
    prisma.enrollment.count(),
    prisma.student.count({ where: { isActive: true } }),
    prisma.classGroup.count({ where: { isActive: true } }),
    prisma.teacher.count({ where: { isActive: true } }),
    prisma.assessment.count(),
    prisma.attendanceSession.count({ where: { sessionDate: todayDate } }),
    prisma.student.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, registrationNumber: true, createdAt: true },
    }),
    prisma.guardian.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, phone: true, createdAt: true },
    }),
    prisma.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        student: { select: { name: true } },
        classGroup: { select: { name: true, schoolYear: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Alunos", value: students, sub: `${activeStudents} ativos`, icon: UserRound },
    { label: "Responsáveis", value: guardians, sub: "cadastros", icon: Users },
    { label: "Turmas", value: classGroups, sub: `${activeClassGroups} ativas`, icon: School },
    { label: "Matrículas", value: enrollments, sub: "totais", icon: Notebook },
  ];

  const secondary = [
    { label: "Professores", value: teachers },
    { label: "Avaliações", value: assessmentsCount },
    { label: "Frequência (hoje)", value: sessionsToday },
  ];

  const shortcuts = [
    { label: "Alunos", href: "/students", perm: "students.read" },
    { label: "Responsáveis", href: "/guardians", perm: "guardians.read" },
    { label: "Turmas", href: "/class-groups", perm: "class_groups.read" },
    { label: "Disciplinas", href: "/subjects", perm: "subjects.read" },
    { label: "Matrículas", href: "/enrollments", perm: "enrollments.read" },
    { label: "Frequência", href: "/attendance", perm: "attendance.read" },
  ].filter((item) => !item.perm || hasPermission(user, item.perm));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">Grupo: {user.group.name}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Hoje</Badge>
          <span>{formatDate(todayDate)}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background"
            >
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardDescription>{item.label}</CardDescription>
                  <span className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <CardTitle className="text-3xl font-semibold">{item.value}</CardTitle>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Novos cadastros
            </CardTitle>
            <CardDescription>Alunos e responsáveis mais recentes</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Alunos</p>
              <div className="space-y-2">
                {recentStudents.map((s) => (
                  <div key={s.id} className="rounded border bg-muted/20 px-3 py-2">
                    <div className="font-semibold">{s.name}</div>
                    <p className="text-xs text-muted-foreground">
                      Matrícula: {s.registrationNumber ?? "—"} • Criado em {formatDate(s.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Responsáveis</p>
              <div className="space-y-2">
                {recentGuardians.map((g) => (
                  <div key={g.id} className="rounded border bg-muted/20 px-3 py-2">
                    <div className="font-semibold">{g.name}</div>
                    <p className="text-xs text-muted-foreground">
                      Tel: {g.phone ?? "—"} • Criado em {formatDate(g.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              Resumo acadêmico
            </CardTitle>
            <CardDescription>Professores, avaliações e sessões de frequência.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {secondary.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded border bg-muted/10 px-3 py-2">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-lg font-semibold">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Matrículas recentes
          </CardTitle>
          <CardDescription>Últimas enturmações registradas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentEnrollments.map((enr) => (
            <div
              key={enr.id}
              className="flex items-center justify-between rounded border bg-muted/20 px-3 py-2 text-sm"
            >
              <div>
                <div className="font-semibold">{enr.student.name}</div>
                <p className="text-xs text-muted-foreground">
                  Turma {enr.classGroup.schoolYear} — {enr.classGroup.name} • Criada em{" "}
                  {formatDate(enr.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {shortcuts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Atalhos</CardTitle>
            <CardDescription>Navegue rapidamente pelos módulos principais</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {shortcuts.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="outline"
                className="justify-between"
              >
                <a href={item.href}>
                  {item.label}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
