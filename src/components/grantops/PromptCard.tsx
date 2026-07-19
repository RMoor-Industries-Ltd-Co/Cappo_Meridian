"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/grantops/badges";
import type { AiPrompt } from "@/lib/grantops/seed";

export function PromptCard({ prompt }: { prompt: AiPrompt }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(prompt.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-fg">{prompt.title}</h3>
          <p className="mt-0.5 text-sm text-subtle">{prompt.description}</p>
        </div>
        <Pill tone="gold">{prompt.category}</Pill>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-panel-2 p-3 text-xs leading-relaxed text-muted">
        {prompt.prompt}
      </pre>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 self-start rounded-md border border-gold/40 px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copied" : "Copy prompt"}
      </button>
    </Card>
  );
}
