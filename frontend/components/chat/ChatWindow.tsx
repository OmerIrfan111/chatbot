"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Message } from "./Message";
import { EmptyState } from "./EmptyState";
import { ChatInput } from "./ChatInput";
import { useChat } from "@/lib/hooks/useChat";
import type { ChatMessage } from "@/lib/types";

interface ChatWindowProps { hasDocuments: boolean; }

export function ChatWindow({ hasDocuments }: ChatWindowProps) {
  const { messages, isStreaming, sendMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  useEffect(() => {
    if (isStreaming) {
      scrollToBottom(true);
    }
  }, [isStreaming, messages]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-transparent">
      <div ref={containerRef} className="flex-1 overflow-y-auto scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={sendMessage} hasDocuments={hasDocuments} />
        ) : (
          <div className="flex flex-col gap-3 px-6 py-5 max-w-3xl mx-auto w-full">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((msg: ChatMessage) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.2,
                    delay: msg.role === "assistant" && !msg.streaming && msg.content ? 0.05 : 0,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                >
                  <Message message={msg} />
                </motion.div>
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
