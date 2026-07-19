"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/grantops", label: "Command" },
  { href: "/grantops/opportunities", label: "Opportunities" },
  { href: "/grantops/review", label: "CAPPO Review" },
  { href: "/grantops/applications", label: "Applications" },
  { href: "/grantops/vault", label: "Document Vault" },
  { href: "/grantops/entities", label: "Entities" },
  { href: "/grantops/calendar", label: "Calendar" },
  { href: "/grantops/prompts", label: "AI Prompts" },
];

export function SubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3">
      {TABS.map((t) => {
        const active =
          t.href === "/grantops" ? pathname === "/grantops" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-gold/15 text-gold" : "text-subtle hover:text-fg hover:bg-white/5"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
