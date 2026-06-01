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
  interaction_id?: number | null;
  feedback?: 1 | -1 | null;
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
  interaction_id: number | null;
}

export type SSEEvent =
  | { type: "token"; content: string }
  | {
      type: "done";
      sources: Source[];
      confidence: number;
      low_confidence_warning: boolean;
      conflict_warning: ConflictWarning | null;
      interaction_id: number | null;
    }
  | { type: "error"; message: string };

export type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "error";

export interface PendingUpload {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
}

// ── Admin / Analytics ─────────────────────────────────────────────────────────

export interface DailyCount {
  date: string;
  count: number;
}

export interface ConfidenceDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface FeedbackStats {
  thumbs_up: number;
  thumbs_down: number;
  total: number;
}

export interface AdminStats {
  total_questions: number;
  answer_rate: number;
  avg_confidence: number;
  questions_today: number;
  daily_counts: DailyCount[];
  confidence_distribution: ConfidenceDistribution;
  feedback: FeedbackStats;
}

export interface GapItem {
  id: number;
  question: string;
  confidence: number | null;
  is_refusal: boolean;
  created_at: string;
}
