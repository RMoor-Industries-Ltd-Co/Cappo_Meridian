import { TrainingQuiz } from "@/components/training/TrainingQuiz";
import { getLexiconEntries } from "@/lib/lexiconSync";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { terms, categories } = await getLexiconEntries();
  return <TrainingQuiz terms={terms} categories={categories} />;
}
