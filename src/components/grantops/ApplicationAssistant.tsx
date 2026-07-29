"use client";

import { useFormStatus } from "react-dom";
import { ExternalLink, Sparkles, Trash2, Upload } from "lucide-react";
import {
  analyzeApplicationScreenshotAction,
  draftKnownQuestionsAction,
  removeApplicationPageAction,
  updateApplicationAnswerAction,
} from "@/lib/grantops/actions";
import type { ApplicationPage } from "@/lib/grantops/types";

const field =
  "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg focus:border-gold/50 focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-subtle";

/** Submit button that reflects the enclosing form's pending state. */
function PendingButton({
  idle,
  pending,
  icon,
  className,
}: {
  idle: string;
  pending: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className={className ?? "inline-flex items-center gap-1.5 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"}
    >
      {icon}
      {status.pending ? pending : idle}
    </button>
  );
}

function AnswerEditor({ appId, pageId, q }: { appId: string; pageId: string; q: ApplicationPage["questions"][number] }) {
  return (
    <form action={updateApplicationAnswerAction} className="flex flex-col gap-2 rounded-md border border-border bg-panel-2 p-3">
      <input type="hidden" name="id" value={appId} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="questionId" value={q.id} />
      <div className="text-sm font-medium text-fg">{q.question}</div>
      <textarea name="answer" rows={4} defaultValue={q.answer} className={field} placeholder="Cappo's draft answer — edit freely…" />
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-subtle">
          <input type="checkbox" name="approved" defaultChecked={q.approved} className="accent-[var(--gold)]" />
          Founder-approved
        </label>
        <PendingButton
          idle="Save answer"
          pending="Saving…"
          className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-subtle hover:border-gold/50 hover:text-gold disabled:opacity-60"
        />
      </div>
    </form>
  );
}

export function ApplicationAssistant({
  appId,
  aiOn,
  hasKnownQuestions,
  pages,
}: {
  appId: string;
  aiOn: boolean;
  hasKnownQuestions: boolean;
  pages: ApplicationPage[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-subtle">
        Upload a screenshot of each grant-application page and press <strong>Analyze</strong>. Cappo reads the page,
        pulls out every question, and drafts an answer using this entity&rsquo;s knowledge folder and your
        previously-submitted copy — governed by this grant&rsquo;s details. Every answer is a draft for a founder to
        review; nothing is ever submitted here.
      </p>

      {!aiOn && (
        <div className="rounded-md border border-border bg-panel-2 px-3 py-2 text-xs text-subtle">
          Connect an AI provider (Settings → Integrations) to enable screenshot analysis and drafting. You can still
          upload screenshots and edit answers manually.
        </div>
      )}

      {/* Upload + analyze one page */}
      <form action={analyzeApplicationScreenshotAction} className="flex flex-col gap-3 rounded-md border border-border bg-panel p-4">
        <input type="hidden" name="id" value={appId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={labelCls}>Screenshot of an application page (PNG/JPG/WebP)</label>
            <input
              type="file"
              name="screenshot"
              accept="image/png,image/jpeg,image/webp,image/gif"
              required
              className="block w-full text-sm text-subtle file:mr-3 file:rounded-md file:border file:border-gold/50 file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gold hover:file:bg-gold/10"
            />
          </div>
          <div>
            <label className={labelCls}>Page label (optional)</label>
            <input name="label" className={field} placeholder="e.g. About your business" />
          </div>
        </div>
        <PendingButton
          idle="Analyze this page"
          pending="Analyzing screenshot…"
          icon={<Upload size={13} />}
          className="btn-gold inline-flex items-center gap-1.5 self-start rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        />
      </form>

      {/* Draft known questions ahead of time */}
      {hasKnownQuestions && (
        <form action={draftKnownQuestionsAction} className="flex items-center justify-between gap-3 rounded-md border border-border bg-panel-2 px-3 py-2">
          <p className="text-xs text-subtle">
            This grant has known questions on file. Cappo can draft answers to them now, before you even open the portal.
          </p>
          <PendingButton idle="Draft known questions" pending="Drafting…" icon={<Sparkles size={13} />} />
        </form>
      )}

      {/* Analyzed pages */}
      {pages.length === 0 ? (
        <p className="text-sm text-subtle">No pages yet. Upload a screenshot above to begin.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pages
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((page) => (
              <div key={page.id} className="flex flex-col gap-3 rounded-lg border border-border-strong bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">Page {page.index}</span>
                    <span className="text-sm font-medium text-fg">
                      {page.label || (page.source === "known_questions" ? "Known questions" : "Application page")}
                    </span>
                    {page.screenshotUrl && (
                      <a href={page.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
                        screenshot <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <form action={removeApplicationPageAction}>
                    <input type="hidden" name="id" value={appId} />
                    <input type="hidden" name="pageId" value={page.id} />
                    <button className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-subtle hover:border-red-500/50 hover:text-red-400">
                      <Trash2 size={11} /> Remove
                    </button>
                  </form>
                </div>
                {page.questions.length === 0 ? (
                  <p className="text-xs text-subtle">
                    No questions were extracted from this page. {aiOn ? "Try a clearer screenshot." : "Connect AI to analyze it."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {page.questions.map((q) => (
                      <AnswerEditor key={q.id} appId={appId} pageId={page.id} q={q} />
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
