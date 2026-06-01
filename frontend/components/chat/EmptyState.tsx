"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const STARTERS = [
  "What is your return and refund policy?",
  "How do I get started with the product?",
  "What are the system requirements?",
  "How can I contact support?",
];

interface EmptyStateProps {
  onSuggestion: (q: string) => void;
  hasDocuments: boolean;
}

export function EmptyState({ onSuggestion, hasDocuments }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 select-none">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-6 relative"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl -z-10" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xl font-semibold text-foreground mb-2 text-center"
      >
        AI Support Agent
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-sm text-muted-foreground text-center max-w-xs mb-8 leading-relaxed"
      >
        {hasDocuments
          ? "Ask anything about your uploaded documents. Answers are grounded strictly in your content."
          : "Upload a document in the sidebar to get started, then ask questions about its content."}
      </motion.p>

      {hasDocuments && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-2 w-full max-w-sm"
        >
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center mb-1">
            Try asking
          </p>
          {STARTERS.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              onClick={() => onSuggestion(q)}
              className="w-full text-left text-sm px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted hover:border-primary/40 transition-all text-muted-foreground hover:text-foreground"
            >
              {q}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
