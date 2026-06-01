"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/lib/hooks/useDocuments";

export function DocumentList() {
  const { documents, isLoading, deleteDoc } = useDocuments();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (documents.length === 0) {
    return <p className="text-xs text-[var(--ink-faint)] text-center py-3">No documents yet.</p>;
  }

  return (
    <div className="space-y-1">
      <AnimatePresence>
        {documents.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6, height: 0 }}
            className="group flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--ink-soft)]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--ink)] truncate">{doc.filename}</p>
              <p className="text-[10px] text-[var(--ink-faint)]">{doc.chunk_count} chunks</p>
            </div>
            <button
              onClick={() => deleteDoc(doc.id)}
              aria-label={`Remove ${doc.filename}`}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-500 text-[var(--ink-faint)] transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
