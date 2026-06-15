import Link from "next/link";
import { Scale, FileText, ChevronRight } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";
import { Card, SectionTitle } from "@/components/ui/Card";
import { getLegalDocsByEntity, isNotConnected, type LegalGroup } from "@/lib/connectors/driveFs";

export const dynamic = "force-dynamic";

export default async function LegalPage() {
  let groups: LegalGroup[] = [];
  let notConnected = false;
  try {
    groups = await getLegalDocsByEntity();
  } catch (err) {
    if (isNotConnected(err)) notConnected = true;
  }
  const withDocs = groups.filter((g) => g.docs.length > 0);
  const total = withDocs.reduce((n, g) => n + g.docs.length, 0);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Card className="p-5">
        <SectionTitle
          title="Legal Documents"
          action={<span className="text-xs text-subtle">{total} finalized · from Drive</span>}
        />
        {notConnected ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted">Connect Google Drive to surface finalized legal documents.</p>
            <Link href="/settings" className="text-sm text-gold hover:underline">
              Connect →
            </Link>
          </div>
        ) : total === 0 ? (
          <p className="py-8 text-center text-sm text-subtle">
            No finalized legal documents found in Drive yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {withDocs.map((g) => (
              <details
                key={g.key}
                open
                className="group rounded-lg border border-border bg-bg/40 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-fg hover:text-gold">
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-subtle transition-transform group-open:rotate-90"
                  />
                  <span className="truncate">{g.label}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs text-gold">
                    {g.docs.length}
                  </span>
                </summary>
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {g.docs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 px-3 py-2.5 pl-9 text-sm">
                      <FileText size={14} className="shrink-0 text-subtle" />
                      <a
                        href={d.webViewLink ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-fg hover:text-gold"
                      >
                        {d.name}
                      </a>
                      {d.modifiedTime && (
                        <span className="ml-auto shrink-0 text-xs text-subtle">
                          {new Date(d.modifiedTime).toLocaleDateString("en-US")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </Card>

      <DomainModule
        domain="Legal"
        blurb="Contracts, IP, and compliance — ClickUp #legal + Notion records."
        icon={<Scale size={22} strokeWidth={1.75} />}
      />
    </div>
  );
}
