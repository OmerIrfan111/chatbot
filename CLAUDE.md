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
**Status:** `[ ] NOT STARTED`

**Scope:**
- `ConversationBufferWindowMemory` (last 5 turns)
- Follow-up question support
- Loaders: DOCX, CSV, MD, HTML (in addition to PDF/TXT)
- Drag-and-drop upload UI with per-file progress + status chips
- Edge cases: empty files, corrupt files, oversized files, scanned PDFs
- OCR fallback (pytesseract) for scanned PDFs
- Document sidebar: list, remove, re-index

**QA Gate:**
- [ ] All 6 formats (PDF, TXT, DOCX, CSV, MD, HTML) ingest and query
- [ ] Two-turn follow-up ("what about X?") resolves correctly
- [ ] Empty/corrupt uploads show clear UI errors
- [ ] Scanned PDF is OCR'd or flagged
- [ ] Upload status (parsing → embedding → ready / error) accurate
- [ ] Removing a doc updates the vector index

---

### Phase 4 — Citations & Confidence
**Status:** `[ ] NOT STARTED`

**Scope:**
- Persist rich chunk metadata in DB
- Return citations as expandable chips: snippet + page + document
- Compute confidence score from similarity scores
- Color-coded badge: green (≥0.85) / amber (0.70–0.84) / red (<0.70)
- Tooltip explaining confidence to non-technical users
- Warning UI for low-confidence answers (< 0.70)
- Multi-document conflict detection (surface both sources + flag)

**QA Gate:**
- [ ] Every grounded answer shows at least one correct citation
- [ ] Expanding citation chip shows real snippet and page
- [ ] Low-similarity answers trigger warning badge
- [ ] Contradictory sources surface both with a conflict note
- [ ] Badge is understandable to non-technical users

---

### Phase 5 — Admin Dashboard & Analytics
**Status:** `[ ] NOT STARTED`

**Scope:**
- Log every question, answer, confidence score, citations to DB
- Thumbs up/down feedback per answer
- Admin route (access-controlled, JWT admin role)
- Stat cards: questions/day, answer rate, avg confidence
- Recharts visualizations (time-series, bar, pie)
- "Gap" table: unanswered/low-confidence questions with CSV export
- Feedback stats view

**QA Gate:**
- [ ] All interactions logged and visible in dashboard
- [ ] Stats and charts accurate on a known dataset
- [ ] Gap table populated and CSV export works
- [ ] Feedback (thumbs) persists across sessions
- [ ] Admin pages return 403 to non-admin users

---

### Phase 6 — Advanced Retrieval & AI Features
**Status:** `[ ] NOT STARTED`

**Scope:**
- Hybrid retrieval: dense (FAISS) + BM25 (rank_bm25)
- Cross-encoder reranker (e.g. `bge-reranker-base` via sentence-transformers)
- Semantic caching (skip LLM for near-duplicate questions)
- Auto-suggested starter questions per document set (shown as clickable chips)
- Language detection (langdetect) + multilingual answers (respond in user's language)
- Human escalation handoff: offer "talk to a human" on low confidence; log a ticket

**QA Gate:**
- [ ] Hybrid + rerank outperforms dense-only on a keyword-heavy test query
- [ ] Repeated question served from semantic cache (no extra LLM call)
- [ ] Suggested questions are relevant to the uploaded docs
- [ ] Non-English question answered in the same language
- [ ] Low-confidence response offers human handoff and logs a ticket

---

### Phase 7 — Security, Multi-Tenancy & Scale
**Status:** `[ ] NOT STARTED`

**Scope:**
- JWT auth + roles enforced on all endpoints
- Multi-tenancy: isolate docs + vector namespace by `tenant_id`
- Guardrails: PII redaction in logs, profanity filter, prompt-injection defense
- Per-tenant + per-IP rate limiting (clean 429 responses)
- Cost/usage dashboard: tokens and $ per tenant
- Document versioning + incremental re-indexing (re-embed only changed chunks)

**QA Gate:**
- [ ] Tenant A cannot see Tenant B's documents or answers
- [ ] All auth/role checks enforced (401/403 on violations)
- [ ] Injection payload in a doc doesn't override system instructions
- [ ] PII redacted in logs (no raw SSNs, emails, etc.)
- [ ] Rate limit returns clean 429 with Retry-After header
- [ ] Cost dashboard reconciles with OpenAI usage page

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

---

## Current Status

**Active Phase:** Phase 3 — Memory & Multi-Format Ingestion  
**Last Completed Phase:** Phase 2 — Frontend Chat Experience (2026-06-01)  
**Next Action:** Add ConversationBufferWindowMemory, DOCX/CSV/MD/HTML loaders, drag-and-drop with per-file status, OCR fallback, document sidebar remove/re-index.

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
