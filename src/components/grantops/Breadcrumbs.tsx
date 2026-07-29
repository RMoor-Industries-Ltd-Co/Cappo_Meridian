import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

/** GrantOps breadcrumb trail — makes the sub-pages (briefing, workspace) navigable. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-subtle">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-subtle/60" />}
            {c.href && !last ? (
              <Link href={c.href} className="hover:text-fg">{c.label}</Link>
            ) : (
              <span className={last ? "text-fg" : ""}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
