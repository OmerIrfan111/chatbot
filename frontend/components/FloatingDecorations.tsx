"use client";

/* Subtle ambient background accents — aria-hidden, pointer-events-none.
   Soft, low-opacity brand-tone blobs (no neon) to keep the premium SaaS feel. */
const BLOBS = [
  { color: "#6B3AC6", size: 260, top: "-4%",  left: "-3%",  anim: "animate-mx-float",     delay: "0s"   },
  { color: "#9F7AEA", size: 180, top: "12%",  left: "88%",  anim: "animate-mx-float-rev", delay: "0.6s" },
  { color: "#C960D4", size: 220, top: "72%",  left: "90%",  anim: "animate-mx-float",     delay: "1s"   },
  { color: "#7134C9", size: 200, top: "82%",  left: "-4%",  anim: "animate-mx-float-rev", delay: "0.3s" },
] as const;

export function FloatingDecorations() {
  return (
    <div className="pointer-events-none select-none overflow-hidden fixed inset-0" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className={`absolute rounded-full ${b.anim}`}
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: b.color,
            opacity: 0.06,
            filter: "blur(60px)",
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}
