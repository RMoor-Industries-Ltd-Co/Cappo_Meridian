import type { ReactNode } from "react";
import type { FounderLabel } from "@/lib/founders";
import { currentQuarter, type QuarterId } from "@/lib/quarters";
import { QuarterTabs } from "@/components/overview/QuarterTabs";

/**
 * Approved Founder guardian spirit beast banners — see
 * docs/contracts/founder-welcome-banner-contract.md for the design contract
 * these assets and their treatment are governed by. The beast is the identity
 * anchor; the greeting is the overlay — `contentAlign` says which side of the
 * banner is clear of the beast (both current assets place the guardian
 * left-of-center, so text lives in the open right-side area), and
 * `overlayStrength` tunes the gradient darkness at that text-safe edge to
 * each source image's brightness, without ever darkening over the beast.
 */
const FOUNDER_BANNERS: Record<
  FounderLabel,
  { image: string; guardianTitle: string; contentAlign: "left" | "right"; overlayStrength: number }
> = {
  "Founder 55": {
    image: "/founders/banners/founder-55-golden-bull.png",
    guardianTitle: "Golden Bull Sentinel",
    contentAlign: "right",
    overlayStrength: 0.92,
  },
  "Founder 88": {
    image: "/founders/banners/founder-88-dragon-lion.png",
    guardianTitle: "Dragon-Lion Sentinel",
    contentAlign: "right",
    overlayStrength: 0.8,
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
  // The beast sits left-of-center in both approved assets, so the gradient
  // must concentrate its darkness on the text-safe side (here, the right)
  // and fade toward transparent over the beast — never the reverse.
  const gradientDirection = banner.contentAlign === "right" ? "to left" : "to right";
  const s = banner.overlayStrength;
  const overlay = `linear-gradient(${gradientDirection}, rgba(10,9,7,${s}) 0%, rgba(10,9,7,${s * 0.8}) 35%, rgba(10,9,7,${s * 0.35}) 62%, transparent 85%)`;

  return (
    <section
      // The "founder-hero-active" class is a pure CSS hook (see globals.css)
      // that suppresses AppShell's ambient .gold-pour beam via :has() — that
      // beam renders unconditionally at the top of every dashboard page's
      // <main>, so without this the old hero glow bleeds through above this
      // banner. It carries no styling of its own.
      className="founder-hero-active relative flex flex-col justify-center overflow-hidden rounded-2xl border border-border-strong px-6 py-8 sm:px-10 sm:py-10"
      style={{
        backgroundImage: `${overlay}, url(${banner.image})`,
        backgroundSize: "cover",
        backgroundPosition: "left center",
        minHeight: "220px",
      }}
    >
      {/* Mobile: deepen the wash so the guardian reads as a low-opacity background,
          never a tiny foreground thumbnail competing with the greeting. */}
      <div className="absolute inset-0 bg-bg/70 sm:hidden" aria-hidden="true" />

      <div
        className={
          banner.contentAlign === "right"
            ? "relative z-10 w-full sm:ml-auto sm:max-w-md"
            : "relative z-10 w-full sm:max-w-md"
        }
      >
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
