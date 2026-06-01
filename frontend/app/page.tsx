"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { FloatingDecorations } from "@/components/FloatingDecorations";
import { useDocuments } from "@/lib/hooks/useDocuments";

export default function Home() {
  const { documents } = useDocuments();
  const hasDocuments = documents.length > 0;

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#0D0D1A]">
      {/* Global layered patterns */}
      <div className="pointer-events-none absolute inset-0 pattern-dots opacity-40" aria-hidden />
      <div className="pointer-events-none absolute inset-0 pattern-stripes" aria-hidden />
      <div className="pointer-events-none absolute inset-0 pattern-mesh" aria-hidden />
      <FloatingDecorations />

      {/* Left sidebar */}
      <Sidebar />

      {/* Main chat area */}
      <main className="relative flex-1 flex flex-col min-w-0 min-h-0 z-10">
        {/* Top bar */}
        <header className="flex items-center px-6 h-14 border-b-2 border-[rgba(255,58,242,0.3)] bg-[#0D0D1A]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h1
              className="text-sm font-black uppercase tracking-widest text-[#FAFAFF]"
              style={{ textShadow: "0 0 12px rgba(255,58,242,0.6)" }}
            >
              Chat
            </h1>
            {hasDocuments && (
              <span
                className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border-2"
                style={{
                  background: "rgba(0,245,212,0.12)",
                  border: "2px solid #00F5D4",
                  color: "#00F5D4",
                  boxShadow: "0 0 10px rgba(0,245,212,0.3)",
                }}
              >
                {documents.length} doc{documents.length !== 1 ? "s" : ""} ready
              </span>
            )}
          </div>
        </header>

        <ChatWindow hasDocuments={hasDocuments} />
      </main>
    </div>
  );
}
