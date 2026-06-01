"use client";

import { useRef, useState, useCallback, KeyboardEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Square, Paperclip, Loader2 } from "lucide-react";
import { useUpload } from "@/lib/hooks/useDocuments";

const MAX_CHARS = 1000;

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isStreaming, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, pending } = useUpload();

  const uploading = pending.some((p) => p.status === "uploading" || p.status === "processing");

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
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

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="px-6 pb-5 max-w-3xl w-full mx-auto">
      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 2px #6B3AC640, 0 4px 16px rgba(0,0,0,0.08)"
            : "0 1px 4px rgba(0,0,0,0.06)",
        }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl border border-[#E2E2E2] overflow-hidden"
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            maxLength={MAX_CHARS}
            onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={disabled ? "Upload a document to begin" : "Ask whatever you want..."}
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-[#1A1A1A] placeholder:text-[#AAAAAA] outline-none min-h-[24px] max-h-[180px] leading-6 py-0 disabled:cursor-not-allowed"
            aria-label="Chat input"
          />
        </div>

        {/* Hidden file input — real document upload */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.docx,.csv,.md,.html,.htm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload([f]);
            e.target.value = "";
          }}
        />

        <div className="flex items-center gap-3 px-4 pb-3">
          {/* Upload a document (wired to the real ingest endpoint) */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#1A1A1A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Paperclip className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{uploading ? "Uploading…" : "Upload document"}</span>
          </button>

          <div className="flex-1" />

          <AnimatePresence mode="wait">
            {value.length > 0 && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-xs text-[#AAAAAA] tabular-nums overflow-hidden"
              >
                {value.length}/{MAX_CHARS}
              </motion.span>
            )}
          </AnimatePresence>

          <motion.button
            onClick={handleSend}
            disabled={!canSend}
            aria-label={isStreaming ? "Streaming" : "Send"}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
            style={{
              background: canSend ? "#6B3AC6" : "#E2E2E2",
              color: canSend ? "white" : "#AAAAAA",
            }}
            whileHover={canSend ? { scale: 1.05 } : {}}
            whileTap={canSend ? { scale: 0.92 } : {}}
          >
            {isStreaming
              ? <Square className="h-3 w-3 fill-current" />
              : <ArrowRight className="h-4 w-4" />}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
