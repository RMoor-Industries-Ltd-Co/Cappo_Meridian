# Lexicon-Lingo Training Platform

Supersedes the original `docs/lexicon-training-v2.md` (PR #64's first draft). The
mechanics below reconcile that draft against the Founder-approved Lexicon-Lingo
specification — see the PR description for exactly what changed.

## Architecture

- **Game registry** (`src/lib/training/registry.ts`): each game is one
  `registerTrainingGame` call (`src/components/training/registerGames.ts`) with a
  `status` of `playable`, `preview`, or `locked`. The Training start screen
  (`TrainingQuiz.tsx`) renders entirely from the registry — adding a future game
  never requires touching the start screen or the mode-dispatch logic.
- **Config** (`src/lib/training/config.ts`): every tunable constant (clock
  ladder, pair-count ladder, mismatch penalty, XP values) lives here, not
  scattered through components.
- **Bonus Bank engine** (`src/lib/training/roundClock.ts` + the
  `useRoundClock` hook): a pure, framework-free reducer shared by Lexicon-Lingo
  Match and the Master's Game, so both games' Bonus Bank behavior is the same
  code path, directly unit-testable.
- Controlled content: the Training page still consumes only the synchronized
  Cappo Lexicon. It cannot create, edit, or publish terms — `POST
  /api/training/suggest` and the "Add a Term" UI remain removed (PR #64's
  governance change; nothing in the current repo gave a reason to restore
  them).

## Lexicon-Lingo Match — endless endurance game

Reworked from PR #64's fixed 10-round Term Match.

- **No final round.** Play continues until both clocks below are exhausted.
- **Base-time ladder:** 5:00 → 4:00 → 3:00 → 2:00 → 1:00, then holds at 1:00
  forever (`BASE_SECONDS_LADDER`).
- **Bonus Bank:** unused base time from a round cleared early rolls into a
  shared bank that carries across every subsequent round. The bank is spent
  only once the *current* round's own base time reaches zero — base time
  never goes to waste, and the bank never "double-earns" from time it's
  itself being spent from.
- **Mismatch penalty:** a wrong match costs 3 seconds (`MATCH_MISMATCH_PENALTY_SECONDS`)
  off whichever clock is currently active.
- **Pair-count ladder:** 5, 5, 6, 6, 7, 8, then holds at 8.
- **Difficulty keeps climbing past Round 10:** rounds 1-5 draw from the
  "easy" half of the pool (shorter term + plain-meaning pairs), rounds 6-10
  from the "creative" half, and Round 11 onward (`MATCH_CONFUSABLE_ROUND`)
  prefers clustering pairs from the *same* Lexicon category — e.g. several
  Ember Line variants at once — so the board stays hard by being genuinely
  confusable, not just faster.
- **Personal best:** "Highest Round Reached" persists per founder via
  `training_personal_bests` (Postgres; gracefully no-ops with no `DATABASE_URL`
  configured, same convention as the rest of `lib/db.ts`).

## Lingo in Conversation — untimed by default

Replaces PR #64's timed, Bonus-Bank-ladder "Sentence Completion."

- **Not timed.** Difficulty is expressed through blank count and distractor
  count as the session progresses (`CONVERSATION_BLANKS_BY_DIFFICULTY`,
  `CONVERSATION_DISTRACTORS_BY_DIFFICULTY`), not a clock.
- **Curated sentence corpus** (`src/lib/training/sentenceCorpus.ts`): the
  `LexiconSentenceExample` contract supports `short` / `conversation` /
  `sales` / `compound` / `real-world-replacement` kinds, each tagged
  `approved: true | false`. A small hand-written `CURATED_SENTENCES` seed set
  (approved, grounded only in terms already in `lexicon-data.ts`) is included
  as a worked example — expanding real curated coverage is explicit deferred
  work, not claimed as complete here.
- PR #64's original sentence-generation logic is preserved, not deleted — it
  now produces `approved: false` *candidate* sentences that fill in for any
  selected term the curated set doesn't cover yet, so Conversation always has
  something to play even before every term has a hand-written example.
  Curated content is always preferred over a generated candidate when both
  exist.
- Only a single fill-in-the-blank mechanic is implemented across all five
  `kind`s for now (not five distinct exercise UIs) — a deliberate
  simplification, called out as such rather than built and left unmentioned.

## Master's Game — early/preview build

Reworked per Founder direction, but intentionally **not** the full experience
yet (status: `preview` in the registry, labeled "Early build" in the UI).

- **5 fixed rounds, one shared Bonus Bank**, using the same
  `BASE_SECONDS_LADDER` as Match: Round 1 is always a bounded (6-pair) Match
  round; Rounds 2-5 are recognition quizzes for now. Any round's unused base
  time banks forward for the rest of the run — not just Match's, generalizing
  PR #64's Match-only-adds-bonus model.
- Content per round (which exercises appear) is expected to change once Match
  and Conversation are both stable; the timing/bank *contract* is the part
  that's considered final at this stage.

## Score reporting

`POST /api/training/score` validates `mode` against the current four modes
(`Quick Quiz`, `Lexicon-Lingo Match`, `Lingo in Conversation`, `Master's
Game`) plus bounded numeric fields before sending the founder report email —
unchanged governance posture from PR #64.

## Review checklist

- Confirm curated sentence examples match HVN brand voice before marking more
  of them `approved: true`.
- Keyboard and visible-focus pass (buttons already keyboard-operable; verify
  focus rings read clearly against the panel background).
- Mobile pass for long multi-word Lexicon terms in Match's two-column layout.
- Score-report delivery test for all four modes.
- CI green.
