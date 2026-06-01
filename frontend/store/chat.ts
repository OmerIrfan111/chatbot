"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChatMessage, ConflictWarning, Source } from "@/lib/types";

interface FinalizePayload {
  sources: Source[];
  confidence: number;
  low_confidence_warning: boolean;
  conflict_warning: ConflictWarning | null;
  interaction_id: number | null;
  language?: string;
  escalation_offered?: boolean;
}

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionId: string;

  addUserMessage: (content: string) => string;
  addAssistantPlaceholder: () => string;
  appendToken: (id: string, token: string) => void;
  finalizeAssistant: (id: string, payload: FinalizePayload) => void;
  setFeedback: (id: string, rating: 1 | -1) => void;
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
      messages: [...s.messages, { id, role: "user", content, timestamp: new Date() }],
    }));
    return id;
  },

  addAssistantPlaceholder: () => {
    const id = nanoid();
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: "assistant", content: "", streaming: true, timestamp: new Date() },
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

  finalizeAssistant: (id, payload) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              streaming: false,
              sources: payload.sources,
              confidence: payload.confidence,
              low_confidence_warning: payload.low_confidence_warning,
              conflict_warning: payload.conflict_warning,
              interaction_id: payload.interaction_id,
              language: payload.language,
              escalation_offered: payload.escalation_offered,
              feedback: null,
            }
          : m
      ),
    }));
  },

  setFeedback: (id, rating) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, feedback: rating } : m
      ),
    }));
  },

  setStreaming: (v) => set({ isStreaming: v }),
  clearMessages: () => set({ messages: [] }),
}));
