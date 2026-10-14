import Image from "next/image";
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
 * `imageSize` is each asset's native pixel size, used so the full-bleed
 * guardian-breakout layout (desktop) can reserve exact, uncropped layout
 * space for it — see FounderHeroBanner below.
 */
const FOUNDER_BANNERS: Record<
  FounderLabel,
  {
    image: string;
    imageSize: { width: number; height: number };
    guardianTitle: string;
    contentAlign: "left" | "right";
    overlayStrength: number;
  }
> = {
  "Founder 55": {
    image: "/founders/banners/founder-55-golden-bull.png",
    imageSize: { width: 1916, height: 821 },
    guardianTitle: "Golden Bull Sentinel",
    contentAlign: "right",
    overlayStrength: 0.92,
  },
  "Founder 88": {
    image: "/founders/banners/founder-88-dragon-lion.png",
    imageSize: { width: 1916, height: 821 },
    guardianTitle: "Dragon-Lion Sentinel",
    contentAlign: "right",
    overlayStrength: 0.8,
  },
};

// Desktop "guardian breakout" veil height — see comment on the desktop stage
// below. Fixed (not responsive) so the room/text band reads consistently;
// the image itself still scales fluidly with the full-bleed width.
const VEIL_HEIGHT = 300;

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

  const content = (
    <>
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
    </>
  );
  const contentWrapClass =
    banner.contentAlign === "right" ? "w-full sm:ml-auto sm:max-w-md" : "w-full sm:max-w-md";

  return (
    // Full-bleed breakout (sm: and up only — see .founder-hero-breakout in
    // globals.css): escapes the dashboard content wrapper's max-width/padding
    // so the banner spans edge-to-edge of <main>'s own content box (which
    // already excludes the sidebar), using cqw units rather than vw so it
    // never bleeds under the sidebar.
    <div className="founder-hero-breakout">
      {/* Mobile (<sm): unchanged contained, low-opacity-wash card from #78/#79. */}
      <section
        // The "founder-hero-active" class is a pure CSS hook (see globals.css)
        // that suppresses AppShell's ambient .gold-pour beam via :has() — that
        // beam renders unconditionally at the top of every dashboard page's
        // <main>, so without this the old hero glow bleeds through above this
        // banner. It carries no other styling of its own.
        className="founder-hero-active relative flex min-h-[220px] flex-col justify-center overflow-hidden rounded-2xl border border-border-strong px-6 py-8 sm:hidden"
        style={{
          backgroundImage: `${overlay}, url(${banner.image})`,
          backgroundSize: "cover",
          backgroundPosition: "left center",
        }}
      >
        <div className="absolute inset-0 bg-bg/70" aria-hidden="true" />
        <div className={`relative z-10 ${contentWrapClass}`}>{content}</div>
      </section>

      {/*
        Desktop (sm+): "guardian breakout" stage. The approved asset is laid
        out as a normal, full-width, uncropped image — its own intrinsic
        aspect ratio (not a short "cover"-cropped banner box) sets the
        element's height, so the document flow already reserves exactly
        enough room for the whole guardian and the KPI row below it falls
        into place naturally, no manual overlap math. A fixed-height "veil"
        (the room/text band) sits on top of only the UPPER portion of that
        same image, carrying the dark gradient + greeting — the lower
        portion of the identical image continues undimmed beneath the veil,
        reading as the guardian stepping out of the banner's frame rather
        than being cropped inside it.
      */}
      <div className="founder-hero-active relative hidden sm:block">
        <Image
          src={banner.image}
          alt={`${banner.guardianTitle} — ${founderLabel}'s guardian spirit beast`}
          width={banner.imageSize.width}
          height={banner.imageSize.height}
          sizes="100vw"
          priority
          className="h-auto w-full select-none"
        />
        {/* Room/text veil — covers only the top VEIL_HEIGHT band, so the
            gradient darkening never reaches the guardian's lower body. No
            box-shadow here: a full-width drop shadow at the veil's bottom
            edge cast a visible dark band across the guardian at every
            brightness (most obvious on Founder 55's sunset-lit scene,
            where it read as an unintended smudge across the bull's neck),
            since the shadow ignored the gradient's own per-side fade and
            the asset's actual lighting. The gradient alone is the banner's
            frame. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: VEIL_HEIGHT, backgroundImage: overlay }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 z-10 flex flex-col justify-center px-12"
          style={{ height: VEIL_HEIGHT }}
        >
          <div className={contentWrapClass}>{content}</div>
        </div>
      </div>
    </div>
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
