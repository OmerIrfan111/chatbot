"use client";

import { useRef, useState, useCallback, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [value, isStreaming, disabled, onSend]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div
      className="px-4 py-3 shrink-0"
      style={{ borderTop: "2px solid rgba(255,58,242,0.25)", background: "rgba(13,13,26,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="flex items-end gap-3 rounded-2xl px-4 py-3 border-2 transition-all duration-300"
        style={{
          background: disabled ? "rgba(45,27,78,0.3)" : "rgba(45,27,78,0.5)",
          borderColor: focused ? "#00F5D4" : "rgba(255,58,242,0.45)",
          boxShadow: focused
            ? "0 0 24px rgba(0,245,212,0.3), 0 0 48px rgba(0,245,212,0.1)"
            : "0 0 12px rgba(255,58,242,0.15)",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={disabled ? "Upload a document to begin…" : "Ask anything… (Enter to send)"}
          rows={1}
          disabled={disabled || isStreaming}
          className="flex-1 resize-none bg-transparent text-sm font-medium outline-none min-h-[24px] max-h-[200px] leading-6 py-0 disabled:cursor-not-allowed"
          style={{
            color: "#FAFAFF",
            caretColor: "#FF3AF2",
          }}
          aria-label="Chat input"
        />

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!canSend}
          aria-label={isStreaming ? "Stop" : "Send message"}
          className="shrink-0 flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 border-2"
          style={
            canSend
              ? {
                  background: "linear-gradient(135deg, #FF3AF2, #7B2FFF)",
                  borderColor: "#FFE600",
                  boxShadow: "0 0 16px rgba(255,58,242,0.5), 3px 3px 0 #7B2FFF",
                  color: "#FAFAFF",
                }
              : {
                  background: "rgba(45,27,78,0.5)",
                  borderColor: "rgba(255,58,242,0.2)",
                  color: "rgba(250,250,255,0.3)",
                  cursor: "not-allowed",
                }
          }
        >
          {isStreaming
            ? <Square className="h-3.5 w-3.5 fill-current" />
            : <Send   className="h-3.5 w-3.5" />}
        </motion.button>
      </div>

      <p
        className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "rgba(250,250,255,0.25)" }}
      >
        Answers grounded in your docs · No hallucinations
      </p>
    </div>
  );
}
