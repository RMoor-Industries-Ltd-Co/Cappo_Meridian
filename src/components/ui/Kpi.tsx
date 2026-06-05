import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./Card";

export function Kpi({
  label,
  value,
  delta,
  period = "This month",
}: {
  label: string;
  value: string;
  delta?: number;
  period?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <span className="text-xs uppercase tracking-wide text-subtle">{label}</span>
      <span className="text-3xl font-semibold text-fg">{value}</span>
      <div className="flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${
              positive ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"
            }`}
          >
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
        <span className="text-xs text-subtle">{period}</span>
      </div>
    </Card>
  );
}
