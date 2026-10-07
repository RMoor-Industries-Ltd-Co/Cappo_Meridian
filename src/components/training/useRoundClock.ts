"use client";

import { useEffect, useState } from "react";
import {
  activeSeconds,
  applyPenalty,
  completeRound,
  initRoundClock,
  tickRoundClock,
  totalSeconds,
  type BaseSecondsForRound,
  type RoundClockState,
} from "@/lib/training/roundClock";

/**
 * Thin React wrapper around the pure Bonus Bank round-clock engine
 * (`lib/training/roundClock.ts`). Ticks once a second while `active` is true;
 * stops itself once the engine reports `ended`.
 */
export function useRoundClock(baseSecondsForRound: BaseSecondsForRound, active: boolean) {
  const [state, setState] = useState<RoundClockState>(() => initRoundClock(baseSecondsForRound));
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!active || state.ended) return;
    const interval = window.setInterval(() => {
      setState((current) => tickRoundClock(current));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [active, state.ended]);

  return {
    state,
    reducedMotion,
    activeSeconds: activeSeconds(state),
    totalSeconds: totalSeconds(state),
    penalize: (seconds: number) => setState((current) => applyPenalty(current, seconds)),
    completeRoundNow: () => setState((current) => completeRound(current, baseSecondsForRound)),
    reset: () => setState(initRoundClock(baseSecondsForRound)),
  };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  return reduced;
}
