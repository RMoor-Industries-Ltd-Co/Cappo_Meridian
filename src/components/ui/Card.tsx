import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  gold = false,
}: {
  children: ReactNode;
  className?: string;
  gold?: boolean;
}) {
  return (
    <div className={`panel ${gold ? "panel-gold" : ""} ${className}`}>{children}</div>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
        {title}
      </h2>
      {action}
    </div>
  );
}
