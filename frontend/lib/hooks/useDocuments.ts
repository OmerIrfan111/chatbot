"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteDocument, fetchDocuments, uploadDocument } from "@/lib/api";
import type { PendingUpload } from "@/lib/types";
import { useState } from "react";
import { nanoid } from "nanoid";

export const DOCS_KEY = ["documents"] as const;

export function useDocuments() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: DOCS_KEY,
    queryFn: fetchDocuments,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DOCS_KEY });
      toast.success("Document removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    deleteDoc: deleteMutation.mutate,
  };
}

export function useUpload() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const upload = async (files: File[]) => {
    const entries: PendingUpload[] = files.map((f) => ({
      id: nanoid(),
      file: f,
      status: "uploading",
    }));
    setPending((p) => [...p, ...entries]);

    await Promise.all(
      entries.map(async (entry) => {
        try {
          setPending((p) =>
            p.map((x) => (x.id === entry.id ? { ...x, status: "processing" } : x))
          );
          await uploadDocument(entry.file);
          setPending((p) =>
            p.map((x) => (x.id === entry.id ? { ...x, status: "ready" } : x))
          );
          toast.success(`${entry.file.name} ready.`);
          qc.invalidateQueries({ queryKey: DOCS_KEY });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          setPending((p) =>
            p.map((x) =>
              x.id === entry.id ? { ...x, status: "error", error: msg } : x
            )
          );
          toast.error(`${entry.file.name}: ${msg}`);
        }
      })
    );

    // Remove completed/errored after a short delay
    setTimeout(() => {
      setPending((p) => p.filter((x) => x.status === "uploading" || x.status === "processing"));
    }, 3000);
  };

  return { pending, upload };
}
