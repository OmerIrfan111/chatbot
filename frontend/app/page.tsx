"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useDocuments } from "@/lib/hooks/useDocuments";

export default function Home() {
  const { documents } = useDocuments();
  const hasDocuments = documents.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <header className="flex items-center px-6 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">Chat</h1>
            {hasDocuments && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {documents.length} doc{documents.length !== 1 ? "s" : ""} indexed
              </span>
            )}
          </div>
        </header>

        <ChatWindow hasDocuments={hasDocuments} />
      </main>
    </div>
  );
}
