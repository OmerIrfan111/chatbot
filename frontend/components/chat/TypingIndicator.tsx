"use client";

import { motion } from "framer-motion";

const DOT_COLORS = ["#FF3AF2", "#00F5D4", "#FFE600"] as const;

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm w-fit border-2"
      style={{
        background: "#120D22",
        borderColor: "#00F5D4",
        boxShadow: "4px 4px 0 #7B2FFF",
      }}
    >
      {DOT_COLORS.map((color, i) => (
        <span
          key={i}
          className="block h-2 w-2 rounded-full animate-mx-typing"
          style={{
            background: color,
            animationDelay: `${i * 0.2}s`,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ))}
    </motion.div>
  );
}
