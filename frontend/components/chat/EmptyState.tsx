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

/* Metallic 4-point star — the brand motif, echoing the logo. */
function StarMotif() {
  const star =
    "M110 6 C118 70 150 102 214 110 C150 118 118 150 110 214 C102 150 70 118 6 110 C70 102 102 70 110 6 Z";
  return (
    <div className="relative flex items-center justify-center">
      {/* ambient chartreuse glow */}
      <div
        aria-hidden
        className="absolute h-48 w-48 rounded-full animate-glow-drift"
        style={{ background: "var(--accent-glow)", filter: "blur(56px)" }}
      />
      <svg
        viewBox="0 0 220 220"
        className="relative h-28 w-28 animate-star-float"
        style={{ filter: "drop-shadow(0 18px 30px rgba(20,20,16,0.18))" }}
        aria-hidden
      >
        <defs>
          <linearGradient id="metal" x1="0.2" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ECECE6" />
            <stop offset="64%" stopColor="#A6A69E" />
            <stop offset="100%" stopColor="#D2D2CA" />
          </linearGradient>
          <radialGradient id="sheen" cx="0.36" cy="0.30" r="0.7">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={star} fill="url(#metal)" />
        <path d={star} fill="url(#sheen)" />
      </svg>
    </div>
  );
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
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7"
      >
        <StarMotif />
      </motion.div>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="display-xl text-[clamp(2.6rem,6vw,4.6rem)] text-[var(--ink)]"
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
