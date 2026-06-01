"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { streamChat } from "@/lib/api";
import { useChatStore } from "@/store/chat";

export function useChat() {
  const {
    messages,
    isStreaming,
    sessionId,
    addUserMessage,
    addAssistantPlaceholder,
    appendToken,
    finalizeAssistant,
    setStreaming,
    clearMessages,
  } = useChatStore();

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;

      addUserMessage(question);
      const assistantId = addAssistantPlaceholder();
      setStreaming(true);

      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        for await (const event of streamChat({ question, session_id: sessionId, chat_history: history })) {
          if (event.type === "token") {
            appendToken(assistantId, event.content);
          } else if (event.type === "done") {
            finalizeAssistant(assistantId, event.sources, event.confidence);
          } else if (event.type === "error") {
            finalizeAssistant(assistantId, [], 0);
            toast.error(event.message || "Something went wrong.");
          }
        }
      } catch (err) {
        finalizeAssistant(assistantId, [], 0);
        toast.error(err instanceof Error ? err.message : "Connection failed.");
      } finally {
        setStreaming(false);
      }
    },
    [messages, isStreaming, sessionId, addUserMessage, addAssistantPlaceholder, appendToken, finalizeAssistant, setStreaming]
  );

  return { messages, isStreaming, sendMessage, clearMessages };
}
