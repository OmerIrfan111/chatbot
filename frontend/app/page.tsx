"use client";

import { useState } from "react";
import { IconSidebar } from "@/components/layout/IconSidebar";
import { DocumentPanel } from "@/components/layout/DocumentPanel";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useDocuments } from "@/lib/hooks/useDocuments";

export default function Home() {
  const { documents } = useDocuments();
  const hasDocuments = documents.length > 0;
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#EBEBEB]">
      <IconSidebar onFolderClick={() => setDocsOpen((v) => !v)} folderActive={docsOpen} />
      <DocumentPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
      <main className="flex-1 min-w-0 min-h-0">
        <ChatWindow hasDocuments={hasDocuments} />
      </main>
    </div>
  );
}
