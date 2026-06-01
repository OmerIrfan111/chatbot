"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, User, Mail, FileText, Sliders, Sparkles } from "lucide-react";
import { fetchSuggestions } from "@/lib/api";

const CARD_ICONS = [
  <User key="i0" className="h-5 w-5" />,
  <Mail key="i1" className="h-5 w-5" />,
  <FileText key="i2" className="h-5 w-5" />,
  <Sliders key="i3" className="h-5 w-5" />,
];

const FALLBACK_PROMPTS = [
  "Ask what a specific section of your document says",
  "Generate a summary of the uploaded document",
  "Find key information from your files in one paragraph",
  "How does this document answer a specific question?",
];

interface EmptyStateProps {
  onSuggestion: (q: string) => void;
  hasDocuments: boolean;
}

export function EmptyState({ onSuggestion, hasDocuments }: EmptyStateProps) {
  const [prompts, setPrompts] = useState<string[]>(FALLBACK_PROMPTS);
  const [aiGenerated, setAiGenerated] = useState(false);

  // Pull auto-suggested starter questions for the current document set.
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

  const refresh = () => {
    setPrompts((p) => [...p.slice(1), p[0]]);
  };

  return (
    <div className="flex flex-1 flex-col justify-center px-8 py-10 max-w-3xl w-full mx-auto">

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mb-2"
      >
        <h1 className="text-[2.6rem] font-bold leading-tight tracking-tight text-[#1A1A1A]">
          Hi there,{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #7134C9 0%, #C960D4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {hasDocuments ? "User" : "there"}
          </span>
        </h1>
        <h1 className="text-[2.6rem] font-bold leading-tight tracking-tight">
          <span className="text-[#1A1A1A]">What would </span>
          <span
            style={{
              background: "linear-gradient(90deg, #7134C9 0%, #C960D4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            like to know?
          </span>
        </h1>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07, duration: 0.3 }}
        className="text-sm text-[#888888] mb-8 leading-snug"
      >
        {hasDocuments
          ? "Use one of the most common prompts below or use your own to begin"
          : "Upload a document using the folder icon, then ask questions about it"}
      </motion.p>

      {/* Prompt cards */}
      {hasDocuments && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="grid grid-cols-4 gap-3 mb-4"
          >
            {prompts.map((text, i) => (
              <motion.button
                key={text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05, duration: 0.25 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSuggestion(text)}
                className="flex flex-col justify-between text-left p-4 rounded-2xl bg-white border border-[#E8E8E8] hover:border-[#CCCCCC] hover:shadow-sm transition-all min-h-[110px]"
              >
                <p className="text-xs font-medium text-[#1A1A1A] leading-relaxed">{text}</p>
                <span className="text-[#CCCCCC] mt-3">{CARD_ICONS[i % CARD_ICONS.length]}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Refresh / source hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#1A1A1A] transition-colors w-fit"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh Prompts
            </button>
            {aiGenerated && (
              <span className="flex items-center gap-1 text-xs text-[#A78BFA]">
                <Sparkles className="h-3.5 w-3.5" />
                Suggested from your documents
              </span>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
