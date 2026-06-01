"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Bot, User, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CitationChip } from "./CitationChip";
import { TypingIndicator } from "./TypingIndicator";
import { submitFeedback } from "@/lib/api";
import { useChatStore } from "@/store/chat";
import type { ChatMessage } from "@/lib/types";

function ConfidenceBadge({ score }: { score: number }) {
  const isHigh = score >= 0.85;
  const isMid  = score >= 0.70;
  const color  = isHigh ? "#16A34A" : isMid ? "#D97706" : "#DC2626";
  const bg     = isHigh ? "#F0FDF4" : isMid ? "#FFFBEB" : "#FEF2F2";
  const label  = isHigh
    ? "High confidence — answer well-supported by documents"
    : isMid
    ? "Medium confidence — answer may be partially supported"
    : "Low confidence — verify this answer against source documents";

  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-default"
          style={{ color, background: bg, borderColor: `${color}33` }}
        >
          {Math.round(score * 100)}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[#F0F0F0] text-[#AAAAAA] hover:text-[#555555] transition-all"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function FeedbackButtons({ message }: { message: ChatMessage }) {
  const { setFeedback } = useChatStore();
  const [loading, setLoading] = useState(false);

  if (!message.interaction_id) return null;

  const vote = async (rating: 1 | -1) => {
    if (loading || message.feedback === rating) return;
    setLoading(true);
    try {
      await submitFeedback(message.interaction_id!, rating);
      setFeedback(message.id, rating);
    } catch {
      // Silently fail — feedback is non-critical
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
      <button
        onClick={() => vote(1)}
        aria-label="Helpful"
        className={`p-1.5 rounded-md transition-all ${
          message.feedback === 1
            ? "text-emerald-600 bg-emerald-50"
            : "text-[#CCCCCC] hover:text-emerald-500 hover:bg-[#F0F0F0]"
        }`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => vote(-1)}
        aria-label="Not helpful"
        className={`p-1.5 rounded-md transition-all ${
          message.feedback === -1
            ? "text-red-500 bg-red-50"
            : "text-[#CCCCCC] hover:text-red-400 hover:bg-[#F0F0F0]"
        }`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const showTyping = !isUser && message.streaming && message.content === "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex gap-3 group max-w-3xl mx-auto w-full ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5 border"
        style={
          isUser
            ? { background: "#F3F3F3", borderColor: "#E2E2E2" }
            : { background: "#6B3AC6", borderColor: "#6B3AC6" }
        }
      >
        {isUser
          ? <User className="h-3.5 w-3.5 text-[#555555]" />
          : <Bot  className="h-3.5 w-3.5 text-white" />}
      </div>

      <div className={`flex flex-col gap-1.5 max-w-[85%] min-w-0 ${isUser ? "items-end" : ""}`}>
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <div
            className="rounded-2xl px-4 py-3 text-sm leading-relaxed border"
            style={
              isUser
                ? {
                    background: "#F3F3F3",
                    borderColor: "#E8E8E8",
                    borderRadius: "1rem 1rem 0.25rem 1rem",
                  }
                : {
                    background: "#FFFFFF",
                    borderColor: "#E2E2E2",
                    borderRadius: "1rem 1rem 1rem 0.25rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }
            }
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words text-[#1A1A1A]">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none break-words text-[#1A1A1A]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !match ? (
                        <code
                          className="px-1 py-0.5 rounded text-xs font-mono bg-[#F3F3F3] border border-[#E2E2E2] text-[#6B3AC6]"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={oneLight as Record<string, React.CSSProperties>}
                          language={match[1]}
                          PreTag="div"
                          className="!rounded-xl !text-xs !my-2 !border !border-[#E2E2E2]"
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.streaming && (
                  <span className="inline-block w-0.5 h-4 bg-[#6B3AC6] ml-0.5 animate-pulse align-text-bottom" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer: confidence + feedback + copy + timestamp */}
        {!isUser && !message.streaming && message.content && (
          <div className="flex items-center gap-2 px-1">
            {message.confidence !== undefined && <ConfidenceBadge score={message.confidence} />}
            <FeedbackButtons message={message} />
            <CopyButton text={message.content} />
            <span className="text-[10px] text-[#CCCCCC] ml-auto">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* Low-confidence warning */}
        {!isUser && !message.streaming && message.low_confidence_warning && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl border text-xs"
            style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>
              <strong>Low confidence.</strong> The retrieved context may not fully answer this question.
              Consider rephrasing or uploading more relevant documents.
            </span>
          </div>
        )}

        {/* Conflict warning */}
        {!isUser && !message.streaming && message.conflict_warning?.detected && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl border text-xs"
            style={{ background: "#FFF7ED", borderColor: "#FED7AA", color: "#9A3412" }}>
            <span className="shrink-0 mt-0.5">🔀</span>
            <span>
              <strong>Multiple sources detected.</strong> {message.conflict_warning.message}
            </span>
          </div>
        )}

        {/* Citations */}
        {!isUser && !message.streaming && message.sources && message.sources.length > 0 && (
          <div className="flex flex-col gap-1 w-full px-1">
            <p className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wider px-1">
              Sources
            </p>
            {message.sources.map((s, i) => (
              <CitationChip key={`${s.filename}-${s.page}-${i}`} source={s} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
