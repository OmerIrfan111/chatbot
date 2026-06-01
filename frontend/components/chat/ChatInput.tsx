"use client";

import { useRef, useState, useCallback, KeyboardEvent } from "react";
import { Paperclip, ImageIcon, ArrowRight, Globe, ChevronDown, Square } from "lucide-react";

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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const charCount = value.length;
  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="px-8 pb-6 max-w-3xl w-full mx-auto">
      <div className="bg-white rounded-2xl border border-[#E2E2E2] shadow-sm overflow-hidden">

        {/* Top row: textarea + All Web */}
        <div className="flex items-start gap-3 px-5 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
            onKeyDown={onKeyDown}
            placeholder={disabled ? "Upload a document to begin…" : "Ask whatever you want...."}
            rows={1}
            disabled={disabled || isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-[#1A1A1A] placeholder:text-[#AAAAAA] outline-none min-h-[24px] max-h-[180px] leading-6 py-0 disabled:cursor-not-allowed"
            aria-label="Chat input"
          />

          {/* All Web dropdown */}
          <button
            className="flex items-center gap-1 shrink-0 text-xs text-[#555555] hover:text-[#1A1A1A] bg-[#F3F3F3] hover:bg-[#E8E8E8] rounded-lg px-2.5 py-1.5 transition-colors mt-0.5"
            aria-label="Select search scope"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="font-medium">All Web</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Bottom row: actions + counter + send */}
        <div className="flex items-center gap-3 px-4 pb-3">
          {/* Attachment */}
          <button className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#1A1A1A] transition-colors">
            <Paperclip className="h-3.5 w-3.5" />
            <span>Add Attachment</span>
          </button>

          {/* Image */}
          <button className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#1A1A1A] transition-colors">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Use Image</span>
          </button>

          <div className="flex-1" />

          {/* Character count */}
          <span className="text-xs text-[#AAAAAA] tabular-nums">
            {charCount}/1000
          </span>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label={isStreaming ? "Stop" : "Send"}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-all"
            style={{
              background: canSend ? "#6B3AC6" : "#E2E2E2",
              color: canSend ? "white" : "#AAAAAA",
            }}
          >
            {isStreaming
              ? <Square className="h-3 w-3 fill-current" />
              : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
