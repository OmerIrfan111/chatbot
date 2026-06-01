"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Source } from "@/lib/types";

interface CitationChipProps {
  source: Source;
}

export function CitationChip({ source }: CitationChipProps) {
  const [expanded, setExpanded] = useState(false);

  const confidence = source.score;
  const chipColor =
    confidence >= 0.85
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : confidence >= 0.70
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : "border-red-500/30 bg-red-500/10 text-red-400";

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all w-full text-left",
          "hover:bg-muted/60",
          chipColor
        )}
        aria-expanded={expanded}
      >
        <FileText className="h-3 w-3 shrink-0" />
        <span className="truncate">{source.filename}</span>
        <span className="ml-auto text-[10px] opacity-70 shrink-0">p.{source.page}</span>
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="mt-1.5 px-3 py-2 text-xs text-muted-foreground bg-muted/40 rounded-lg border border-border leading-relaxed">
              {source.snippet}
              {source.snippet.length >= 200 && "…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
