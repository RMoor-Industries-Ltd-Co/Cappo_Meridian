# Lexicon Training v2

## Controlled content

- The Training page consumes the synchronized Cappo Lexicon only.
- It cannot create, edit, or publish terms.
- The former `POST /api/training/suggest` route is removed.
- Each controlled term receives exactly five deterministic sentence prompts:
  two direct-use prompts and three prompts that incorporate additional Lexicon terms.
- Prompt order is randomized at session start. Difficulty is evaluated separately
  from presentation order using sentence length, answer count, answer complexity,
  and the target term's category.

## Timers

### Term Match

Ten rounds preserve the original learning progression: rounds 1–5 draw from the
easier half of the selected term pool and rounds 6–10 draw from the more creative
half. Every round remains under two minutes.

### Sentence Completion

| Round | Base time |
| --- | ---: |
| 1 | 5:00 |
| 2 | 4:00 |
| 3 | 3:00 |
| 4 | 2:00 |
| 5 | Bonus Bank only |

Unused base time is deposited into a visible Bonus Bank. When a base clock
expires, the bank is consumed automatically. Time already withdrawn from the
bank is never deposited again. Assessment results may adjust rounds 2–4 by no
more than 30 seconds: fast, accurate work tightens the next round; a miss or
near-timeout adds recovery time.

### Master Quiz

The Master Quiz is one five-round mixed assessment with an initial 5:00 session
clock. Term Match is always round 1. It is the only round that can add time:
10 seconds per correct pair, capped at 60 seconds. Later rounds only consume the
shared clock.

## Validation

Score submissions now accept only the two founder identifiers, known quiz modes,
bounded numeric values, ISO timestamps, and non-empty category selections.
Client-supplied values are validated before any report email is sent.

## Review checklist

- Verify keyboard operation and visible focus for all cards and answer controls.
- Verify narrow/mobile layouts for long multi-word Lexicon terms.
- Confirm the 10-second matching bonus and 60-second cap before promotion.
- Review generated contextual sentences for brand voice; the evaluator measures
  challenge, not editorial quality.
- Confirm reports arrive with the mode and timer metrics included.
