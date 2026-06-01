"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Zap, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CitationChip } from "./CitationChip";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatMessage } from "@/lib/types";

function ConfidenceBadge({ score }: { score: number }) {
  const isHigh = score >= 0.85;
  const isMid  = score >= 0.70;
  const color  = isHigh ? "#00F5D4" : isMid ? "#FFE600" : "#FF6B35";
  const label  = isHigh ? "High confidence" : isMid ? "Medium confidence" : "Low confidence — verify this answer";

  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 cursor-default transition-all"
          style={{
            color,
            background: `${color}15`,
            borderColor: `${color}55`,
            boxShadow: `0 0 8px ${color}44`,
          }}
        >
          {Math.round(score * 100)}%
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-xs max-w-[200px] text-center border-2"
        style={{ background: "#1C1133", borderColor: color, color: "#FAFAFF" }}
      >
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
      className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg"
      style={{ color: copied ? "#00F5D4" : "rgba(250,250,255,0.4)" }}
      aria-label="Copy response"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const showTyping = !isUser && message.streaming && message.content === "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center mt-0.5 border-2"
        style={
          isUser
            ? {
                background: "linear-gradient(135deg, #FF3AF2, #7B2FFF)",
                borderColor: "#FFE600",
                boxShadow: "0 0 12px rgba(255,58,242,0.5)",
              }
            : {
                background: "#120D22",
                borderColor: "#00F5D4",
                boxShadow: "0 0 10px rgba(0,245,212,0.3)",
              }
        }
      >
        {isUser
          ? <User className="h-4 w-4 text-white" />
          : <Zap  className="h-4 w-4" style={{ color: "#00F5D4" }} fill="#00F5D4" />}
      </div>

      {/* Bubble + metadata */}
      <div className={`flex flex-col gap-2 max-w-[85%] min-w-0 ${isUser ? "items-end" : ""}`}>
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <div
            className="relative rounded-2xl px-4 py-3 text-sm leading-relaxed border-2"
            style={
              isUser
                ? {
                    background: "linear-gradient(135deg, #FF3AF2 0%, #7B2FFF 60%, #7B2FFF 100%)",
                    borderColor: "#FFE600",
                    color: "#FAFAFF",
                    borderRadius: "1rem 1rem 0.25rem 1rem",
                    boxShadow: "4px 4px 0 #7B2FFF88, 0 0 20px rgba(255,58,242,0.35)",
                  }
                : {
                    background: "#120D22",
                    borderColor: "#00F5D4",
                    color: "#FAFAFF",
                    borderRadius: "1rem 1rem 1rem 0.25rem",
                    boxShadow: "4px 4px 0 #7B2FFF, 8px 8px 0 #FF3AF244",
                  }
            }
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words font-medium">{message.content}</p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !match ? (
                        <code
                          className="px-1.5 py-0.5 rounded text-xs font-mono border"
                          style={{ background: "rgba(255,58,242,0.1)", borderColor: "rgba(255,58,242,0.3)", color: "#FF3AF2" }}
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={oneDark as Record<string, React.CSSProperties>}
                          language={match[1]}
                          PreTag="div"
                          className="!rounded-xl !text-xs !my-2"
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
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-text-bottom"
                    style={{ background: "#FF3AF2" }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer: confidence + copy + time */}
        {!isUser && !message.streaming && message.content && (
          <div className="flex items-center gap-2 px-1">
            {message.confidence !== undefined && <ConfidenceBadge score={message.confidence} />}
            <CopyButton text={message.content} />
            <span className="text-[10px] ml-auto" style={{ color: "rgba(250,250,255,0.3)" }}>
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* Citations */}
        {!isUser && !message.streaming && message.sources && message.sources.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full px-1">
            <p
              className="text-[10px] font-black uppercase tracking-[0.2em] px-1"
              style={{ color: "#FFE600", textShadow: "0 0 6px rgba(255,230,0,0.4)" }}
            >
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
