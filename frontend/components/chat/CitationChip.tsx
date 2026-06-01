"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Source } from "@/lib/types";

interface CitationChipProps { source: Source; }

export function CitationChip({ source }: CitationChipProps) {
  const [expanded, setExpanded] = useState(false);
  const isHigh = source.score >= 0.85;
  const isMid  = source.score >= 0.70;
  const color  = isHigh ? "#16A34A" : isMid ? "#D97706" : "#DC2626";

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium w-full text-left transition-all",
          "bg-[#F8F8F8] border-[#E2E2E2] hover:bg-[#F0F0F0] text-[#555555]"
        )}
        aria-expanded={expanded}
      >
        <FileText className="h-3 w-3 shrink-0" style={{ color }} />
        <span className="truncate">{source.filename}</span>
        <span className="ml-auto text-[10px] text-[#AAAAAA] shrink-0">p.{source.page}</span>
        <ChevronDown
          className="h-3 w-3 shrink-0 transition-transform text-[#CCCCCC]"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="mt-1 px-3 py-2 text-xs text-[#555555] bg-[#F8F8F8] rounded-lg border border-[#E2E2E2] leading-relaxed">
              {source.snippet}{source.snippet.length >= 200 && "…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
