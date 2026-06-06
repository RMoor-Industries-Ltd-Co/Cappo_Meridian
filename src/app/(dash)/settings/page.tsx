import { Settings as SettingsIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getAllStatuses } from "@/lib/connectors";
import type { ConnectorStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function StatusDot({ s }: { s: ConnectorStatus }) {
  const [color, label] = s.connected
    ? ["bg-pos", "Connected"]
    : s.configured
      ? ["bg-gold", "Action needed"]
      : ["bg-subtle", "Not configured"];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google } = await searchParams;
  const statuses = await getAllStatuses();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <SettingsIcon size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-fg">Settings · Integrations</h1>
          <p className="text-sm text-subtle">
            Connect the AMG toolset that powers Cappo Meridian.
          </p>
        </div>
      </div>

      {google === "connected" && (
        <Card className="border-pos/30 bg-pos/5 px-4 py-3 text-sm text-fg">
          ✓ Google account connected.
        </Card>
      )}
      {google && google !== "connected" && (
        <Card className="border-neg/30 bg-neg/5 px-4 py-3 text-sm text-fg">
          Google authorization failed ({google}). Try again.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statuses.map((s) => {
          const isGoogle = s.id === "drive" || s.id === "gmail";
          return (
            <Card key={s.id} gold className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-fg">{s.name}</h3>
                <StatusDot s={s} />
              </div>
              <p className="min-h-[2.5rem] text-sm text-subtle">
                {s.error ?? s.detail ?? "—"}
              </p>
              {isGoogle && s.configured && !s.connected && (
                <a
                  href="/api/connectors/google/authorize"
                  className="text-sm font-medium text-gold hover:underline"
                >
                  Connect Google →
                </a>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-5 text-sm text-subtle">
        Credentials are read from <code className="text-muted">.env.local</code>. See the
        project README for setup steps for ClickUp, Notion, and Google OAuth.
      </Card>
    </div>
  );
}
