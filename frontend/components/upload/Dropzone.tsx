"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, File, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingUpload } from "@/lib/types";

const STATUS_ICON = {
  uploading: <Loader2 className="h-3 w-3 animate-spin text-primary" />,
  processing: <Loader2 className="h-3 w-3 animate-spin text-amber-400" />,
  ready: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  error: <XCircle className="h-3 w-3 text-red-400" />,
  idle: <File className="h-3 w-3 text-muted-foreground" />,
};

const STATUS_LABEL = {
  uploading: "Uploading…",
  processing: "Embedding…",
  ready: "Ready",
  error: "Failed",
  idle: "",
};

interface DropzoneProps {
  onDrop: (files: File[]) => void;
  pending: PendingUpload[];
}

export function Dropzone({ onDrop, pending }: DropzoneProps) {
  const handleDrop = useCallback((accepted: File[]) => onDrop(accepted), [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    multiple: true,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("h-5 w-5 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground")} />
        <div>
          <p className="text-xs font-medium text-foreground">
            {isDragActive ? "Drop to upload" : "Upload documents"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">PDF, TXT · drag & drop or click</p>
        </div>
      </div>

      {/* Pending uploads */}
      <AnimatePresence>
        {pending.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs"
          >
            {STATUS_ICON[item.status]}
            <span className="flex-1 truncate text-foreground">{item.file.name}</span>
            <span className="shrink-0 text-muted-foreground">{STATUS_LABEL[item.status]}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
