/**
 * Maps a dashboard nav path to the Notion "Domain" name(s) (see NOTION_DS.domains)
 * that module corresponds to. Backs the Meetings nav item's priority highlight —
 * hovering it while on e.g. /commerce-operations surfaces the top open item tagged
 * Marketing or Sales in Notion/ClickUp.
 *
 * Live domain names in the AMG Hub (as of this writing): Sales, Operations,
 * Marketing, Affiliates, Legal, Research, Budget, Inventory. Not every nav path
 * has a matching domain — those fall back to no highlight rather than a guess.
 *
 * `/campaigns`, `/marketing`, and `/sales` are kept here even though they now
 * redirect to `/commerce-operations` — `domainsForPath` is also consulted
 * during the redirect's brief transition, and a stale old deep link should
 * still resolve to the same highlight rather than silently losing it.
 */
export const PATH_DOMAINS: Record<string, string[]> = {
  "/commerce-operations": ["Marketing", "Sales", "Affiliates"],
  "/campaigns": ["Marketing", "Sales", "Affiliates"],
  "/marketing": ["Marketing"],
  "/sales": ["Sales"],
  "/operations": ["Operations"],
  "/legal": ["Legal"],
  "/financials": ["Budget"],
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
