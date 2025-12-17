"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  Columns3,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Layers3,
  Medal,
  NotebookPen,
  ShieldCheck,
  Users,
  UsersRound,
  UserCog,
  UserCircle2,
} from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "students"
    | "guardians"
    | "class_groups"
    | "subjects"
    | "enrollments"
    | "teachers"
    | "class_subjects"
    | "teacher_assignments"
    | "academic_terms"
    | "attendance"
    | "assessments"
    | "term_grades"
    | "users"
    | "groups"
    | "permissions";
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

type NavLinksProps = {
  sections: NavSection[];
  onNavigate?: () => void;
  closeOnNavigate?: boolean;
};

const iconMap: Record<NavItem["icon"], React.ComponentType<{ className?: string }>> =
  {
    dashboard: LayoutDashboard,
    students: GraduationCap,
    guardians: Users,
    class_groups: Columns3,
    subjects: BookOpen,
    enrollments: ClipboardList,
    teachers: UserCog,
    class_subjects: Layers3,
    teacher_assignments: ShieldCheck,
    academic_terms: CalendarRange,
    attendance: CalendarCheck,
    assessments: NotebookPen,
    term_grades: Medal,
    users: UserCircle2,
    groups: UsersRound,
    permissions: KeyRound,
  };

export function NavLinks({ sections, onNavigate, closeOnNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((s) => [
        s.title,
        s.title === "Geral" || s.title.toLowerCase().includes("acadêmico"),
      ])
    )
  );

  const toggleSection = (title: string) =>
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const isOpen = openSections[section.title];
        return (
          <div key={section.title} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-muted"
            >
              <span>{section.title}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </button>
            {isOpen ? (
              <nav className="flex flex-col gap-1 pl-2">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = iconMap[item.icon];
                  const link = (
                    <Link
                      href={item.href}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-muted text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );

                  if (closeOnNavigate) {
                    return (
                      <SheetClose asChild key={item.href}>
                        {link}
                      </SheetClose>
                    );
                  }

                  return (
                    <div key={item.href}>
                      {link}
                    </div>
                  );
                })}
              </nav>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
