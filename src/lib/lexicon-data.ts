/**
 * Shared lexicon data — single source of truth for the AMG/HVN term list.
 * Used by the Lexicon page and the Training quiz.
 */

export interface LexiconEntry {
  term: string;
  meaning: string;
  use: string;
  plain: string;
  example: string;
  formula?: string;
  image?: string;
  category: string;
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/sanctum/i, "Sanctum"],
  [/chamber/i, "Atmos Chambers"],
  [/\banchor\b/i, "Prime Anchors"],
  [/reservoir|terrain basin/i, "Tempering Reservoirs"],
  [/ember line/i, "Ember Lines"],
  [/cachet inset|deeprest|repose cushion|stem comb/i, "Product Formats"],
];

function categorize(name: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(name)) return cat;
  return "Brand Language";
}

const RAW_TERMS: Omit<LexiconEntry, "category">[] = [
  {
    term: "Appointments",
    meaning: "Curated non-proprietary objects selected for HVN.",
    use: "When referring to sourced or selected objects that support the HVN environment but are not proprietary HVN scent products.",
    plain: "Curated products or objects.",
    example: "The Havenry will include HVN originals and selected Appointments.",
  },
  {
    term: "Atlas Chamber",
    meaning: "A globe/world-based Atmos Chamber family built around reveal, transformation, or contained-world concepts.",
    use: "Atmos Chamber subcategory.",
    plain: "Globe-inspired candle chamber.",
    example: "The Atlas Chamber is designed as a world held in flame.",
  },
  {
    term: "Atmospheric Jurisdiction",
    meaning: "The philosophy that a space and its atmosphere should be intentionally governed.",
    use: "Brand philosophy / institutional language.",
    plain: "Intentional control of a space's atmosphere.",
    example: "Atmospheric Jurisdiction begins when the room is no longer left to chance.",
  },
  {
    term: "Cachet Insets",
    meaning: "HVN's scented insert expression for drawers, wardrobes, bags, storage spaces, and enclosed environments.",
    use: "Core Impression / product format.",
    plain: "Scented wardrobe or storage inserts.",
    example: "Place the Cachet Inset inside the drawer and let the Note settle into the fabric.",
  },
  {
    term: "Channel Anchor",
    meaning: "A Prime Anchor form with carved or recessed channels that hold scent and increase passive diffusion surface area.",
    use: "Prime Anchor subcategory.",
    plain: "Grooved scent anchor object.",
    example: "The Channel Anchor holds the Note in its carved surface.",
  },
  {
    term: "Channel Reservoir",
    meaning: "A Tempering Reservoir form with controlled channels that guide or hold scented oil.",
    use: "Tempering Reservoir subcategory.",
    plain: "Oil reservoir with channels.",
    example: "The Channel Reservoir lets the oil settle into a measured path.",
  },
  {
    term: "Column Chamber",
    meaning: "An Atmos Chamber shaped around upright architectural, pillar, or column-inspired form.",
    use: "Atmos Chamber subcategory.",
    plain: "Column-inspired candle.",
    example: "The Column Chamber gives the flame an architectural presence.",
  },
  {
    term: "Continuous Ember Line",
    meaning: "An Ember Line with one uninterrupted burn path from ignition to finish.",
    use: "Ember Line subcategory.",
    plain: "Standard single-path incense.",
    example: "The Continuous Ember Line carries the Note in one unbroken path.",
  },
  {
    term: "Cradle Chamber",
    meaning: "An Atmos Chamber held, supported, or framed by a cradle, base, or structural support.",
    use: "Atmos Chamber subcategory.",
    plain: "Candle chamber in a cradle or support.",
    example: "The Cradle Chamber gives the flame a deliberate seat.",
  },
  {
    term: "Crater Reservoir",
    meaning: "A Tempering Reservoir form with crater-like wells where scented oil pools.",
    use: "Tempering Reservoir subcategory.",
    plain: "Oil reservoir with crater-shaped wells.",
    example: "The Crater Reservoir lets the oil gather in controlled depressions.",
  },
  {
    term: "Curated Appointments",
    meaning: "Selected non-proprietary objects chosen to support HVN's atmospheric standard.",
    use: "Product/category language for curated sourced objects.",
    plain: "Curated products.",
    example: "Curated Appointments extend the atmosphere beyond HVN's proprietary pieces.",
  },
  {
    term: "DeepRest",
    meaning: "HVN's primary scented rest/pillow expression for standard pillows, throws, and soft rest objects.",
    use: "Product format / rest object category.",
    plain: "Scented pillow or rest product.",
    example: "DeepRest carries the Note into the room's quietest hours.",
  },
  {
    term: "Elemental Sanctum",
    meaning: "The foundational Sanctum tier, centered on essential ritual, weight, and restraint.",
    use: "Sanctum tier.",
    plain: "Entry-level ritual smoking object tier.",
    example: "Ash deserves better than disposal.",
  },
  {
    term: "Havenry",
    meaning: "HVN's coined term for a refined commercial destination, replacing \"store\" or \"shop.\"",
    use: "When defining what HVN is as a destination.",
    plain: "A store, redefined through HVN's language.",
    example: "Not a store. A Havenry.",
  },
  {
    term: "HVN",
    meaning: "The name of HVN's Shopify presence and commercial destination.",
    use: "When referring to the branded shopping presence itself.",
    plain: "The HVN shop.",
    example: "HVN is where the products, objects, and atmospheric instruments are presented.",
  },
  {
    term: "HVN Curated Appointments",
    meaning: "The full category name for HVN's curated non-proprietary product lane.",
    use: "Formal category language.",
    plain: "HVN's curated product selections.",
    example: "HVN Curated Appointments are selected to support the room's composition.",
  },
  {
    term: "HVN Global",
    meaning: "The corporate entity and broader lifestyle ecosystem behind HVN.",
    use: "Corporate / institutional brand language.",
    plain: "The HVN company.",
    example: "HVN Global is the institution behind HVN.",
  },
  {
    term: "HVN Havenry",
    meaning: "A formal compound reference to HVN as The Havenry.",
    use: "Formal destination language when both the HVN name and Havenry category need to be stated together.",
    plain: "HVN's Havenry.",
    example: "The HVN Havenry is where the atmosphere is entered, not merely browsed.",
  },
  {
    term: "Imperium Sanctum",
    meaning: "A commanding Sanctum tier built around table presence, authority, and directional gravity.",
    use: "Sanctum tier.",
    plain: "Command-level ritual smoking object tier.",
    example: "Built for the table where silence carries weight.",
  },
  {
    term: "Obelisk Anchor",
    meaning: "A vertical obelisk-shaped Prime Anchor designed to hold and passively release a Note.",
    use: "Prime Anchor subcategory.",
    plain: "Upright scent anchor object.",
    example: "The Obelisk Anchor gives the Note vertical presence.",
  },
  {
    term: "Object Reveal Atlas Chamber",
    meaning: "An Atlas Chamber designed to reveal a keepsake, token, medallion, or object as the outer form melts away.",
    use: "Atlas Chamber subcategory.",
    plain: "Globe candle that reveals an object.",
    example: "The Object Reveal Atlas Chamber leaves something behind after the flame has done its work.",
  },
  {
    term: "Obsidian Sanctum",
    meaning: "A darker, heavier Sanctum tier built around restraint, density, and private ritual.",
    use: "Sanctum tier.",
    plain: "Darker premium ritual smoking object tier.",
    example: "There is nothing soft about restraint.",
  },
  {
    term: "Porous Ceramic Monolith Anchor",
    meaning: "A monolithic ceramic Prime Anchor designed to absorb, hold, and passively release a Note.",
    use: "Prime Anchor subcategory.",
    plain: "Ceramic scent stone/object.",
    example: "The Porous Ceramic Monolith Anchor holds the Note without needing flame.",
  },
  {
    term: "Regalia Sanctum",
    meaning: "The rarest Sanctum tier, centered on ceremonial material, possession, and private collector-grade presence.",
    use: "Sanctum tier.",
    plain: "Rare ceremonial ritual smoking object tier.",
    example: "Rare stone. Private smoke. No announcement.",
  },
  {
    term: "Repose Cushion",
    meaning: "HVN's specialty scented rest/cushion expression for body pillows, larger pillows, and indulgent support forms.",
    use: "Product format / specialty rest object category.",
    plain: "Specialty scented pillow or cushion.",
    example: "The Repose Cushion brings the Note into the body's resting architecture.",
  },
  {
    term: "Reveal Atlas Chamber",
    meaning: "An Atlas Chamber designed so the outer globe form melts away to reveal another Atmos Chamber inside.",
    use: "Atlas Chamber subcategory.",
    plain: "Globe candle that reveals an inner candle chamber.",
    example: "The Reveal Atlas Chamber changes the object as the ritual progresses.",
  },
  {
    term: "Sanctum",
    meaning: "HVN's ritual object category for elevated ash, ember, cigar, or smoking-related objects.",
    use: "Product family/category language.",
    plain: "Elevated ashtray or smoking ritual object.",
    example: "Not an ashtray. A Sanctum.",
  },
  {
    term: "Segmented Ember Line",
    meaning: "An Ember Line designed in distinct sections, stages, or burn segments.",
    use: "Ember Line subcategory.",
    plain: "Sectioned incense.",
    example: "The Segmented Ember Line moves through the Note in measured stages.",
  },
  {
    term: "Shadowed Oak Daylight",
    meaning: "HVN's grounded day tone — masculine, weighted, warm, and livable without becoming airy or soft. This is daytime, but not soft.",
    use: "HVN Tone System / visual direction language. Applied to daytime Appointment showcases, room scenes, product photography, social content, and any visual that requires controlled daylight with masculine weight.",
    plain: "HVN's grounded daytime visual tone: dark oak + muted light.",
    example: "shadowed oak daylight interior, masculine quiet-luxury room, dark oak and walnut surfaces, tobacco leather, muted cream stone, aged brass accents, soft daylight through heavy curtains, long architectural shadows, warm gray walls — not bright, not airy, not white.",
    formula: "dark oak + walnut + tobacco leather + muted cream stone + aged brass + filtered daylight",
    image: "https://lh3.googleusercontent.com/d/1LgR2m6gLcgxLvRAblZbHXqZ0Neq3xSp7",
  },
  {
    term: "Shadow Chamber",
    meaning: "An Atmos Chamber designed with apertures, slits, or cutouts that cast controlled shadow as the candle burns.",
    use: "Atmos Chamber subcategory.",
    plain: "Candle chamber that creates shadow effects.",
    example: "The Shadow Chamber lets the flame work through the walls of the object.",
  },
  {
    term: "Statuary Chamber",
    meaning: "A sculptural Atmos Chamber designed as an object-form candle.",
    use: "Atmos Chamber subcategory.",
    plain: "Sculptural candle.",
    example: "The Statuary Chamber sits as an object before it ever burns.",
  },
  {
    term: "Stem Comb",
    meaning: "A fitted guide or collar used to arrange, separate, or control diffuser stems within a Stem Set.",
    use: "Stem Set component / design feature.",
    plain: "Reed diffuser stem organizer.",
    example: "The Stem Comb gives the reeds a composed arrangement.",
  },
  {
    term: "Stepped Reservoir",
    meaning: "A Tempering Reservoir form with tiered levels where scented oil rests, moves, or collects.",
    use: "Tempering Reservoir subcategory.",
    plain: "Tiered oil reservoir.",
    example: "The Stepped Reservoir gives the oil a ritual descent.",
  },
  {
    term: "Stone Puck Anchor",
    meaning: "A low, weighted Prime Anchor form designed to hold and passively release a Note.",
    use: "Prime Anchor subcategory.",
    plain: "Low scent stone.",
    example: "The Stone Puck Anchor brings the Note to the surface without flame.",
  },
  {
    term: "Terrain Basin",
    meaning: "A Tempering Reservoir form with a sculpted topographic basin where scented oil rests.",
    use: "Tempering Reservoir subcategory.",
    plain: "Topographic oil basin.",
    example: "The Terrain Basin lets the oil settle into a carved landscape.",
  },
  {
    term: "Terrain Chamber",
    meaning: "An Atmos Chamber inspired by landforms, topography, and sculpted terrain.",
    use: "Atmos Chamber subcategory.",
    plain: "Terrain-inspired candle chamber.",
    example: "The Terrain Chamber turns the surface of the candle into landscape.",
  },
  {
    term: "The Accord of HVN",
    meaning: "HVN's formal cultural, editorial, nonprofit, community, or initiative layer.",
    use: "Formal institutional language.",
    plain: "HVN's cultural/community arm.",
    example: "The Accord of HVN is where the institution speaks beyond the Havenry.",
  },
  {
    term: "The Havenry",
    meaning: "The singular title for HVN's Shopify presence, recognizing it as the first and only Havenry in existence.",
    use: "When referring to HVN as the official destination, experience, or proprietary shopping environment.",
    plain: "HVN's official shopping destination.",
    example: "Enter The Havenry by resonance.",
  },
  {
    term: "Threshold Chamber",
    meaning: "An Atmos Chamber designed around progression, transition, or layered change through wax, scent, or visual stages.",
    use: "Atmos Chamber subcategory.",
    plain: "Transition-based candle chamber.",
    example: "The Threshold Chamber is built for the moment between states.",
  },
  {
    term: "Tile Anchor",
    meaning: "A thin tile or plaque-style Prime Anchor designed to hold and passively release a Note.",
    use: "Prime Anchor subcategory.",
    plain: "Flat scent tile.",
    example: "The Tile Anchor lets the Note rest flat against the room.",
  },
  {
    term: "Transformational Atlas Chamber",
    meaning: "An Atlas Chamber concept where melted wax from an elevated globe transfers downward and reforms into a second chamber or pillar form.",
    use: "Advanced Atlas Chamber / flagship R&D concept.",
    plain: "Globe candle that transforms into another candle form.",
    example: "The Transformational Atlas Chamber does not merely reveal; it becomes.",
  },
  {
    term: "Transitional Ember Line",
    meaning: "An Ember Line designed to shift across scent, material, color, or burn experience over time.",
    use: "Ember Line subcategory.",
    plain: "Incense that transitions as it burns.",
    example: "The Transitional Ember Line changes the room as the burn progresses.",
  },
  {
    term: "Vessel Chamber",
    meaning: "An Atmos Chamber built around a vessel, container, or contained flame architecture.",
    use: "Atmos Chamber subcategory.",
    plain: "Vessel-based candle chamber.",
    example: "The Vessel Chamber gives the flame a permanent house.",
  },
  {
    term: "World Within Atlas Chamber",
    meaning: "An Atlas Chamber with a world/globe exterior and an inner chamber or old-world pillar held within it.",
    use: "Atlas Chamber subcategory.",
    plain: "Globe chamber with an inner candle world.",
    example: "The World Within Atlas Chamber holds another form beneath the surface.",
  },
];

export const LEXICON_TERMS: LexiconEntry[] = RAW_TERMS.map((t) => ({
  ...t,
  category: categorize(t.term),
}));

export const CATEGORIES: string[] = Array.from(
  new Set(LEXICON_TERMS.map((t) => t.category)),
).sort();
