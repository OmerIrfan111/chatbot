"use client";

import { useRef, useState, useCallback, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="p-4 border-t border-border bg-background/80 backdrop-blur-sm">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-card px-4 py-3 transition-colors",
          "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10",
          disabled && "opacity-50"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "Upload a document to begin…" : "Ask a question… (Enter to send, Shift+Enter for newline)"}
          rows={1}
          disabled={disabled || isStreaming}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground",
            "min-h-[24px] max-h-[200px] leading-6 py-0 disabled:cursor-not-allowed"
          )}
          aria-label="Chat input"
        />

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          disabled={!canSend}
          aria-label={isStreaming ? "Stop" : "Send message"}
          className={cn(
            "shrink-0 flex items-center justify-center h-8 w-8 rounded-xl transition-all",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isStreaming
            ? <Square className="h-3.5 w-3.5 fill-current" />
            : <Send className="h-3.5 w-3.5" />}
        </motion.button>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Answers are grounded in your documents — no hallucinations.
      </p>
    </div>
  );
}
