"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, CheckCircle2, XCircle, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingUpload } from "@/lib/types";

const STATUS_ICON = {
  uploading:  <Loader2  className="h-3 w-3 animate-spin" style={{ color: "#FF3AF2" }} />,
  processing: <Loader2  className="h-3 w-3 animate-spin" style={{ color: "#FFE600" }} />,
  ready:      <CheckCircle2 className="h-3 w-3" style={{ color: "#00F5D4" }} />,
  error:      <XCircle  className="h-3 w-3" style={{ color: "#FF6B35" }} />,
  idle:       <File     className="h-3 w-3 text-muted-foreground" />,
};
const STATUS_LABEL = {
  uploading: "Uploading…", processing: "Embedding…", ready: "Ready", error: "Failed", idle: "",
};

interface DropzoneProps { onDrop: (files: File[]) => void; pending: PendingUpload[]; }

export function Dropzone({ onDrop, pending }: DropzoneProps) {
  const handleDrop = useCallback((accepted: File[]) => onDrop(accepted), [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    multiple: true,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-5 text-center cursor-pointer transition-all duration-300 border-4 border-dashed",
          isDragActive ? "scale-[1.03]" : "hover:scale-[1.01]"
        )}
        style={{
          borderColor: isDragActive ? "#FF3AF2" : "#00F5D4",
          background: isDragActive
            ? "rgba(255,58,242,0.08)"
            : "rgba(0,245,212,0.04)",
          boxShadow: isDragActive
            ? "0 0 20px rgba(255,58,242,0.4), inset 0 0 20px rgba(255,58,242,0.05)"
            : "0 0 12px rgba(0,245,212,0.15)",
        }}
      >
        <input {...getInputProps()} />
        <Upload
          className="h-6 w-6 transition-colors"
          style={{ color: isDragActive ? "#FF3AF2" : "#00F5D4" }}
        />
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#FAFAFF]">
            {isDragActive ? "Drop it!" : "Upload docs"}
          </p>
          <p className="text-[10px] mt-0.5 font-medium" style={{ color: "#00F5D4" }}>
            PDF, TXT · drag & drop or click
          </p>
        </div>
      </div>

      <AnimatePresence>
        {pending.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs"
            style={{ background: "rgba(45,27,78,0.6)", borderColor: "rgba(255,58,242,0.3)" }}
          >
            {STATUS_ICON[item.status]}
            <span className="flex-1 truncate text-[#FAFAFF]">{item.file.name}</span>
            <span className="shrink-0 text-[#FAFAFF]/50">{STATUS_LABEL[item.status]}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
