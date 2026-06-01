"use client";

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--surface)] border border-[var(--line)] w-fit shadow-sm"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-[var(--ink-faint)] animate-typing"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </motion.div>
  );
}
