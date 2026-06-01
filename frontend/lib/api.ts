import type {
  AdminStats,
  ChatRequest,
  ChatResponse,
  Document,
  EscalateRequest,
  EscalateResponse,
  GapItem,
  SSEEvent,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── tenant auth (Phase 7) ───────────────────────────────────────────────────────
// The end-user/widget surface authenticates with a tenant-scoped token obtained
// by exchanging a tenant API key. Cached for the session.

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "default";
const TENANT_API_KEY = process.env.NEXT_PUBLIC_TENANT_API_KEY ?? "demo-key";

let _tokenPromise: Promise<string> | null = null;

async function getTenantToken(): Promise<string> {
  if (!_tokenPromise) {
    _tokenPromise = fetch(`${BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: TENANT_ID, api_key: TENANT_API_KEY }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("auth failed"))))
      .then((d) => d.access_token as string)
      .catch(() => {
        _tokenPromise = null; // allow retry on next call
        return "";
      });
  }
  return _tokenPromise;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getTenantToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ── documents ─────────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<Document[]> {
  return apiFetch<Document[]>("/documents");
}

export async function uploadDocument(file: File): Promise<{ document_id: number; filename: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const token = await getTenantToken();
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const token = await getTenantToken();
  const res = await fetch(`${BASE}/documents/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed: HTTP ${res.status}`);
  }
}

// ── chat (non-streaming fallback) ─────────────────────────────────────────────

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── chat (SSE streaming) ──────────────────────────────────────────────────────

export async function* streamChat(req: ChatRequest): AsyncGenerator<SSEEvent> {
  const token = await getTenantToken();
  const res = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      detail = JSON.parse(body)?.detail ?? body;
    } catch { /* raw text */ }
    yield { type: "error", message: detail };
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as SSEEvent;
        yield event;
      } catch {
        /* malformed event — skip */
      }
    }
  }
}

// ── suggestions (auto starter questions) ──────────────────────────────────────

export async function fetchSuggestions(n = 4): Promise<string[]> {
  const data = await apiFetch<{ suggestions: string[] }>(`/suggestions?n=${n}`);
  return data.suggestions;
}

// ── escalation (human handoff) ────────────────────────────────────────────────

export async function escalate(req: EscalateRequest): Promise<EscalateResponse> {
  return apiFetch<EscalateResponse>("/escalate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ── feedback ──────────────────────────────────────────────────────────────────

export async function submitFeedback(interactionId: number, rating: 1 | -1): Promise<void> {
  await apiFetch(`/feedback/${interactionId}`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

// ── auth ──────────────────────────────────────────────────────────────────────

export async function adminLogin(email: string, password: string): Promise<string> {
  const data = await apiFetch<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

// ── analytics ─────────────────────────────────────────────────────────────────

export async function fetchAdminStats(token: string): Promise<AdminStats> {
  return apiFetch<AdminStats>("/analytics/stats", {
    headers: authHeader(token),
  });
}

export async function fetchGaps(token: string): Promise<GapItem[]> {
  const data = await apiFetch<{ gaps: GapItem[] }>("/analytics/gaps", {
    headers: authHeader(token),
  });
  return data.gaps;
}

export function gapsExportUrl(): string {
  return `${BASE}/analytics/gaps/export`;
}
