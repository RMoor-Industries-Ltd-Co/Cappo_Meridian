"use client";

import { useState } from "react";
import { beginApplicationAction } from "@/lib/grantops/actions";

/**
 * The confirm-to-proceed gate at the bottom of the pre-application briefing.
 * The "open workspace" button stays disabled until the partner checks that they've
 * read the briefing — the read-first step before any form-filling begins.
 */
export function BriefingGate({ opportunityId }: { opportunityId: string }) {
  const [read, setRead] = useState(false);
  return (
    <form action={beginApplicationAction} className="flex flex-col gap-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <label className="flex items-start gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={read}
          onChange={(e) => setRead(e.target.checked)}
          className="mt-0.5 accent-[var(--gold)]"
        />
        <span>
          I&rsquo;ve read this briefing and understand the fit, requirements, and risks before
          starting the application.
        </span>
      </label>
      <button
        disabled={!read}
        className="btn-gold self-start rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Agree &amp; open application workspace →
      </button>
    </form>
  );
}
