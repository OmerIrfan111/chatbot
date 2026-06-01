"use client";

import { motion } from "framer-motion";

const STARTERS = [
  { q: "What is the return and refund policy?",  color: "#FF3AF2", shadow: "#7B2FFF" },
  { q: "How do I get started with the product?", color: "#00F5D4", shadow: "#FF3AF2" },
  { q: "What are the system requirements?",       color: "#FFE600", shadow: "#FF6B35" },
  { q: "How can I contact support?",              color: "#FF6B35", shadow: "#FFE600" },
];

interface EmptyStateProps { onSuggestion: (q: string) => void; hasDocuments: boolean; }

export function EmptyState({ onSuggestion, hasDocuments }: EmptyStateProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-8 py-12 overflow-hidden select-none">

      {/* Ghost background word */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden"
        aria-hidden
      >
        <span
          className="text-[11rem] font-black uppercase tracking-tighter leading-none opacity-[0.04] whitespace-nowrap"
          style={{ color: "#FF3AF2", fontFamily: "var(--font-outfit)" }}
        >
          {hasDocuments ? "ASK" : "UPLOAD"}
        </span>
      </div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative text-center mb-4"
      >
        <h2
          className="text-5xl font-black uppercase leading-none tracking-tighter"
          style={{
            fontFamily: "var(--font-outfit)",
            color: "#FF3AF2",
            textShadow: "3px 3px 0 #7B2FFF, 6px 6px 0 #00F5D4",
          }}
        >
          AI Support
        </h2>
        <h2
          className="text-5xl font-black uppercase leading-none tracking-tighter"
          style={{
            fontFamily: "var(--font-outfit)",
            color: "#00F5D4",
            textShadow: "3px 3px 0 #FF3AF2, 6px 6px 0 #FFE600",
          }}
        >
          Agent
        </h2>
      </motion.div>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
        className="text-sm font-medium text-center max-w-xs mb-8 leading-relaxed"
        style={{ color: "rgba(250,250,255,0.6)" }}
      >
        {hasDocuments
          ? "Ask anything about your uploaded documents. Answers grounded strictly in your content."
          : "Upload a document in the sidebar, then ask questions about its content."}
      </motion.p>

      {/* Suggestion chips */}
      {hasDocuments && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="flex flex-col gap-3 w-full max-w-sm"
        >
          <p
            className="text-[10px] font-black uppercase tracking-[0.25em] text-center mb-1"
            style={{ color: "#FFE600" }}
          >
            Try asking
          </p>
          {STARTERS.map(({ q, color, shadow }, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22 + i * 0.06, duration: 0.3, ease: "easeOut" }}
              whileHover={{ scale: 1.025, x: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSuggestion(q)}
              className="w-full text-left text-sm font-bold px-4 py-3 rounded-2xl border-2 transition-all"
              style={{
                color: "#FAFAFF",
                background: `${color}10`,
                borderColor: `${color}55`,
                boxShadow: `4px 4px 0 ${shadow}44`,
              }}
            >
              {q}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
