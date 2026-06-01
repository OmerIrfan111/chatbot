"use client";

/* Ambient chartreuse corner glows — aria-hidden, pointer-events-none.
   Soft, low-opacity light bleeding from the edges (reference aesthetic). */
const GLOWS = [
  { size: 460, top: "-14%", left: "-10%", delay: "0s" },
  { size: 380, top: "62%", left: "82%", delay: "2.5s" },
] as const;

export function FloatingDecorations() {
  return (
    <div className="pointer-events-none select-none overflow-hidden fixed inset-0 z-0" aria-hidden="true">
      {GLOWS.map((g, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-glow-drift"
          style={{
            width: g.size,
            height: g.size,
            top: g.top,
            left: g.left,
            background: "var(--accent)",
            opacity: 0.16,
            filter: "blur(120px)",
            animationDelay: g.delay,
          }}
        />
      ))}
    </div>
  );
}
