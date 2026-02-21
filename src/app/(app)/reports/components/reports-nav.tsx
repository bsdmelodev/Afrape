"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type ReportsNavLink = {
  href: string;
  label: string;
};

type ReportsNavProps = {
  links: ReportsNavLink[];
};

export function ReportsNav({ links }: ReportsNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-muted"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
