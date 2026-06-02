"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Bot, User, ThumbsUp, ThumbsDown, LifeBuoy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CitationChip } from "./CitationChip";
import { TypingIndicator } from "./TypingIndicator";
import { submitFeedback, escalate } from "@/lib/api";
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
      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[var(--surface-2)] text-[var(--ink-faint)] hover:text-[var(--ink-soft)] transition-all"
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
            : "text-[var(--ink-faint)] hover:text-emerald-500 hover:bg-[var(--surface-2)]"
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
            : "text-[var(--ink-faint)] hover:text-red-400 hover:bg-[var(--surface-2)]"
        }`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EscalationOffer({ message }: { message: ChatMessage }) {
  const sessionId = useChatStore((s) => s.sessionId);
  const messages = useChatStore((s) => s.messages);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  const handoff = async () => {
    if (state !== "idle") return;
    setState("sending");
    // The question is the user turn immediately preceding this answer.
    const idx = messages.findIndex((m) => m.id === message.id);
    const question = idx > 0 ? messages[idx - 1].content : message.content;
    try {
      await escalate({
        session_id: sessionId,
        question,
        reason: "low_confidence",
        interaction_id: message.interaction_id ?? null,
      });
      setState("done");
    } catch {
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
        style={{ background: "#F0FDF4", borderColor: "#BBF7D0", color: "#166534" }}>
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span>Connected — a support specialist will follow up shortly.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs"
      style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-soft)" }}>
      <span className="flex items-center gap-2">
        <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
        Not quite what you needed? Talk to a human.
      </span>
      <button
        onClick={handoff}
        disabled={state === "sending"}
        className="shrink-0 px-2.5 py-1 rounded-lg font-semibold transition-all disabled:opacity-60"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {state === "sending" ? "Connecting…" : "Talk to a human"}
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
            ? { background: "var(--surface-2)", borderColor: "var(--line)" }
            : { background: "var(--accent)", borderColor: "var(--accent)" }
        }
      >
        {isUser
          ? <User className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
          : <Bot  className="h-3.5 w-3.5 text-[var(--accent-ink)]" />}
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
                    background: "var(--ink)",
                    borderColor: "transparent",
                    borderRadius: "1rem 1rem 0.25rem 1rem",
                  }
                : {
                    background: "var(--surface)",
                    borderColor: "var(--line)",
                    borderRadius: "1rem 1rem 1rem 0.25rem",
                    boxShadow: "0 1px 3px rgba(20,20,16,0.05)",
                  }
            }
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words text-[var(--bg)]">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none break-words text-[var(--ink)]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !match ? (
                        <code
                          className="px-1 py-0.5 rounded text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)]"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <div className="relative group/code">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 p-1 rounded bg-[var(--surface-2)] hover:bg-[var(--line)] transition-all text-[var(--ink-soft)] hover:text-[var(--ink)]"
                            aria-label="Copy code"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <SyntaxHighlighter
                            style={oneLight as Record<string, React.CSSProperties>}
                            language={match[1]}
                            PreTag="div"
                            className="!rounded-xl !text-xs !my-2 !border !border-[#E2E2E2]"
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.streaming && (
                  <span className="inline-block w-0.5 h-4 bg-[var(--ink)] ml-0.5 animate-pulse align-text-bottom" />
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
            <span className="text-[10px] text-[var(--ink-faint)] ml-auto">
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

        {/* Human-escalation offer (low confidence / refusal) */}
        {!isUser && !message.streaming && message.escalation_offered && (
          <EscalationOffer message={message} />
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
            <p className="text-[10px] font-semibold text-[var(--ink-faint)] uppercase tracking-wider px-1">
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
