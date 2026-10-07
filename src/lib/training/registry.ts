import type { ComponentType } from "react";
import type { LexiconEntry } from "@/lib/lexicon-data";

export type TrainingMode = "Quick Quiz" | "Lexicon-Lingo Match" | "Lingo in Conversation" | "Master's Game";

/** Whether a registered game can actually be launched right now. */
export type TrainingGameStatus = "playable" | "preview" | "locked";

export interface TrainingGameProps {
  terms: LexiconEntry[];
  founder: "Founder 55" | "Founder 88";
  categories: string[];
  onExit: () => void;
}

export interface TrainingGameDef {
  mode: TrainingMode;
  title: string;
  description: string;
  status: TrainingGameStatus;
  /** One-line reason shown under a preview/locked card instead of a launch button. */
  statusNote?: string;
  minTerms: number;
  component: ComponentType<TrainingGameProps>;
}

/**
 * The game registry. Adding a new Lexicon-Lingo game means adding one entry
 * here — the Training start screen renders cards from this list and never
 * needs to be redesigned for a new mode.
 */
const registry: TrainingGameDef[] = [];

export function registerTrainingGame(def: TrainingGameDef): void {
  const existingIndex = registry.findIndex((entry) => entry.mode === def.mode);
  if (existingIndex >= 0) registry[existingIndex] = def;
  else registry.push(def);
}

export function listTrainingGames(): TrainingGameDef[] {
  return registry;
}

export function getTrainingGame(mode: TrainingMode): TrainingGameDef | undefined {
  return registry.find((entry) => entry.mode === mode);
}
