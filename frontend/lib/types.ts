export interface Source {
  filename: string;
  page: number;
  chunk_index: number;
  document_id?: number;
  score: number;
  snippet: string;
}

export interface ConflictWarning {
  detected: boolean;
  documents: string[];
  message: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number;
  low_confidence_warning?: boolean;
  conflict_warning?: ConflictWarning | null;
  /** true while SSE tokens are still arriving */
  streaming?: boolean;
  timestamp: Date;
}

export interface Document {
  id: number;
  filename: string;
  chunk_count: number;
  created_at: string;
}

export interface ChatRequest {
  question: string;
  session_id?: string;
  chat_history?: Array<{ role: string; content: string }>;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  confidence: number;
  low_confidence_warning: boolean;
  conflict_warning: ConflictWarning | null;
}

export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "done"; sources: Source[]; confidence: number; low_confidence_warning: boolean; conflict_warning: ConflictWarning | null }
  | { type: "error"; message: string };

export type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "error";

export interface PendingUpload {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
}
