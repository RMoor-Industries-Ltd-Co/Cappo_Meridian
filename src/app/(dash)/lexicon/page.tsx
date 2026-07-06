import { getLexiconEntries } from "@/lib/lexiconSync";
import { LexiconClient } from "./LexiconClient";

export const dynamic = "force-dynamic";

export default async function LexiconPage() {
  const { terms } = await getLexiconEntries();
  return <LexiconClient terms={terms} />;
}
