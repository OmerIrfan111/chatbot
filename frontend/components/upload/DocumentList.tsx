"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/lib/hooks/useDocuments";

const ACCENT_COLORS = ["#FF3AF2", "#00F5D4", "#FFE600", "#FF6B35", "#7B2FFF"] as const;

export function DocumentList() {
  const { documents, isLoading, deleteDoc } = useDocuments();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" style={{ background: "rgba(45,27,78,0.5)" }} />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="text-xs font-medium text-center py-4" style={{ color: "rgba(250,250,255,0.35)" }}>
        No documents yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {documents.map((doc, i) => {
          const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
          return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: `${color}0D`,
                borderColor: `${color}55`,
                boxShadow: `4px 4px 0 ${color}33`,
              }}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#FAFAFF] truncate">{doc.filename}</p>
                <p className="text-[10px] font-medium" style={{ color: `${color}99` }}>
                  {doc.chunk_count} chunks
                </p>
              </div>
              <button
                onClick={() => deleteDoc(doc.id)}
                aria-label={`Remove ${doc.filename}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                style={{ color: "#FF6B35" }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
