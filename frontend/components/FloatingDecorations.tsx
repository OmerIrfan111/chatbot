"use client";

/* Absolutely-positioned decorative shapes — aria-hidden, pointer-events-none */
const SHAPES = [
  { content: "✦", color: "#FF3AF2", size: "text-3xl", top: "8%",  left: "3%",  anim: "animate-mx-float",     delay: "0s"    },
  { content: "✦", color: "#00F5D4", size: "text-xl",  top: "15%", left: "92%", anim: "animate-mx-float-rev", delay: "0.5s"  },
  { content: "◆", color: "#FFE600", size: "text-2xl", top: "32%", left: "96%", anim: "animate-mx-wiggle",    delay: "0s"    },
  { content: "✦", color: "#7B2FFF", size: "text-4xl", top: "55%", left: "1%",  anim: "animate-mx-float",     delay: "1s"    },
  { content: "◆", color: "#FF6B35", size: "text-xl",  top: "70%", left: "94%", anim: "animate-mx-float-rev", delay: "0.8s"  },
  { content: "★", color: "#FF3AF2", size: "text-2xl", top: "85%", left: "4%",  anim: "animate-mx-wiggle",    delay: "0.3s"  },
  { content: "✦", color: "#00F5D4", size: "text-xl",  top: "92%", left: "89%", anim: "animate-mx-bounce",    delay: "1.2s"  },
  { content: "◆", color: "#FFE600", size: "text-3xl", top: "45%", left: "97%", anim: "animate-mx-float",     delay: "0.6s"  },
] as const;

export function FloatingDecorations() {
  return (
    <div className="pointer-events-none select-none" aria-hidden="true">
      {SHAPES.map((s, i) => (
        <span
          key={i}
          className={`absolute ${s.size} ${s.anim} opacity-70`}
          style={{
            color: s.color,
            top: s.top,
            left: s.left,
            animationDelay: s.delay,
            filter: `drop-shadow(0 0 8px ${s.color}88)`,
          }}
        >
          {s.content}
        </span>
      ))}
    </div>
  );
}
