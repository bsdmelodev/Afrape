import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Menu } from "lucide-react";
import { hasPermission } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/current-user";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { NavLinks, type NavItem } from "@/components/app/nav-links";
import { UserMenu } from "@/components/app/user-menu";
import { prisma } from "@/lib/prisma";

async function getSchoolSafe() {
  try {
    const exists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      "select exists (select 1 from information_schema.tables where table_name = 'school')"
    );
    if (!exists[0]?.exists) return null;
    try {
      return await prisma.school.findFirst({ select: { name: true, logoUrl: true } });
    } catch (err) {
      console.warn("Falha ao consultar school; execute prisma/sql/school.sql", err);
      return null;
    }
  } catch (error) {
    console.warn("Tabela school não disponível", error);
    return null;
  }
}

type NavEntry = { label: string; href: string; icon: NavItem["icon"]; permission?: string };
const navSections: { title: string; items: NavEntry[] }[] = [
  {
    title: "Geral",
    items: [{ label: "Dashboard", href: "/dashboard", icon: "dashboard" }],
  },
  {
    title: "Acadêmico",
    items: [
      { label: "Alunos", href: "/students", icon: "students", permission: "students.read" },
      { label: "Responsáveis", href: "/guardians", icon: "guardians", permission: "guardians.read" },
      { label: "Turmas", href: "/class-groups", icon: "class_groups", permission: "class_groups.read" },
      { label: "Disciplinas", href: "/subjects", icon: "subjects", permission: "subjects.read" },
      { label: "Matrículas", href: "/enrollments", icon: "enrollments", permission: "enrollments.read" },
      { label: "Professores", href: "/teachers", icon: "teachers", permission: "teachers.read" },
      {
        label: "Turma x Disciplina",
        href: "/class-subjects",
        icon: "class_subjects",
        permission: "class_subjects.read",
      },
      {
        label: "Prof. x Componente",
        href: "/teacher-assignments",
        icon: "teacher_assignments",
        permission: "teacher_assignments.read",
      },
      { label: "Períodos", href: "/academic-terms", icon: "academic_terms", permission: "academic_terms.read" },
      { label: "Frequência", href: "/attendance", icon: "attendance", permission: "attendance.read" },
      { label: "Avaliações", href: "/assessments", icon: "assessments", permission: "assessments.read" },
      { label: "Notas", href: "/assessment-scores", icon: "assessments", permission: "assessments.read" },
      { label: "Fechamento", href: "/term-grades", icon: "term_grades", permission: "term_grades.read" },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { label: "Alunos", href: "/reports/students", icon: "students", permission: "students.read" },
      { label: "Responsáveis", href: "/reports/guardians", icon: "guardians", permission: "guardians.read" },
      { label: "Turmas", href: "/reports/class-groups", icon: "class_groups", permission: "class_groups.read" },
      { label: "Disciplinas", href: "/reports/subjects", icon: "subjects", permission: "subjects.read" },
      { label: "Matrículas", href: "/reports/enrollments", icon: "enrollments", permission: "enrollments.read" },
      { label: "Professores", href: "/reports/teachers", icon: "teachers", permission: "teachers.read" },
    ],
  },
  {
    title: "Monitoramento",
    items: [
      {
        label: "Visão Geral",
        href: "/monitoring/overview",
        icon: "monitoring_overview",
        permission: "monitoring.read",
      },
      {
        label: "Salas",
        href: "/monitoring/rooms",
        icon: "monitoring_rooms",
        permission: "monitoring.read",
      },
      {
        label: "Portarias",
        href: "/monitoring/gateways",
        icon: "monitoring_gateways",
        permission: "monitoring.read",
      },
      {
        label: "Eventos de Acesso (RFID)",
        href: "/monitoring/access-events",
        icon: "monitoring_events",
        permission: "monitoring.read",
      },
      {
        label: "Leituras (Temp/Umid)",
        href: "/monitoring/readings",
        icon: "monitoring_readings",
        permission: "monitoring.read",
      },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Usuários", href: "/users", icon: "users", permission: "users.read" },
      { label: "Grupos", href: "/groups", icon: "groups", permission: "groups.read" },
      { label: "Permissões", href: "/permissions", icon: "permissions", permission: "permissions.read" },
      { label: "Configurações", href: "/settings", icon: "permissions", permission: "settings.read" },
      {
        label: "Config. Monitoramento",
        href: "/settings/monitoring",
        icon: "monitoring_settings",
        permission: "monitoring_settings.write",
      },
      {
        label: "Simulador de Hardware",
        href: "/settings/hardware-simulator",
        icon: "hardware_simulator",
        permission: "hardware_simulator.write",
      },
      { label: "Escola", href: "/school", icon: "permissions", permission: "school.read" },
    ],
  },
];

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const school = await getSchoolSafe();

  const allowedSections = navSections
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter((item) => !item.permission || hasPermission(user, item.permission))
        .map(({ label, href, icon }) => ({
          label,
          href,
          icon: typeof icon === "string" ? icon : "dashboard",
        })),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r bg-background/80 backdrop-blur lg:block">
          <div className="flex h-full flex-col">
            <div className="p-6">
              <Link href="/dashboard" className="flex items-center gap-3 font-semibold leading-tight">
                {school?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={school.logoUrl}
                    alt={school.name}
                    className="h-10 w-10 rounded bg-muted object-cover"
                  />
                ) : null}
                <div>
                  <span className="block text-sm text-muted-foreground">
                    {school?.name ? "Gestão Escolar" : "Gestão"}
                  </span>
                  <span className="text-lg">{school?.name ?? "Escolar"}</span>
                </div>
              </Link>
            </div>
            <div className="flex-1 p-6 pt-0">
              <NavLinks sections={allowedSections} />
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="sticky top-0 z-10 hidden items-center justify-between gap-4 border-b bg-background/80 px-6 py-4 backdrop-blur lg:flex">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Painel
              </p>
              <p className="font-semibold">Gestão Escolar</p>
            </div>
            <UserMenu user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />
          </div>
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Menu principal</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="p-6 pb-4">
                    <p className="text-sm text-muted-foreground">Gestão Escolar</p>
                    <p className="text-lg font-semibold">Menu</p>
                  </div>
                  <Separator />
                  <div className="flex-1 px-6 py-4">
                    <NavLinks sections={allowedSections} closeOnNavigate />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {school?.name ?? "Painel"}
              </p>
              <p className="font-semibold">{school?.name ?? "Gestão Escolar"}</p>
            </div>
            <UserMenu user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} />
          </header>

          <main className="p-6 lg:p-8">{children}</main>
        </div>
      </div>
      <footer className="border-t bg-background/80 px-6 py-4 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Gestão Escolar</span>
            {school?.name ? <span className="text-xs text-muted-foreground">• {school.name}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>Feito com Next.js + Prisma + shadcn/ui</span>
            <span className="text-xs uppercase tracking-[0.15em]">RBAC Ativado</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
