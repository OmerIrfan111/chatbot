"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dropzone } from "@/components/upload/Dropzone";
import { DocumentList } from "@/components/upload/DocumentList";
import { useUpload } from "@/lib/hooks/useDocuments";
import { Separator } from "@/components/ui/separator";

interface DocumentPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DocumentPanel({ open, onClose }: DocumentPanelProps) {
  const { pending, upload } = useUpload();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 268, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="relative z-10 shrink-0 flex flex-col h-full overflow-hidden bg-[var(--surface)] border-r border-[var(--line)]"
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--line)] shrink-0">
            <span className="text-sm font-semibold text-[var(--ink)]">Documents</span>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <section>
              <p className="text-[11px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">
                Upload
              </p>
              <Dropzone onDrop={upload} pending={pending} />
            </section>
            <Separator />
            <section>
              <p className="text-[11px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-2">
                Indexed
              </p>
              <DocumentList />
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
