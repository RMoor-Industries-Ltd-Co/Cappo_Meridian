/**
 * Curated true/false "usage" questions for the Training quiz's harder tier.
 * These test whether the terminology is used *correctly* (brand claims and
 * commonly-confused pairs), beyond recalling a definition. Each carries an
 * explanation shown after the answer — the teaching moment.
 *
 * `terms` lists the related lexicon term names; a question is only offered when
 * at least one of its terms is in the player's selected pool (empty = always
 * eligible). Grounded in the HVN Lexicon meanings — keep explanations accurate
 * to the current definitions.
 */
export interface UsageTF {
  statement: string;
  answer: "True" | "False";
  explanation: string;
  terms: string[];
}

export const USAGE_TF: UsageTF[] = [
  {
    statement: "Does HVN have stores in the US?",
    answer: "False",
    explanation:
      "HVN doesn't have stores — it has a Havenry, HVN's coined term for a refined commercial destination that replaces “store” or “shop.”",
    terms: ["Havenry", "HVN", "The Havenry"],
  },
  {
    statement: "Is it true that Aure is the term for the ash left from a burned Ember Line?",
    answer: "False",
    explanation:
      "The ash left after an Ember Line burns is Drift. Aure is the smoke the Ember Line releases as it burns — the visible carrier of the Note.",
    terms: ["Aure", "Drift", "Ember Line"],
  },
  {
    statement: "Is Drift the term for the ash left after an Ember Line finishes burning?",
    answer: "True",
    explanation: "Correct — Drift is the ash left behind once an Ember Line has completed its burn.",
    terms: ["Drift", "Ember Line"],
  },
  {
    statement: "Is an Atmos Chamber HVN's term for a candle?",
    answer: "True",
    explanation:
      "Yes — an Atmos Chamber is HVN's candle expression: a flame-lit vessel that carries and releases a Note into a room.",
    terms: ["Atmos Chamber"],
  },
  {
    statement: "Is an Ember Line HVN's term for incense?",
    answer: "True",
    explanation:
      "Correct — the Ember Line is HVN's incense expression, carrying a Note through controlled burn, Aure, and Drift.",
    terms: ["Ember Line"],
  },
  {
    statement: "Is a Sanctum simply HVN's word for an ashtray?",
    answer: "False",
    explanation:
      "Not an ashtray — a Sanctum. It's HVN's elevated ritual object for ash, ember, and smoking, treated as a ceremonial piece rather than disposal.",
    terms: ["Sanctum"],
  },
  {
    statement: "Are Appointments HVN's own proprietary scent products?",
    answer: "False",
    explanation:
      "Appointments are curated non-proprietary objects selected to support the HVN environment — not HVN's proprietary scent products.",
    terms: ["Appointments", "HVN Appointments"],
  },
  {
    statement: "Is Framing Mist a type of candle?",
    answer: "False",
    explanation:
      "Framing Mist is HVN's spray expression — a room, fabric, or body mist that places a Note across a space. The candle is the Atmos Chamber.",
    terms: ["Framing Mist", "Atmos Chamber"],
  },
  {
    statement: "Is a Stem Set HVN's term for a reed diffuser?",
    answer: "True",
    explanation:
      "Yes — Stem Sets are HVN's reed diffuser expression, using a vessel and scent-bearing stems to release a Note over time.",
    terms: ["Stem Sets"],
  },
  {
    statement: "Is Linenfold HVN's fabric and laundry scent expression?",
    answer: "True",
    explanation:
      "Correct — Linenfold carries a Note into linens, garments, and soft materials (HVN's take on dryer sheets / fabric scent).",
    terms: ["Linenfold"],
  },
  {
    statement: "Is a Prime Anchor a porous object that holds a Note and releases it slowly?",
    answer: "True",
    explanation:
      "Yes — a Prime Anchor is HVN's porous scent-holding object; it receives a Note and releases it gradually into the surrounding atmosphere.",
    terms: ["Prime Anchor"],
  },
  {
    statement: "Is “Havenry” just a fancier word for a store?",
    answer: "False",
    explanation:
      "A Havenry is a redefinition, not a rename — HVN's refined commercial destination. “Not a store. A Havenry.”",
    terms: ["Havenry"],
  },
  {
    statement: "Is Low Ember a physical HVN product?",
    answer: "False",
    explanation:
      "Low Ember is a visual tone, not a product — HVN's restrained nighttime look (controlled warmth and atmosphere) used to present products and scenes.",
    terms: ["Low Ember"],
  },
  {
    statement: "Is Civil Twilight an outdoor dusk visual tone in HVN's system?",
    answer: "True",
    explanation:
      "Correct — Civil Twilight is HVN's exterior transition tone, where the last daylight shares the space with the first warm artificial light.",
    terms: ["Civil Twilight"],
  },
  {
    statement: "Does “Atmospheric Jurisdiction” mean intentionally governing a space's atmosphere?",
    answer: "True",
    explanation:
      "Yes — Atmospheric Jurisdiction is the philosophy that a space and its atmosphere should be intentionally governed, not left to chance.",
    terms: ["Atmospheric Jurisdiction"],
  },
];
