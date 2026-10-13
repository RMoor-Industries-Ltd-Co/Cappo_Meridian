import type { ReactNode } from "react";
import type { FounderLabel } from "@/lib/founders";
import { currentQuarter, type QuarterId } from "@/lib/quarters";
import { QuarterTabs } from "@/components/overview/QuarterTabs";

/**
 * Approved Founder guardian spirit beast banners — see
 * docs/contracts/founder-welcome-banner-contract.md for the design contract
 * these assets and their treatment are governed by. Each overlay is tuned to
 * that founder's source image brightness (Founder 55's is fire-lit and
 * bright; Founder 88's is already dark/stone-lit), not to a shared default.
 */
const FOUNDER_BANNERS: Record<
  FounderLabel,
  { image: string; guardianTitle: string; overlay: string }
> = {
  "Founder 55": {
    image: "/founders/banners/founder-55-golden-bull.png",
    guardianTitle: "Golden Bull Sentinel",
    overlay:
      "linear-gradient(90deg, rgba(10,9,7,0.92) 0%, rgba(10,9,7,0.74) 40%, rgba(10,9,7,0.4) 68%, rgba(10,9,7,0.18) 100%)",
  },
  "Founder 88": {
    image: "/founders/banners/founder-88-dragon-lion.png",
    guardianTitle: "Dragon-Lion Sentinel",
    overlay:
      "linear-gradient(90deg, rgba(10,9,7,0.85) 0%, rgba(10,9,7,0.55) 40%, rgba(10,9,7,0.22) 68%, rgba(10,9,7,0.08) 100%)",
  },
};

export function FounderHeroBanner({
  founderLabel,
  today,
  activeLabel,
  active,
  daysToNext,
}: {
  founderLabel: FounderLabel;
  today: string;
  activeLabel: string;
  active: QuarterId;
  daysToNext: number;
}) {
  const banner = FOUNDER_BANNERS[founderLabel];

  return (
    <section
      className="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-border-strong px-6 py-8 sm:px-10 sm:py-10"
      style={{
        backgroundImage: `${banner.overlay}, url(${banner.image})`,
        backgroundSize: "cover",
        backgroundPosition: "left center",
        minHeight: "220px",
      }}
    >
      {/* Mobile: deepen the wash so the guardian reads as a low-opacity background,
          never a tiny foreground thumbnail competing with the greeting. */}
      <div className="absolute inset-0 bg-bg/70 sm:hidden" aria-hidden="true" />

      <div className="relative z-10 max-w-xl">
        <h1 className="founder-greeting text-3xl sm:text-4xl">Welcome {founderLabel}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <MetaChip>{today}</MetaChip>
          <MetaChip>
            {activeLabel === "Company" ? "Company view" : `${activeLabel} ${new Date().getFullYear()}`}
          </MetaChip>
          <MetaChip>Guardian Spirit Beast</MetaChip>
          <MetaChip gold>{banner.guardianTitle}</MetaChip>
        </div>
        {daysToNext <= 45 && (
          <p className="mt-2 text-xs text-subtle">
            {currentQuarter()} ends in <span className="text-gold">{daysToNext} days</span>.
          </p>
        )}
        <div className="mt-5">
          <QuarterTabs active={active} />
        </div>
      </div>
    </section>
  );
}

function MetaChip({ children, gold }: { children: ReactNode; gold?: boolean }) {
  return (
    <span
      className={
        gold
          ? "rounded-full border border-gold/40 bg-black/40 px-3 py-1 text-gold"
          : "rounded-full border border-border-strong bg-black/40 px-3 py-1 text-subtle"
      }
    >
      {children}
    </span>
  );
}
