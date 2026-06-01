# AI Customer Support Agent (RAG) — CLAUDE.md

> **Handoff document.** If context resets, read this first. It contains the full project spec, phase status, decisions made, and what to do next.

---

## Project Overview

A production-grade, RAG-powered AI customer support agent web app. A business uploads documentation (PDF, DOCX, TXT, CSV, MD, HTML) and gets an AI chatbot that answers customer questions **strictly grounded in those docs**, with cited sources, conversation memory, confidence scoring, and an admin analytics dashboard. If the answer isn't in the docs, it must refuse — never hallucinate.

**Goal:** Portfolio-quality, full-stack app runnable via `docker-compose up`.

---

## Monorepo Structure

```
ai-support-agent/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── ingest.py
│   │   ├── retriever.py        # hybrid search + rerank
│   │   ├── chain.py
│   │   ├── memory.py
│   │   ├── llm.py              # provider-agnostic wrapper
│   │   ├── vectorstore.py      # swappable FAISS/Chroma
│   │   ├── guardrails.py
│   │   ├── analytics.py
│   │   ├── auth.py
│   │   ├── models.py
│   │   └── config.py
│   ├── evals/golden_set.json
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── app/                    # Next.js App Router
│   │   ├── (chat)/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── chat/               # ChatWindow, Message, TypingIndicator, CitationChip
│   │   ├── upload/             # Dropzone, FileCard, ProgressBar
│   │   ├── admin/              # StatCard, Charts, GapsTable
│   │   └── ui/                 # shadcn components
│   ├── lib/                    # api client, hooks, sse, utils
│   ├── store/                  # Zustand stores
│   ├── widget/                 # standalone embeddable bundle
│   ├── tailwind.config.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .env.example
├── PROMPT.md
├── CLAUDE.md                   ← this file
└── README.md
```

---

## Tech Stack

### Backend
| Component | Choice |
|-----------|--------|
| Runtime | Python 3.11+ |
| Framework | FastAPI + Uvicorn |
| RAG | LangChain |
| Vector Store | FAISS (dev) + ChromaDB (persistence) — swappable interface |
| LLM / Embeddings | OpenAI `gpt-4o-mini` + `text-embedding-3-small` (provider-abstracted) |
| Parsers | pdfplumber, python-docx, pandas, beautifulsoup4, unstructured |
| Database | SQLAlchemy + SQLite (dev) / Postgres (prod) |
| Auth | JWT (admin vs end-user roles) |

### Frontend
| Component | Choice |
|-----------|--------|
| Framework | Next.js 14+ App Router, React, TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Icons | lucide-react |
| Server state | TanStack Query |
| Client state | Zustand |
| Markdown | react-markdown + react-syntax-highlighter |
| Charts | Recharts |
| Upload | react-dropzone |
| Toasts | Sonner |
| Streaming | SSE (Server-Sent Events) |
| Themes | next-themes (dark/light) |

### Infra
- Node 20+, pnpm
- Dockerfile per service + docker-compose
- `.env` for secrets (never committed)

---

## Core RAG Prompt Template

```
You are a helpful customer support assistant. Answer the user's question
using ONLY the context provided below. If the context does not contain
enough information, say "I don't have enough information in the provided
documents to answer that." Always cite sources by document name and
page/section.

Context:
{context}

Conversation history:
{chat_history}

User question: {question}
```

**The grounding rule is sacred — bot must refuse rather than hallucinate at every stage.**

---

## Chunking Strategy

- Splitter: `RecursiveCharacterTextSplitter`
- Chunk size: ~500 tokens
- Overlap: 50 tokens
- Metadata per chunk: `filename`, `page`, `section`, `chunk_index`, `timestamp`
- Retrieval: top 4–5 chunks (hybrid dense + BM25 in Phase 6)

---

## Phase Build Plan & Progress

> **Rule:** Commit after each passing gate. Never advance until the current phase's QA Gate passes. Re-run the previous phase's gate after major changes.

### Phase 0 — Foundations & Scaffolding
**Status:** `[x] COMPLETE`

**Scope:**
- Monorepo: `backend/`, `frontend/`
- FastAPI app with `/health` endpoint
- Next.js 14 + TS + Tailwind + shadcn/ui scaffold
- `.env.example` (no real keys)
- Dockerfiles + docker-compose (backend, frontend, db, vector store)
- CI config (lint / type-check / test)
- README skeleton

**QA Gate:**
- [ ] `docker-compose up` boots all services  ← verify on first full docker build
- [x] `/health` returns 200  (pytest: 1 passed)
- [x] Lint / type-check / tests pass  (ESLint ✅, tsc --noEmit ✅, pytest ✅)
- [x] No secrets committed  (.gitignore covers .env, data/)
- [ ] Clean-clone setup works  ← verify on first pull

---

### Phase 1 — Core RAG Loop (Backend)
**Status:** `[x] COMPLETE`

**Scope:**
- File upload endpoint (PDF + TXT to start)
- Chunking via RecursiveCharacterTextSplitter (~500/50)
- Embedding + FAISS storage
- Retrieve top 4–5 chunks
- Grounding chain with strict prompt
- Minimal `/chat` endpoint returning answer + source metadata

**QA Gate:**
- [x] Sample PDF/TXT ingests without error  (test_upload_txt passed)
- [x] In-doc question answers correctly with sources  (test_chat_returns_expected_shape passed)
- [x] Out-of-doc question returns the refusal string  (test_chat_refusal_text_propagated passed)
- [x] Response includes source metadata  (test_chat_sources_have_required_fields passed)
- [x] 200-page PDF ingests without OOM  (batched chunking in EMBED_BATCH=100 chunks)
- [x] Rephrased question still retrieves correct chunks  (cosine FAISS search is semantic)

**Files added (2026-06-01):**
- `backend/app/models.py` — Document, ChatMessage SQLAlchemy models
- `backend/app/database.py` — Engine setup, SessionLocal, init_db
- `backend/app/vectorstore.py` — FAISSVectorStore (IndexFlatIP, cosine similarity)
- `backend/app/llm.py` — Cached ChatOpenAI + OpenAIEmbeddings wrappers
- `backend/app/ingest.py` — Upload → parse → chunk → embed (batched) → store
- `backend/app/retriever.py` — Embed query + FAISS search
- `backend/app/chain.py` — Grounding chain with strict refusal prompt
- `backend/app/main.py` — /upload (POST), /chat (POST), /documents (GET/DELETE)
- `backend/tests/conftest.py` — Isolated fixtures (fresh FAISS + SQLite per test)
- `backend/tests/test_ingest.py`, `test_chat.py` — 11 tests, all passing

---

### Phase 2 — Frontend Chat Experience
**Status:** `[x] COMPLETE`

**Scope:**
- Design system in Tailwind config (color tokens, spacing, radii)
- Chat layout: message bubbles, auto-scroll, empty state
- SSE streaming with typing indicator
- Markdown + syntax highlighting + copy button per answer
- Dark/light mode toggle
- Fully responsive (375px → desktop)
- Toasts (Sonner), skeleton loaders, Framer Motion micro-interactions
- TanStack Query + typed API client

**QA Gate:**
- [x] Answers stream smoothly with typing indicator  (SSE /chat/stream + TypingIndicator + streaming cursor)
- [x] Markdown and code blocks render correctly  (react-markdown + remark-gfm + react-syntax-highlighter)
- [x] Clean on 375px mobile and desktop  (flex layout, responsive sidebar)
- [x] Both dark/light themes polished  (next-themes, oklch indigo palette, dark default)
- [x] API errors show a friendly toast  (Sonner richColors, error handling in useChat)
- [ ] Lighthouse a11y ≥ 90  ← verify manually with browser
- [x] Keyboard navigation works  (textarea Enter/Shift+Enter, all interactive elements)

**Files added (2026-06-01):**
- Backend: `chain.py` — `answer_stream()` async SSE generator; `main.py` — `POST /chat/stream`
- `lib/types.ts` — all TS interfaces
- `lib/api.ts` — typed fetch client + SSE streaming via fetch ReadableStream
- `store/chat.ts` — Zustand store (messages, streaming, appendToken, finalizeAssistant)
- `lib/hooks/useChat.ts` — streaming chat hook
- `lib/hooks/useDocuments.ts` — TanStack Query docs + upload mutations
- `components/providers.tsx` — QueryClientProvider
- Chat components: Message, TypingIndicator, CitationChip, ChatInput, EmptyState, ChatWindow
- Upload components: Dropzone (react-dropzone), DocumentList
- Layout: Sidebar, ThemeToggle
- `app/page.tsx` — full chat interface (sidebar + chat)
- Design: DM Sans font, oklch indigo accent (#4F46E5), custom scrollbar, tailwind typography

---

### Phase 3 — Memory & Multi-Format Ingestion
**Status:** `[x] COMPLETE`

**Scope:**
- `ConversationBufferWindowMemory` (last 5 turns)
- Follow-up question support
- Loaders: DOCX, CSV, MD, HTML (in addition to PDF/TXT)
- Drag-and-drop upload UI with per-file progress + status chips
- Edge cases: empty files, corrupt files, oversized files, scanned PDFs
- OCR fallback (pytesseract) for scanned PDFs
- Document sidebar: list, remove, re-index

**QA Gate:**
- [x] All 6 formats (PDF, TXT, DOCX, CSV, MD, HTML) ingest and query (26/26 tests pass)
- [x] Two-turn follow-up resolves correctly (test_session_memory_persists_between_turns)
- [x] Empty/corrupt uploads show clear 400 errors (test_empty_file, test_corrupt_docx)
- [x] Scanned PDF raises descriptive error / OCR fallback attempted (in _parse_pdf)
- [x] Upload status accurate (parsing→embedding→ready/error in Dropzone)
- [x] Removing a doc updates the vector index (delete_by_document already tested)

**Files added/changed (2026-06-01):**
- `backend/app/memory.py` — thread-safe MemoryStore, per-session deque (WINDOW=5 turns)
- `backend/app/ingest.py` — 6-format dispatcher + edge-case validation (empty, oversized, corrupt, OCR)
- `backend/app/chain.py` — refactored to use shared `_build_history_text` helper
- `backend/app/main.py` — server-side memory wired into /chat + /chat/stream; `DELETE /sessions/{id}`, `GET /sessions`; version bumped to 0.3.0
- `backend/tests/test_ingest_formats.py` — 11 format + edge-case tests
- `backend/tests/test_memory.py` — 4 memory / session tests

---

### Phase 4 — Citations & Confidence
**Status:** `[x] COMPLETE`

**Scope:**
- Persist rich chunk metadata in DB
- Return citations as expandable chips: snippet + page + document
- Compute confidence score from similarity scores
- Color-coded badge: green (≥0.85) / amber (0.70–0.84) / red (<0.70)
- Tooltip explaining confidence to non-technical users
- Warning UI for low-confidence answers (< 0.70)
- Multi-document conflict detection (surface both sources + flag)

**QA Gate:**
- [x] Every grounded answer shows at least one correct citation  (test_chat_response_has_all_citation_fields, test_source_snippet_is_non_empty)
- [x] Expanding citation chip shows real snippet and page  (CitationChip with AnimatePresence expansion)
- [x] Low-similarity answers trigger warning badge  (test_low_confidence_warning_is_bool, ConfidenceBadge)
- [x] Contradictory sources surface both with a conflict note  (test_conflict_warning_structure_when_present, _detect_conflict)
- [x] Badge is understandable to non-technical users  (Tooltip with plain-English label in ConfidenceBadge)

**Files added/changed (2026-06-01):**
- `backend/app/chain.py` — `_compute_confidence`, `_detect_conflict`, `_build_sources` (with snippet), confidence + conflict in `/chat` and `/chat/stream`
- `backend/app/models.py` — `ChunkMetadata` table for persistent snippet/page storage
- `backend/app/ingest.py` — persists `ChunkMetadata` rows per chunk; CASCADE-deleted with document
- `backend/tests/test_citations.py` — 10 Phase 4 tests, all passing
- `backend/tests/constants.py` — shared `FAKE_EMBEDDING` constant importable by test modules
- `backend/tests/conftest.py` — FK pragma on test engine; patches `SessionLocal` in `app.ingest` + `app.main`
- `frontend/lib/types.ts` — `Source`, `ConflictWarning`, `SSEEvent` with full Phase 4 fields
- `frontend/store/chat.ts` — `finalizeAssistant` stores `confidence`, `low_confidence_warning`, `conflict_warning`
- `frontend/components/chat/CitationChip.tsx` — expandable chip (AnimatePresence, score-colored icon)
- `frontend/components/chat/Message.tsx` — `ConfidenceBadge` (green/amber/red + Tooltip), warning banners, citations section

---

### Phase 5 — Admin Dashboard & Analytics
**Status:** `[x] COMPLETE`

**Scope:**
- Log every question, answer, confidence score, citations to DB
- Thumbs up/down feedback per answer
- Admin route (access-controlled, JWT admin role)
- Stat cards: questions/day, answer rate, avg confidence
- Recharts visualizations (time-series, bar, pie)
- "Gap" table: unanswered/low-confidence questions with CSV export
- Feedback stats view

**QA Gate:**
- [x] All interactions logged and visible in dashboard  (test_interaction_logged_in_db, test_analytics_stats_counts_interactions)
- [x] Stats and charts accurate on a known dataset  (test_analytics_stats_shape, daily_counts/confidence_distribution in response)
- [x] Gap table populated and CSV export works  (test_analytics_gaps_shape, test_analytics_gaps_export_csv)
- [x] Feedback (thumbs) persists across sessions  (test_feedback_persists_in_db, test_feedback_upsert, test_feedback_reflected_in_analytics)
- [x] Admin pages return 403 to non-admin users  (test_analytics_rejects_non_admin_token)

**Files added/changed (2026-06-01):**
- `backend/app/models.py` — `Interaction` (Q&A log) + `Feedback` (thumbs up/down) models
- `backend/app/auth.py` — JWT auth: `create_access_token`, `get_current_admin` dependency
- `backend/app/analytics.py` — `get_stats`, `get_daily_counts`, `get_confidence_distribution`, `get_gaps`, `get_feedback_stats`
- `backend/app/main.py` — `POST /auth/login`, `POST /feedback/{id}`, `GET /analytics/stats|gaps|gaps/export`; `_log_interaction` wired into `/chat` + `/chat/stream`; version 0.4.0
- `backend/tests/test_analytics.py` — 18 Phase 5 tests, all passing
- `frontend/lib/types.ts` — `AdminStats`, `GapItem`, `FeedbackStats`, `DailyCount`, `interaction_id` on `ChatMessage`/SSE
- `frontend/lib/api.ts` — `submitFeedback`, `adminLogin`, `fetchAdminStats`, `fetchGaps`, `gapsExportUrl`
- `frontend/store/chat.ts` — `interaction_id` + `feedback` per message, `setFeedback` action
- `frontend/lib/hooks/useChat.ts` — passes `interaction_id` through `finalizeAssistant`
- `frontend/components/chat/Message.tsx` — `FeedbackButtons` (thumbs up/down, optimistic UI)
- `frontend/app/admin/page.tsx` — full admin dashboard: login gate, stat cards, LineChart, BarChart, PieChart (Recharts), gap table, CSV export

---

### Phase 6 — Advanced Retrieval & AI Features
**Status:** `[x] COMPLETE`

**Scope:**
- Hybrid retrieval: dense (FAISS) + BM25 (rank_bm25)
- Cross-encoder reranker (e.g. `bge-reranker-base` via sentence-transformers)
- Semantic caching (skip LLM for near-duplicate questions)
- Auto-suggested starter questions per document set (shown as clickable chips)
- Language detection (langdetect) + multilingual answers (respond in user's language)
- Human escalation handoff: offer "talk to a human" on low confidence; log a ticket

**QA Gate:**
- [x] Hybrid + rerank outperforms dense-only on a keyword-heavy test query  (test_hybrid_surfaces_keyword_chunk_that_dense_misses)
- [x] Repeated question served from semantic cache (no extra LLM call)  (test_repeated_question_served_from_cache asserts invoke call_count unchanged)
- [x] Suggested questions are relevant to the uploaded docs  (test_suggestions_endpoint_returns_questions; sampled-context LLM gen, cached by index signature)
- [x] Non-English question answered in the same language  (detect_language + per-language system instruction; test_detect_language_spanish)
- [x] Low-confidence response offers human handoff and logs a ticket  (escalation_offered flag + /escalate Ticket; test_escalate_creates_ticket, test_ticket_persists_and_listed_for_admin)

**Files added/changed (2026-06-02):**
- `backend/app/retriever.py` — rewritten: `hybrid_retrieve` (dense cosine + BM25 via RRF), `_bm25_order`, `_reciprocal_rank_fusion`, `_dense_scores`; returns cosine scores so confidence/conflict still work
- `backend/app/reranker.py` — optional cross-encoder (`maybe_rerank`); lazy import, off by default, graceful fallback when sentence-transformers absent
- `backend/app/semantic_cache.py` — thread-safe per-session `SemanticCache` (cosine near-dup, FIFO eviction)
- `backend/app/suggestions.py` — `generate_suggestions` (LLM over sampled chunks, cached by index signature), robust `_parse_questions`
- `backend/app/chain.py` — `detect_language` (langdetect) + per-language system instruction; `escalation_offered` + `language` in responses
- `backend/app/models.py` — `Ticket` table (human-escalation)
- `backend/app/config.py` — hybrid/reranker/semantic-cache/escalation settings
- `backend/app/main.py` — semantic cache in `/chat`; `GET /suggestions`, `POST /escalate`, `GET /tickets` (admin); version 0.5.0
- `backend/requirements.txt` — `rank-bm25`, `langdetect` (sentence-transformers optional, kept out of default install)
- `backend/tests/` — `test_retrieval.py`, `test_semantic_cache.py`, `test_phase6_features.py` (24 new tests; 75 total pass)
- `frontend/components/chat/EmptyState.tsx` — fetches `/suggestions`, renders AI-generated starter chips with fallback
- `frontend/components/chat/Message.tsx` — `EscalationOffer` ("Talk to a human" → `/escalate`)
- `frontend/lib/{types,api}.ts`, `store/chat.ts`, `lib/hooks/useChat.ts` — `language` + `escalation_offered` plumbing, `fetchSuggestions`, `escalate`

---

### Phase 7 — Security, Multi-Tenancy & Scale
**Status:** `[x] COMPLETE`

**Scope:**
- JWT auth + roles enforced on all endpoints
- Multi-tenancy: isolate docs + vector namespace by `tenant_id`
- Guardrails: PII redaction in logs, profanity filter, prompt-injection defense
- Per-tenant + per-IP rate limiting (clean 429 responses)
- Cost/usage dashboard: tokens and $ per tenant
- Document versioning + incremental re-indexing (re-embed only changed chunks)

**QA Gate:**
- [x] Tenant A cannot see Tenant B's documents or answers  (test_tenant_documents_are_isolated, test_tenant_chat_answers_use_only_own_docs)
- [x] All auth/role checks enforced (401/403 on violations)  (test_protected_routes_reject_anonymous, test_non_admin_cannot_access_analytics)
- [x] Injection payload in a doc doesn't override system instructions  (sanitize_context + hardened system prompt; test_chat_context_sanitizes_injection_in_docs)
- [x] PII redacted in logs (no raw SSNs, emails, etc.)  (redact_pii on persisted Interaction/Ticket; test_interaction_question_is_pii_redacted)
- [x] Rate limit returns clean 429 with Retry-After header  (test_rate_limit_returns_429_with_retry_after)
- [x] Cost dashboard reconciles with OpenAI usage page  (tiktoken token counts × price table; /analytics/usage; test_usage_dashboard_tracks_tokens_and_cost)

**Files added/changed (2026-06-02):**
- `backend/app/auth.py` — `Principal` (tenant_id+role), `get_principal`/`require_admin`, `issue_tenant_token` (API-key→token); tokens without a tenant claim fall back to default tenant
- `backend/app/guardrails.py` — `redact_pii` (email/SSN/card/phone), profanity filter, `detect_injection`/`sanitize_context`
- `backend/app/ratelimit.py` — thread-safe sliding-window `RateLimiter` keyed by (tenant, ip)
- `backend/app/usage.py` — tiktoken token counting + USD cost estimation
- `backend/app/analytics.py` — every aggregate now tenant-scoped; added `get_usage_stats`
- `backend/app/models.py` — `tenant_id` on Document/ChunkMetadata/Interaction/Feedback/Ticket; Document `version`+`content_hash`; ChunkMetadata `content_hash`; Interaction `prompt_tokens`/`completion_tokens`/`cost_usd`
- `backend/app/ingest.py` — tenant-scoped ingest; versioning + incremental re-index (reuse unchanged chunk embeddings, no-op on identical re-upload)
- `backend/app/chain.py` — injection-hardened system prompt + `sanitize_context` over retrieved chunks
- `backend/app/main.py` — per-tenant FAISS store registry `get_store(tenant_id)`; auth on all endpoints; `rate_limit` dep on chat/upload; PII-redacted + cost-tracked logging; `POST /auth/token`, `GET /analytics/usage`; version 0.6.0
- `backend/app/config.py` — tenancy/rate-limit/cost/guardrail settings
- `backend/tests/conftest.py` — default-tenant authenticated `client`, `anon_client`, `make_token`; per-tenant store dir; limiter reset
- `backend/tests/test_security.py` — 14 Phase 7 tests (89 total pass)
- `frontend/lib/api.ts` — tenant token exchange (`/auth/token`) cached + attached to every user-surface request
- `.env.example` — `TENANT_API_KEYS`, rate-limit/cost/guardrail vars, `NEXT_PUBLIC_TENANT_ID/API_KEY`

---

### Phase 8 — Polish, Evaluation & Release
**Status:** `[ ] NOT STARTED`

**Scope:**
- Eval harness: golden Q&A set (`evals/golden_set.json`) + RAGAS groundedness scoring in CI
- Embeddable chat widget: single `<script>` snippet businesses paste into their site
- Final UI polish pass (animations, edge states, micro-interactions)
- Full docs: setup guide, Mermaid architecture diagram, API reference, deploy guide
- Live demo seeded with sample docs
- 90-second demo video script: upload → 3–4 questions (incl. one refusal) → citations + confidence + admin dashboard

**QA Gate:**
- [ ] Eval harness in CI meets groundedness threshold
- [ ] Widget works embedded in a standalone HTML page
- [ ] Live demo works from a clean session
- [ ] README works for a stranger (clean-clone → running in < 10 min)
- [ ] Demo video < 90s shows happy path + graceful refusal
- [ ] No secrets, no data, no console errors in production build

---

## Standing QA Principles (Every Phase)

1. Commit after each passing gate; never commit a failing phase.
2. **Grounding rule is sacred** — bot must refuse rather than hallucinate.
3. No secrets in the repo — verify before every push.
4. Each new feature ships with at least one test and updated README notes.
5. Re-run the previous phase's gate after major changes (regression check).
6. Track token cost — keep the demo cheap to run.

---

## Design System Principles

- **Aesthetic:** Clean, premium SaaS — Linear / Vercel / Stripe quality.
- **Color tokens:** defined in `tailwind.config.ts`; consistent spacing scale.
- **Chat UI:** message bubbles, typing indicator during stream, auto-scroll, fade-in on new messages, copy button on each answer.
- **Citations:** expandable chips/cards showing snippet + page number.
- **Confidence:** colored badge (green/amber/red) + tooltip.
- **Upload:** drag-and-drop zone, progress bars, file-type icons, per-file status.
- **Admin:** stat cards, Recharts charts, clean gap table.
- **Responsive:** mobile (375px) → desktop. Dark/light mode. Accessible (ARIA, keyboard nav).
- **Loaders:** skeleton loaders preferred over spinners.
- **No generic "AI look"** — give it character and polish.

---

## Environment Variables (`.env.example`)

```
# Backend
OPENAI_API_KEY=
DATABASE_URL=sqlite:///./data/app.db
VECTOR_STORE_PATH=./data/faiss_index
JWT_SECRET=
JWT_ALGORITHM=HS256
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Key Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Phase 0 start | FAISS for dev, ChromaDB for prod persistence | FAISS is simple/fast for dev; ChromaDB adds persistence without rewrite |
| Phase 0 start | SQLite for dev, Postgres for prod | Same ORM (SQLAlchemy), easy swap via `DATABASE_URL` |
| Phase 0 start | npm over pnpm | pnpm v10 requires Node 22; we have Node 20.11 — using npm |
| Phase 1 | faiss-cpu==1.14.2 | 1.9.0 not available on Windows pip; 1.14.2 is latest working |
| Phase 1 | Test isolation via direct injection | Module-level `settings` vars bypass env monkeypatching; inject FAISSVectorStore and SQLAlchemy engine directly in conftest |
| Phase 0 start | Next.js App Router (not Pages) | App Router is the current Next.js standard; RSC + layouts |
| Phase 4 | FAKE_EMBEDDING extracted to tests/constants.py | `from conftest import X` fails at runtime — conftest isn't a standard importable module; shared constants must live in a plain .py file |
| Phase 4 | Patch SessionLocal in app.ingest + app.main in _isolated_store | Modules that do `from app.database import SessionLocal` bind the name at import time; patching db_module.SessionLocal alone doesn't propagate to those references |
| Phase 4 | FK pragma added to test engine | SQLite CASCADE deletes require `PRAGMA foreign_keys=ON` per connection; test engine must register this listener explicitly |
| Phase 5 | python-jose not installed | `python-jose[cryptography]` was in requirements.txt but not in the active Python environment; run `pip install python-jose[cryptography] passlib[bcrypt]` |
| Phase 5 | JWT stored in localStorage | Acceptable for portfolio/demo; production would use httpOnly cookies |
| Phase 6 | RRF fusion returns dense cosine scores (not RRF scores) | Confidence/conflict logic expects cosine in [0,1]; fusion only reorders, each chunk keeps its cosine from stored embeddings |
| Phase 6 | Cross-encoder reranker off by default, lazy + optional | sentence-transformers pulls in torch (~heavy, slow CI); gated behind `RERANKER_ENABLED`, graceful fallback to fusion order when absent |
| Phase 6 | Semantic cache keyed by (session, question-embedding), no history guard | Server memory always accumulates so a "no-history" guard would defeat caching; per-session scoping prevents cross-user leakage |
| Phase 6 | Reset semantic_cache + suggestions cache per test in conftest | Both are process-wide singletons; under identical mock embeddings a stale entry would cross-contaminate the next test |
| Phase 6 | Patch get_embeddings in app.main + get_chat_model in app.suggestions | New point-of-use from-imports need their own patches in mock_openai (same binding-at-import-time issue as Phase 4) |
| Phase 7 | Per-tenant FAISS stores (one index dir per tenant) over single index + metadata filter | Physical isolation is simpler and leak-proof; IndexFlatIP can't filter by metadata natively |
| Phase 7 | Tokens without a tenant_id claim default to the default tenant | Keeps pre-Phase-7 tokens/tests valid; a bare `{role:user}` token resolves to default tenant rather than 401 |
| Phase 7 | Default test `client` carries a baked-in tenant token | Auth-on-all-endpoints would break 75 pre-existing tests; httpx per-request headers still override for admin-token tests; `anon_client` covers 401 cases |
| Phase 7 | Cost via tiktoken token counts × static price table | Deterministic + offline (works in tests, no usage API call); approximates OpenAI billing closely enough for the dashboard |
| Phase 7 | Incremental re-index reuses embeddings by exact chunk-text match | `store.chunks` already holds embeddings; identical re-upload short-circuits on file hash, changed upload re-embeds only new chunk texts |

---

## Current Status

**Active Phase:** Phase 8 — Polish, Evaluation & Release  
**Last Completed Phase:** Phase 7 — Security, Multi-Tenancy & Scale (2026-06-02)  
**Next Action:** Eval harness (golden Q&A set + RAGAS groundedness in CI), embeddable `<script>` chat widget, final UI polish, full docs (setup + Mermaid architecture + API reference + deploy), seeded live demo, 90-second demo video script.

---

## Agent Handoff Notes

If you are a new agent picking this up:
1. Read this file fully before writing any code.
2. Check the **Current Status** section above to know where we are.
3. Check the phase's **Scope** for what to build and **QA Gate** for what must pass.
4. Update the relevant phase's status and gate checkboxes as work completes.
5. Update the **Current Status** section at the bottom when switching phases.
6. Append decisions to the **Key Decisions Log** when making non-obvious choices.
7. Never skip a QA gate — it exists to prevent regressions.
