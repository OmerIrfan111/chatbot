"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { CitationChip } from "./CitationChip";
import { TypingIndicator } from "./TypingIndicator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/types";

interface MessageProps {
  message: ChatMessage;
}

function ConfidenceBadge({ score }: { score: number }) {
  const { label, cls } = score >= 0.85
    ? { label: "High confidence", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
    : score >= 0.70
    ? { label: "Medium confidence", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    : { label: "Low confidence — verify this answer", cls: "bg-red-500/15 text-red-400 border-red-500/30" };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className={cn("text-[10px] px-2 py-0.5 font-medium cursor-default border", cls)}
        >
          {Math.round(score * 100)}%
        </Badge>
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
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
      aria-label="Copy response"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === "user";
  const showTyping = !isUser && message.streaming && message.content === "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium mt-0.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border border-border text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={cn("flex flex-col gap-2 max-w-[85%] min-w-0", isUser && "items-end")}>
        {showTyping ? (
          <TypingIndicator />
        ) : (
          <div
            className={cn(
              "relative rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-card border border-border text-card-foreground rounded-tl-sm"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const inline = !match;
                      return inline ? (
                        <code
                          className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <SyntaxHighlighter
                          style={oneDark as Record<string, React.CSSProperties>}
                          language={match[1]}
                          PreTag="div"
                          className="!rounded-lg !text-xs !my-2"
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
                  <span className="inline-block w-0.5 h-4 bg-muted-foreground ml-0.5 animate-pulse align-text-bottom" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer row: confidence + copy + timestamp */}
        {!isUser && !message.streaming && message.content && (
          <div className="flex items-center gap-2 px-1">
            {message.confidence !== undefined && (
              <ConfidenceBadge score={message.confidence} />
            )}
            <CopyButton text={message.content} />
            <span className="text-[10px] text-muted-foreground ml-auto">
              {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* Citations */}
        {!isUser && !message.streaming && message.sources && message.sources.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full px-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
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
