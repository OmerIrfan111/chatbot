"use client";

import { Sparkles } from "lucide-react";
import { Dropzone } from "@/components/upload/Dropzone";
import { DocumentList } from "@/components/upload/DocumentList";
import { ThemeToggle } from "./ThemeToggle";
import { useUpload } from "@/lib/hooks/useDocuments";
import { Separator } from "@/components/ui/separator";

export function Sidebar() {
  const { pending, upload } = useUpload();

  return (
    <aside className="flex flex-col h-full w-72 shrink-0 border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Support Agent</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Upload zone */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Documents
          </p>
          <Dropzone onDrop={upload} pending={pending} />
        </section>

        <Separator />

        {/* Document list */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Indexed
          </p>
          <DocumentList />
        </section>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <p className="text-[10px] text-muted-foreground text-center">
          Grounded answers · No hallucinations
        </p>
      </div>
    </aside>
  );
}
