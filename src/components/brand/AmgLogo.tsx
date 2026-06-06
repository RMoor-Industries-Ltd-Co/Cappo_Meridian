import Image from "next/image";

/**
 * Official AMG brand assets (uploaded to /public).
 * - `AmgLogo`  — full lockup (peaks + wordmark), for spacious places (sign-in).
 * - `AmgMark`  — just the peaks (cropped from the lockup), for the compact rail.
 */

const LOGO_SRC = "/AMG-logo_000full.png";

export function AmgLogo({
  width = 176,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Apex Meridian Group"
      width={width}
      height={width}
      priority
      className={className}
    />
  );
}

export function AmgMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // Show only the top ~58% of the square lockup so just the peaks render.
  const h = Math.round(size * 0.58);
  return (
    <span
      className={`block overflow-hidden ${className}`}
      style={{ width: size, height: h }}
      aria-label="AMG"
    >
      <Image
        src={LOGO_SRC}
        alt="AMG"
        width={size}
        height={size}
        className="block"
      />
    </span>
  );
}
