export interface Source {
  filename: string;
  page: number;
  chunk_index: number;
  score: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number;
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
}

export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "done"; sources: Source[]; confidence: number }
  | { type: "error"; message: string };

export type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "error";

export interface PendingUpload {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
}
