import { Card } from "@/components/ui/Card";
import { listPrompts } from "@/lib/grantops/store";
import { PromptCard } from "@/components/grantops/PromptCard";

export const dynamic = "force-dynamic";

export default function PromptsPage() {
  const prompts = listPrompts();
  return (
    <div className="flex flex-col gap-4">
      <Card gold className="p-5">
        <p className="text-sm text-muted">
          Ready-to-use prompts for ALLIE (research, eligibility, drafting, scoring) and CAPPO
          (governance review). Each is written to preserve GrantOps&rsquo; rules: never assume eligibility,
          mark unknowns as &ldquo;verify&rdquo;, flag loans/equity/nonprofit-only, and treat every draft as a
          human-reviewed, human-submitted artifact. Copy one into the AI workspace to run it.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {prompts.map((p) => (
          <PromptCard key={p.id} prompt={p} />
        ))}
      </div>
    </div>
  );
}
