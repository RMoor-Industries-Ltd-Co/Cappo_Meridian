/**
 * AMG brand mark — layered chevron "peaks" recreated as SVG so it scales
 * crisply and inherits color (use `text-gold`). `AmgLogo` is the full lockup
 * with the wordmark; `AmgMark` is just the peaks (for the collapsed rail).
 */
export function AmgMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={(size * 78) / 100}
      viewBox="0 0 100 78"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      {/* upper peak */}
      <path d="M50 4 L95 62 L73 62 L50 26 L27 62 L5 62 Z" />
      {/* lower echo peak (wider, thinner) */}
      <path d="M50 30 L99 74 L83 74 L50 44 L17 74 L1 74 Z" />
    </svg>
  );
}

export function AmgLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <AmgMark size={64} className="text-gold" />
      <div className="flex flex-col items-center leading-none">
        <span className="text-gradient-gold text-2xl font-extrabold tracking-tight">
          AMG
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-gold/80">
          Apex Meridian Group
        </span>
      </div>
    </div>
  );
}
