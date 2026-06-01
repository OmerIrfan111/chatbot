"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, ArrowUpRight, Sparkles } from "lucide-react";
import { fetchSuggestions } from "@/lib/api";

const FALLBACK_PROMPTS = [
  "What does a specific section of my document say?",
  "Summarize the uploaded document for me",
  "Pull the key facts from my files in one paragraph",
  "How do the documents answer a specific question?",
];

interface EmptyStateProps {
  onSuggestion: (q: string) => void;
  hasDocuments: boolean;
}

export function EmptyState({ onSuggestion, hasDocuments }: EmptyStateProps) {
  const [prompts, setPrompts] = useState<string[]>(FALLBACK_PROMPTS);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasDocuments) return;
    fetchSuggestions(4)
      .then((qs) => {
        if (!cancelled && qs.length > 0) {
          setPrompts(qs);
          setAiGenerated(true);
        }
      })
      .catch(() => {/* keep fallback prompts */});
    return () => {
      cancelled = true;
    };
  }, [hasDocuments]);

  const refresh = () => setPrompts((p) => [...p.slice(1), p[0]]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 max-w-4xl w-full mx-auto text-center">
      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="display-xl text-[clamp(2.4rem,5.2vw,4rem)] text-[var(--ink)]"
      >
        Hello, I&apos;m Mutex
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.14 }}
        className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--ink-soft)]"
      >
        {hasDocuments
          ? "Your AI-powered support assistant, answering strictly from your documents with cited sources. Ask anything below, or start with a suggestion."
          : "Your AI-powered support assistant. Upload a document with the folder icon, then ask anything, every answer is grounded in your sources and cited."}
      </motion.p>

      {/* Suggestion rows */}
      {hasDocuments && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mt-10 w-full max-w-2xl"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {prompts.map((text, i) => (
              <motion.button
                key={text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26 + i * 0.05, duration: 0.3 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSuggestion(text)}
                className="group flex items-center justify-between gap-3 text-left rounded-2xl bg-[var(--surface)] border border-[var(--line)] px-4 py-3.5 hover:border-[var(--ink)] transition-colors"
              >
                <span className="text-[13px] font-medium text-[var(--ink)] leading-snug">{text}</span>
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-faint)] group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-ink)] transition-colors">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </motion.button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Shuffle prompts
            </button>
            {aiGenerated && (
              <span className="flex items-center gap-1 text-xs text-[var(--ink-faint)]">
                <Sparkles className="h-3.5 w-3.5" />
                Suggested from your documents
              </span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
