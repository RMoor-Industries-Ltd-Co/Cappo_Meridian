// HVN / HARV Supplier Engagement Playbooks — audited from the HARV board
// briefings (board@apex-meridian-group.com, June 15 2026). Each playbook is a
// supplier archetype with the same universal spine: Open → Qualify → Brief →
// Key Questions → Close. {rep} {contact} {company} {category} are filled live.

export interface ScriptStage {
  id: string;
  label: string;
  goal: string;
  lines?: string[];
  /** For the Key-Questions stage: the must-ask list (maps to Capture fields). */
  checklist?: string[];
  /** Inline coaching note from the playbook. */
  coaching?: string;
}

export interface Playbook {
  id: string;
  name: string;
  /** Who you're talking to. */
  who: string;
  /** Tone calibration — what to open with. */
  leadWith: string;
  /** The phrase that signals you're a serious buyer. */
  keyPhrase: string;
  /** Before-you-dial checklist. */
  prep: string[];
  stages: ScriptStage[];
  redFlags: string[];
  /** Page categories that suggest this playbook. */
  categories: string[];
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "general",
    name: "General Wholesale (Havenry)",
    who: "Wholesale / trade-desk contact at a supplier or wholesaler",
    leadWith: "Warm and brand-first — fit, minimums, and whether they're taking new accounts",
    keyPhrase: "new wholesale account",
    prep: [
      "Havenry Shopify store URL ready to share",
      "Reseller certificate on hand if they ask",
      "Target categories + a rough volume in mind",
    ],
    stages: [
      {
        id: "open",
        label: "Open",
        goal: "Identity + permission (first 30s)",
        lines: [
          "Hi — is this {contact}? Great. {contact}, this is {rep} with Havenry. Thanks for picking up — did I catch you at an okay time for a quick two minutes?",
          "The reason I'm reaching out — we're a growing home-and-lifestyle brand specializing in {category}, and we're building out our supplier network.",
        ],
      },
      {
        id: "qualify",
        label: "Qualify",
        goal: "Right person + open door",
        lines: [
          "Are you taking on new wholesale accounts right now as we scale our Shopify store?",
          "And are you the right person to talk to about wholesale pricing & minimums, or is there someone I should connect with?",
        ],
      },
      {
        id: "brief",
        label: "Brief",
        goal: "Position Havenry as a deliberate, curated buyer",
        lines: [
          "We curate a tight supplier set rather than buy from everyone — fewer suppliers, deeper relationships. In {category}, we're looking for one or two partners we can grow with.",
        ],
      },
      {
        id: "questions",
        label: "Key Questions",
        goal: "Capture terms (fill these into Capture →)",
        checklist: [
          "What's your minimum order (MOQ) — per SKU and per order?",
          "Wholesale pricing — flat, or tiered by volume?",
          "Lead time on a typical order?",
          "Do you offer samples, and what's the cost?",
          "Can you ship under neutral / blind packaging?",
          "Payment terms — deposit, Net 30, card?",
        ],
      },
      {
        id: "close",
        label: "Close",
        goal: "Get the line sheet + a next step",
        lines: [
          "This sounds promising. Could you email me your line sheet and wholesale terms? I'll review with our team and come back to you this week.",
          "What's the best email — and who do I follow up with directly going forward?",
        ],
      },
    ],
    redFlags: [
      "Will only quote terms verbally — nothing in writing",
      "No samples and no catalog/photos before an order",
      "Pushes a large first order before any sample",
      "Unresponsive beyond 48h to a professional inquiry",
    ],
    categories: ["Candles", "Incense", "Burning oils", "Packaging", "Other"],
  },
  {
    id: "fragrance",
    name: "Fragrance Consultant",
    who: "Independent perfumer / lead consultant — an artist first",
    leadWith: "Brand story first — signal budget, IP awareness, and respect for the craft",
    keyPhrase: "paid sample formulation engagement",
    prep: [
      "Frame as HVN Global LLC — a brand in development, not a hobbyist",
      "NDA ready to send same-day",
      "Know the three formats: poured candle, pressed incense ember, burning oil",
      "Reference notes ready: oud, vetiver, black amber, smoked woods (no florals/citrus)",
    ],
    stages: [
      {
        id: "open",
        label: "Open",
        goal: "Respect their time, set the 20-min frame",
        lines: [
          "Hi {contact}, this is {rep} calling from HVN Global LLC — thank you for making time. I know you're busy so I'll be direct; we've got about 20 minutes and I want to use them well.",
          "HVN is a premium home-fragrance brand in development — a proprietary line across poured candles, pressed incense embers, and burning oils, positioned high-end men's lifestyle, the $150–$5,000 gifting range.",
        ],
        coaching: "The price-point reference is deliberate — it signals a serious brand with margin, not a budget operation.",
      },
      {
        id: "qualify",
        label: "Qualify",
        goal: "Hear their relevant experience — let them talk",
        lines: [
          "Before our brief, I'd love to hear from you — can you walk me through the home-fragrance projects you've worked on recently? I'm especially curious about candle formulation, and any incense or combustible-format work.",
          "The ember format matters to us — pressed incense designed to smolder rather than flame, so the release profile differs from a stick. Is that combustion chemistry something you've taken to a finished formula, or a learning curve?",
        ],
        coaching: "An honest consultant who flags gaps is MORE trustworthy than one who claims everything. Reward honesty by leaning in.",
      },
      {
        id: "brief",
        label: "Brief",
        goal: "Give the scent direction + IP requirement",
        lines: [
          "We're developing three families — Elemental, Shadow, and Sanctum — each in candle, incense ember, and burning oil. Distinct profiles, but a shared thread that reads as unmistakably HVN.",
          "Direction: dark, resinous, masculine — oud, vetiver, black amber, smoked woods. Closer to a private library or cigar lounge than a spa. We want the scent to feel like an object — heavy, intentional, lasting.",
        ],
      },
      {
        id: "questions",
        label: "Key Questions",
        goal: "IP, terms, timeline (fill into Capture →)",
        checklist: [
          "What's your NDA & IP framework — does formula ownership transfer to us on final payment?",
          "Deposit structure to begin, and how many revision rounds are included?",
          "Timeline for the sample scope at your current load?",
          "Do you follow IFRA compliance standards?",
        ],
        coaching: "Never accept a licensing model where HVN doesn't fully own a formula it sells commercially — the exposure is too high. Negotiate a buy-out and involve legal.",
      },
      {
        id: "close",
        label: "Close",
        goal: "Close a defined, paid sample scope",
        lines: [
          "Here's where we'd start — and we're not asking for speculative work. A paid sample scope: one candle, one incense ember, and one burning-oil formula in the same direction, documented in your format, with physical samples for testing. What's that look like in timeline and investment?",
          "I'll send our NDA today; send your standard agreement template, and let's book a brief alignment call next week.",
        ],
      },
    ],
    redFlags: [
      "Wants to license the base formula, not transfer ownership",
      "Claims expertise in every format with no gaps flagged — request portfolio samples before NDA",
      "No NDA / IP framework at all",
    ],
    categories: ["Fragrance / raw"],
  },
  {
    id: "stone",
    name: "Stone / Factory (RFQ)",
    who: "Factory rep, sales manager, or workshop owner",
    leadWith: "Spec & quantity first — RFQ language. Brand story comes second.",
    keyPhrase: "RFQ — custom sample order",
    prep: [
      "Dimension sketch / technical drawing ready to send",
      "Material + finish spec defined (onyx/marble, octagonal, gloss top / matte base)",
      "Sample quantity + target production MOQ in mind",
      "Be ready to send to WhatsApp AND email",
    ],
    stages: [
      {
        id: "open",
        label: "Open",
        goal: "Establish a real buyer with a real spec",
        lines: [
          "Hello, this is {rep} from HVN Global LLC, a premium US home-décor brand. We're sourcing a manufacturer for a line of custom natural-stone products — large-format octagonal ashtrays and incense holders in onyx and marble.",
          "Are you the right person for a custom RFQ — custom shape, private label, with engraving?",
        ],
      },
      {
        id: "qualify",
        label: "Qualify",
        goal: "Confirm custom capability + proof of work",
        lines: [
          "Can you produce custom octagonal shapes? And the brass insert — do you make metal parts in-house, or coordinate a partner factory for a combined piece?",
          "Before we commit — can you send photos or a factory quality video of comparable onyx work? WhatsApp is fine.",
        ],
      },
      {
        id: "brief",
        label: "Brief",
        goal: "State the full spec precisely",
        lines: [
          "Spec: natural onyx (honey/green) and black/white marble; octagonal ~30–40cm diameter, 5–8cm depth; high-gloss polish on top, matte base; removable brass center basin ~10cm; recessed 'HVN' engraving on the exterior face.",
          "Samples: 3–5 pieces per stone variety. Production target: 100–500 units per SKU once samples are approved.",
        ],
      },
      {
        id: "questions",
        label: "Key Questions",
        goal: "Quote, terms, compliance (fill into Capture →)",
        checklist: [
          "Sample lead time and cost per piece?",
          "Production pricing at 100 / 500 / 1,000 units?",
          "Private-label policy — no factory branding on the piece?",
          "Material certificate confirming 100% natural stone (not composite/resin)?",
          "Payment structure — deposit % and balance terms?",
          "Can you provide a commercial invoice for US customs / HTS compliance?",
        ],
      },
      {
        id: "close",
        label: "Close",
        goal: "Lock a written quotation + single point of contact",
        lines: [
          "Please send a formal sample quotation by email — stone varieties, finish, brass coordination, engraving, and shipping to the US. I'll send the dimension sketch today and confirm a sample order within the week.",
          "Who should I work with directly for all future communication?",
        ],
        coaching: "Don't push hard for sample-cost credit — it signals you're not serious about production. Accept sample cost as a cost of doing business.",
      },
    ],
    redFlags: [
      "Refuses a material certificate (100% natural stone)",
      "Can't show photos/video of comparable work before quoting",
      "Asks full payment upfront on a production order (samples OK)",
      "Can't provide a commercial invoice for US customs",
      "Promises a <10-day lead time on custom octagonal onyx",
      "Claims to do stone + brass + engraving + shipping all in-house",
    ],
    categories: ["Lounge goods"],
  },
  {
    id: "furniture-corporate",
    name: "Furniture — Trade Program (Four Hands / VIG)",
    who: "Trade-program manager / B2B sales rep at an established brand",
    leadWith: "Business legitimacy first — EIN, reseller cert, website, retail channel",
    keyPhrase: "trade program application / wholesale inquiry",
    prep: [
      "Business EIN / Tax ID ready",
      "Reseller (sales-tax exemption) certificate ready",
      "Business website live — even minimal establishes legitimacy",
      "Retail channel described (Shopify store / showroom)",
      "A conservative annual purchase-volume figure ($50–100k year one)",
    ],
    stages: [
      {
        id: "open",
        label: "Open",
        goal: "Introduce post-application",
        lines: [
          "Hi, is this {contact}? This is {rep} representing HVN Global LLC. I submitted a trade-program application and wanted to follow up directly to introduce us.",
        ],
      },
      {
        id: "qualify",
        label: "Qualify",
        goal: "Frame the retail channel + customer",
        lines: [
          "We're a premium men's lifestyle brand launching a curated Shopify store for luxury home-environment products — lounge furniture, décor, ritual objects. Primarily e-commerce, with a wholesale / private-club channel developing alongside it.",
          "Our customer isn't browsing Amazon — they spend intentionally and want curation.",
        ],
      },
      {
        id: "brief",
        label: "Brief",
        goal: "Name the categories + set realistic volume",
        lines: [
          "We're specifically interested in your lounge seating, accent tables, and statement occasional pieces — darker finishes, raw materials, architectural forms.",
          "Year-one volume we're projecting conservatively in the $50,000–$100,000 range as we build the channel, with significant growth in year two. We'd rather set a realistic baseline and exceed it.",
        ],
      },
      {
        id: "questions",
        label: "Key Questions",
        goal: "Tiers, feed, dropship, lead time (fill into Capture →)",
        checklist: [
          "Pricing-tier thresholds — at what annual volume do we move up a tier?",
          "Minimum per transaction, or just an annual minimum?",
          "How does the Shopify product feed work — Spark Shipping / direct API, real-time or scheduled?",
          "Blind dropship — does it ship in neutral packaging or your branding?",
          "Lead times — in-stock vs made-to-order?",
          "Damage-claim policy and filing window?",
        ],
        coaching: "Blind dropship is the key differentiator (VIG confirms it; Four Hands ships branded). If they offer it, get it in writing in the retailer agreement.",
      },
      {
        id: "close",
        label: "Close",
        goal: "Get terms + feed docs in writing",
        lines: [
          "This is helpful — can you send the trade terms and data-feed documentation in writing? Blind-dropship confirmation especially I'd want documented in our retailer agreement.",
        ],
      },
    ],
    redFlags: [
      "Won't confirm trade-discount terms in writing — verbal only",
      "Can't confirm the Shopify data feed is current (overselling risk)",
      "Requires you to hold inventory at this stage",
      "No clear damage-claim policy on freight-delivered furniture",
      "Unresponsive within 48h to a professional inquiry",
    ],
    categories: ["Lounge goods"],
  },
  {
    id: "furniture-boutique",
    name: "Furniture — Boutique / Trade-Only (NOIR)",
    who: "Boutique trade team — designer-led, curated distribution",
    leadWith: "Aesthetic recognition first — name their designer and finishes. Logistics second.",
    keyPhrase: "trade account — aesthetic fit",
    prep: [
      "Study their catalog — name specific pieces, finishes, and the designer",
      "Frame curation, not volume — an 8–15 piece edit",
      "Lead with respect for the work, not the size of your order",
    ],
    stages: [
      {
        id: "open",
        label: "Open",
        goal: "Open with genuine aesthetic recognition",
        lines: [
          "Hi {contact}, thanks for the time. {company}'s catalog is one of the few furniture lines we've found that genuinely fits our brief — the hand-rubbed finishes, the sculptural forms, the refusal to be conventional. We've looked at your work seriously.",
        ],
        coaching: "Leading with specific aesthetic recognition signals to a small trade team that you've done your homework. That matters enormously to a boutique brand. Logistics come second.",
      },
      {
        id: "qualify",
        label: "Qualify",
        goal: "Paint the customer — let them ask",
        lines: [
          "Our customer is 35–55, high income — finance, law, private equity, entrepreneurship. He collects deliberately, reads design books, and invests significantly to get his space right. He is not walking into a chain store.",
          "We'd carry a tightly curated 8–15 piece edit, each presented in full editorial context — photography, provenance, materials story.",
        ],
      },
      {
        id: "brief",
        label: "Brief",
        goal: "Explain why so few — curation as the brand",
        lines: [
          "Why so few pieces? Because curation is the brand. We'd rather carry 10 pieces and present each perfectly than carry 50 and treat them as inventory — and that actually serves your pieces better, getting them the attention they deserve.",
          "We're most drawn to the occasional chairs and sideboards — pieces that anchor a room without dominating it — and anything in the hand-rubbed black family. We'd love to know what's coming next.",
        ],
      },
      {
        id: "questions",
        label: "Key Questions",
        goal: "Minimums, logistics, exclusivity (fill into Capture →)",
        checklist: [
          "Minimum order value per transaction or per season?",
          "Lead times — in-stock vs made-to-order?",
          "Can you ship direct to our customer's address on our instruction?",
          "Path to exclusivity on specific pieces as volume grows?",
          "Trade shows (High Point, ICFF) where we could see the collection?",
        ],
      },
      {
        id: "close",
        label: "Close",
        goal: "Complete registration + earn the lookbook",
        lines: [
          "What do we need to complete the trade-account registration and get access to pricing — and the upcoming lookbook? We want to make sure we're the right kind of partner for you before we proceed.",
        ],
        coaching: "Relationship ceiling here is the highest of any supplier — patience and aesthetic credibility win, not volume. Exclusivity is a later conversation, once trust is established.",
      },
    ],
    redFlags: [
      "Treats you as just another retailer despite the aesthetic pitch",
      "Won't put trade pricing or terms in writing",
      "No clear damage-claim policy on shipped pieces",
    ],
    categories: ["Lounge goods"],
  },
];

/** Fill {rep} {contact} {company} {category} placeholders. */
export function fillScript(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? `{${k}}`);
}

/** Suggest a playbook id from a Capture category. */
export function suggestPlaybook(category?: string | null): string {
  if (!category) return "general";
  const hit = PLAYBOOKS.find((p) => p.id !== "general" && p.categories.includes(category));
  return hit?.id ?? "general";
}
