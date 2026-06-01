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
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No documents yet.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <AnimatePresence>
        {documents.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8, height: 0 }}
            transition={{ duration: 0.15 }}
            className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{doc.filename}</p>
              <p className="text-[10px] text-muted-foreground">{doc.chunk_count} chunks</p>
            </div>
            <button
              onClick={() => deleteDoc(doc.id)}
              aria-label={`Remove ${doc.filename}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:text-red-400 text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
