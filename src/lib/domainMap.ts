/**
 * Maps a dashboard nav path to the Notion "Domain" name(s) (see NOTION_DS.domains)
 * that module corresponds to. Backs the Meetings nav item's priority highlight —
 * hovering it while on e.g. /campaigns surfaces the top open item tagged Marketing
 * or Sales in Notion/ClickUp.
 *
 * Live domain names in the AMG Hub (as of this writing): Sales, Operations,
 * Marketing, Affiliates, Legal, Research, Budget, Inventory. Not every nav path
 * has a matching domain — those fall back to no highlight rather than a guess.
 */
export const PATH_DOMAINS: Record<string, string[]> = {
  "/campaigns": ["Marketing", "Sales", "Affiliates"],
  "/operations": ["Operations"],
  "/legal": ["Legal"],
  "/budget": ["Budget"],
  "/inventory": ["Inventory"],
  "/ai": ["Research"],
};

/** Resolve the domain(s) for the most specific matching nav path prefix, if any. */
export function domainsForPath(pathname: string): string[] {
  const match = Object.keys(PATH_DOMAINS)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PATH_DOMAINS[match] : [];
}
