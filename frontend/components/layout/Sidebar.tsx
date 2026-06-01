"use client";

import { Zap } from "lucide-react";
import { Dropzone } from "@/components/upload/Dropzone";
import { DocumentList } from "@/components/upload/DocumentList";
import { ThemeToggle } from "./ThemeToggle";
import { useUpload } from "@/lib/hooks/useDocuments";

export function Sidebar() {
  const { pending, upload } = useUpload();

  return (
    <aside
      className="relative flex flex-col h-full w-72 shrink-0 z-10 overflow-hidden"
      style={{
        background: "#0A0815",
        borderRight: "3px solid #FF3AF2",
        boxShadow: "4px 0 30px rgba(255,58,242,0.2)",
      }}
    >
      {/* Sidebar pattern overlay */}
      <div className="pointer-events-none absolute inset-0 pattern-dots-cy opacity-30" aria-hidden />

      {/* Header */}
      <div
        className="relative flex items-center justify-between px-4 h-14 shrink-0"
        style={{ borderBottom: "2px solid rgba(255,58,242,0.3)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center animate-mx-pulse-glow shrink-0"
            style={{
              background: "linear-gradient(135deg, #FF3AF2, #7B2FFF)",
              boxShadow: "0 0 16px rgba(255,58,242,0.6)",
            }}
          >
            <Zap className="h-4 w-4 text-white" fill="white" />
          </div>
          <span
            className="text-sm font-black uppercase tracking-widest text-[#FAFAFF]"
            style={{ textShadow: "0 0 10px rgba(255,58,242,0.5)" }}
          >
            Support AI
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Scrollable body */}
      <div className="relative flex-1 overflow-y-auto p-4 space-y-5">

        {/* Upload section */}
        <section>
          <p
            className="text-[11px] font-black uppercase tracking-[0.2em] mb-3"
            style={{ color: "#FF3AF2", textShadow: "0 0 8px rgba(255,58,242,0.5)" }}
          >
            Documents
          </p>
          <Dropzone onDrop={upload} pending={pending} />
        </section>

        {/* Divider */}
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, #FF3AF2, #00F5D4, transparent)" }}
        />

        {/* Document list */}
        <section>
          <p
            className="text-[11px] font-black uppercase tracking-[0.2em] mb-3"
            style={{ color: "#00F5D4", textShadow: "0 0 8px rgba(0,245,212,0.5)" }}
          >
            Indexed
          </p>
          <DocumentList />
        </section>
      </div>

      {/* Footer */}
      <div
        className="relative px-4 py-3 shrink-0 text-center"
        style={{ borderTop: "2px solid rgba(255,58,242,0.2)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#FAFAFF]/40">
          Grounded · No hallucinations
        </p>
      </div>
    </aside>
  );
}
