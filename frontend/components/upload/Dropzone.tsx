"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, CheckCircle2, XCircle, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingUpload } from "@/lib/types";

const STATUS_ICON = {
  uploading:  <Loader2     className="h-3 w-3 animate-spin text-[#6B3AC6]" />,
  processing: <Loader2     className="h-3 w-3 animate-spin text-amber-500" />,
  ready:      <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  error:      <XCircle     className="h-3 w-3 text-red-500" />,
  idle:       <File        className="h-3 w-3 text-[#AAAAAA]" />,
};
const STATUS_LABEL = {
  uploading: "Uploading…", processing: "Embedding…", ready: "Ready", error: "Failed", idle: "",
};

interface DropzoneProps { onDrop: (files: File[]) => void; pending: PendingUpload[]; }

export function Dropzone({ onDrop, pending }: DropzoneProps) {
  const handleDrop = useCallback((accepted: File[]) => onDrop(accepted), [onDrop]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/csv": [".csv"],
      "text/markdown": [".md"],
      "text/html": [".html", ".htm"],
    },
    multiple: true,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-[#6B3AC6] bg-[#6B3AC6]/5"
            : "border-[#DDDDE0] hover:border-[#6B3AC6]/40 hover:bg-[#F8F8FC]"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("h-5 w-5", isDragActive ? "text-[#6B3AC6]" : "text-[#AAAAAA]")} />
        <div>
          <p className="text-xs font-semibold text-[#1A1A1A]">
            {isDragActive ? "Drop to upload" : "Upload documents"}
          </p>
          <p className="text-[10px] text-[#AAAAAA] mt-0.5">PDF, DOCX, CSV, MD, HTML, TXT</p>
        </div>
      </div>

      <AnimatePresence>
        {pending.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F5F5F5] border border-[#E2E2E2] text-xs"
          >
            {STATUS_ICON[item.status]}
            <span className="flex-1 truncate text-[#1A1A1A]">{item.file.name}</span>
            <span className="shrink-0 text-[#AAAAAA]">{STATUS_LABEL[item.status]}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
