"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { Message } from "./Message";
import { EmptyState } from "./EmptyState";
import { ChatInput } from "./ChatInput";
import { useChat } from "@/lib/hooks/useChat";
import type { ChatMessage } from "@/lib/types";

interface ChatWindowProps { hasDocuments: boolean; }

export function ChatWindow({ hasDocuments }: ChatWindowProps) {
  const { messages, isStreaming, sendMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#EBEBEB]">
      <div className="flex-1 overflow-y-auto scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={sendMessage} hasDocuments={hasDocuments} />
        ) : (
          <div className="flex flex-col gap-4 px-8 py-6">
            <AnimatePresence initial={false}>
              {messages.map((msg: ChatMessage) => (
                <Message key={msg.id} message={msg} />
              ))}
            </AnimatePresence>
            <div ref={bottomRef} className="h-1" />
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} isStreaming={isStreaming} disabled={!hasDocuments} />
    </div>
  );
}
