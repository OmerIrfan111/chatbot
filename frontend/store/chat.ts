"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChatMessage, Source } from "@/lib/types";

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionId: string;

  addUserMessage: (content: string) => string;
  addAssistantPlaceholder: () => string;
  appendToken: (id: string, token: string) => void;
  finalizeAssistant: (id: string, sources: Source[], confidence: number) => void;
  setStreaming: (v: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,
  sessionId: nanoid(),

  addUserMessage: (content) => {
    const id = nanoid();
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: "user", content, timestamp: new Date() },
      ],
    }));
    return id;
  },

  addAssistantPlaceholder: () => {
    const id = nanoid();
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id,
          role: "assistant",
          content: "",
          streaming: true,
          timestamp: new Date(),
        },
      ],
    }));
    return id;
  },

  appendToken: (id, token) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m
      ),
    }));
  },

  finalizeAssistant: (id, sources, confidence) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false, sources, confidence } : m
      ),
    }));
  },

  setStreaming: (v) => set({ isStreaming: v }),

  clearMessages: () => set({ messages: [] }),
}));
