/**
 * AMG starburst mark — a radiant golden asterisk echoing the company logo.
 * Pure SVG so it scales crisply and can be tinted via `color`.
 */
export function Starburst({
  size = 28,
  className = "",
  rays = 12,
}: {
  size?: number;
  className?: string;
  rays?: number;
}) {
  const c = size / 2;
  const inner = size * 0.12;
  const outer = size * 0.48;
  // Round to fixed precision so server and client render identical strings
  // (raw floats serialize differently across environments → hydration mismatch).
  const r3 = (n: number) => Number(n.toFixed(3));
  const lines = Array.from({ length: rays }, (_, i) => {
    const a = (Math.PI * 2 * i) / rays - Math.PI / 2;
    return {
      x1: r3(c + Math.cos(a) * inner),
      y1: r3(c + Math.sin(a) * inner),
      x2: r3(c + Math.cos(a) * outer),
      y2: r3(c + Math.sin(a) * outer),
    };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      fill="none"
      aria-hidden
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="currentColor"
          strokeWidth={r3(size * 0.045)}
          strokeLinecap="round"
        />
      ))}
      <circle cx={c} cy={c} r={r3(size * 0.06)} fill="currentColor" />
    </svg>
  );
}
