import { registerTrainingGame } from "@/lib/training/registry";
import { QuickQuiz } from "./games/QuickQuiz";
import { LexiconLingoMatch } from "./games/LexiconLingoMatch";
import { LingoInConversation } from "./games/LingoInConversation";
import { MastersGame } from "./games/MastersGame";

/**
 * Registers every known Lexicon-Lingo game. Import this module once (from
 * TrainingQuiz.tsx) before the registry is read — adding a new game means
 * adding one more `registerTrainingGame` call here, not touching the start
 * screen or the mode-dispatch logic.
 */
registerTrainingGame({
  mode: "Quick Quiz",
  title: "Quick Quiz",
  description: "Test definitions, distinctions, and usage.",
  status: "playable",
  minTerms: 4,
  component: QuickQuiz,
});

registerTrainingGame({
  mode: "Lexicon-Lingo Match",
  title: "Lexicon-Lingo Match",
  description: "Match HVN language to its real-world meaning before your time runs out.",
  status: "playable",
  minTerms: 5,
  component: LexiconLingoMatch,
});

registerTrainingGame({
  mode: "Lingo in Conversation",
  title: "Lingo in Conversation",
  description: "Practice using Lexicon terms naturally in real conversation.",
  status: "playable",
  minTerms: 1,
  component: LingoInConversation,
});

registerTrainingGame({
  mode: "Master's Game",
  title: "Master's Game",
  description: "Combine Lexicon-Lingo skills across five Master rounds.",
  status: "preview",
  statusNote: "Early build — timing contract under test. Full experience lands after Match and Conversation are stable.",
  minTerms: 6,
  component: MastersGame,
});
