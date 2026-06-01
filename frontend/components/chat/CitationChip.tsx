"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown } from "lucide-react";
import type { Source } from "@/lib/types";

const scoreStyle = (s: number) =>
  s >= 0.85
    ? { color: "#00F5D4", border: "rgba(0,245,212,0.5)",  bg: "rgba(0,245,212,0.08)",  shadow: "#00F5D4" }
    : s >= 0.70
    ? { color: "#FFE600", border: "rgba(255,230,0,0.5)",  bg: "rgba(255,230,0,0.08)",  shadow: "#FFE600" }
    : { color: "#FF6B35", border: "rgba(255,107,53,0.5)", bg: "rgba(255,107,53,0.08)", shadow: "#FF6B35" };

interface CitationChipProps { source: Source; }

export function CitationChip({ source }: CitationChipProps) {
  const [expanded, setExpanded] = useState(false);
  const s = scoreStyle(source.score);

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold w-full text-left transition-all duration-200 hover:scale-[1.01]"
        style={{
          color: s.color,
          background: s.bg,
          borderColor: s.border,
          boxShadow: `3px 3px 0 ${s.shadow}33`,
        }}
        aria-expanded={expanded}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{source.filename}</span>
        <span className="ml-auto text-[10px] opacity-70 shrink-0">p.{source.page}</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p
              className="mt-1.5 px-3 py-2.5 text-xs rounded-xl border-2 leading-relaxed"
              style={{
                color: "rgba(250,250,255,0.75)",
                background: "rgba(45,27,78,0.5)",
                borderColor: s.border,
              }}
            >
              {source.snippet}
              {source.snippet.length >= 200 && "…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
