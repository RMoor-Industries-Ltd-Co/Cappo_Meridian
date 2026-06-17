import { BookOpen } from "lucide-react";

export default function LexiconPage() {
  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-panel text-gold">
        <BookOpen size={26} strokeWidth={1.5} />
      </div>
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-fg">Lexicon</h1>
        <p className="mt-2 text-sm text-subtle">
          The AMG knowledge base — terms, frameworks, playbooks, and operating definitions.
          Coming soon.
        </p>
      </div>
    </div>
  );
}
