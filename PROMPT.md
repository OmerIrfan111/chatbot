# Claude Code Build Prompt: AI Customer Support Agent (RAG)

Build a production-grade, RAG-powered AI customer support agent with a **beautiful, modern web frontend**. Work autonomously through the phases below, committing after each. Ask me only when a decision is irreversible or genuinely ambiguous. Design quality matters as much as functionality — this is a portfolio piece.

## Project Overview

A web app where a business uploads its documentation (PDF, DOCX, TXT, CSV, Markdown, HTML) and gets an AI support chatbot that answers customer questions grounded strictly in those documents, with cited sources, conversation memory, confidence scoring, and an admin analytics dashboard. If the answer isn't in the docs, it must say so rather than hallucinate.

## Tech Stack

**Backend**
- Python 3.11+, FastAPI, Uvicorn
- LangChain for RAG orchestration
- FAISS (dev) + ChromaDB (persistence) behind a swappable vector-store interface
- OpenAI (`text-embedding-3-small`, `gpt-4o-mini`), provider abstracted so other models can be swapped via config
- `pdfplumber`, `python-docx`, `pandas`, `beautifulsoup4`/`unstructured` for parsing
- SQLAlchemy + SQLite (dev) / Postgres (prod) for metadata, chat logs, analytics
- JWT auth with admin vs. end-user roles

**Frontend** (this is the priority)
- Next.js 14+ (App Router) with React and TypeScript
- Tailwind CSS for styling
- shadcn/ui for accessible, polished base components
- Framer Motion for smooth animations and transitions
- lucide-react for icons
- TanStack Query for server state / data fetching
- Zustand for lightweight client state
- react-markdown + react-syntax-highlighter to render answers with formatting and code blocks
- Recharts for the admin dashboard charts
- react-dropzone for drag-and-drop file uploads
- Sonner for toast notifications
- Server-Sent Events (SSE) for streaming chat responses
- next-themes for dark/light mode

**Infra**
- Node 20+, npm/pnpm
- Dockerfile + docker-compose (backend, frontend, db, vector store)
- `.env` for secrets

## Design Direction (make it beautiful)

- Clean, premium SaaS aesthetic — think Linear / Vercel / Stripe quality.
- A cohesive design system: defined color tokens, consistent spacing scale, rounded corners, soft shadows, subtle gradients.
- Polished chat interface: message bubbles, typing indicator while streaming, auto-scroll, smooth fade-in on new messages, copy button on each answer.
- Citations rendered as elegant clickable chips/cards that expand to show the source snippet and page number.
- Confidence shown as a tasteful colored badge (green/amber/red) with a tooltip explaining the score.
- Drag-and-drop upload zone with progress bars, file-type icons, and per-file status (parsing, embedding, ready, error).
- Admin dashboard with stat cards, charts, and a clean table of unanswered questions.
- Fully responsive (mobile → desktop), dark/light mode, accessible (keyboard nav, ARIA), and micro-interactions on hover/focus.
- Skeleton loaders instead of spinners where possible. No generic "AI default" look — give it character.

## Architecture

Two phases. **Ingestion:** load → clean → chunk (RecursiveCharacterTextSplitter, ~500-token chunks, 50-token overlap) → embed → store with metadata (filename, page, section, chunk index, timestamp). **Query:** embed question → hybrid retrieve top 4–5 chunks → rerank → pass context + history to LLM with a strict grounding prompt → stream cited answer + confidence. Frontend talks to FastAPI over a typed REST + SSE API.

## Core Prompt Template

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

## Build Order (commit after each, do not proceed until the phase's QA Gate passes)

### Phase 0 — Foundations & Scaffolding
Monorepo (`backend/`, `frontend/`), FastAPI app with `/health`, Next.js + TS + Tailwind + shadcn/ui scaffold, `.env.example`, Dockerfiles + docker-compose, CI (lint/type-check/test), README skeleton.
**QA Gate:** `docker-compose up` boots all services; `/health` returns 200; lint/type-check/tests pass; no secrets committed; clean-clone setup works.

### Phase 1 — Core RAG Loop (Backend)
Upload (PDF/TXT) → chunk (RecursiveCharacterTextSplitter, ~500/50) → embed → FAISS → retrieve top 4–5 → grounding chain → answer with source metadata. Minimal `/chat` endpoint.
**QA Gate:** sample PDF ingests; in-doc question answers correctly; out-of-doc question returns the refusal (no hallucination); response includes source metadata; 200-page PDF ingests without OOM; rephrased question still retrieves the right chunks.

### Phase 2 — Frontend Chat Experience
Design system in Tailwind config; chat layout with auto-scroll + empty state; SSE streaming with typing indicator; markdown + syntax highlighting + copy button; dark/light mode; responsive; toasts, skeletons, Framer Motion; TanStack Query + typed client.
**QA Gate:** answers stream smoothly with typing indicator; markdown/code render; clean on 375px and desktop; both themes polished; API errors show a friendly toast; Lighthouse a11y ≥ 90; keyboard nav works.

### Phase 3 — Memory & Multi-Format Ingestion
ConversationBufferWindowMemory (last 5); follow-up support; loaders for DOCX/CSV/MD/HTML; drag-and-drop upload with per-file progress/status; edge cases (empty, corrupt, oversized, scanned); OCR fallback (pytesseract); document sidebar with remove/re-index.
**QA Gate:** all six formats ingest and query; two-turn follow-up works; empty/corrupt uploads show clear errors; scanned PDF is OCR'd or flagged; upload status accurate; removing a doc updates the index.

### Phase 4 — Citations & Confidence
Persist rich metadata; return citations as expandable chips showing snippet + page; compute confidence from similarity; green/amber/red badge + tooltip; warn below 0.7; multi-document conflict detection.
**QA Gate:** every grounded answer shows a correct citation; expanding shows the real snippet/page; low-similarity answers show warning badge; contradictory sources surface both with a conflict note; badge clear to non-technical users.

### Phase 5 — Admin Dashboard & Analytics
Log every question/answer/confidence/citation; thumbs up/down feedback; admin route with stat cards (questions/day, answer rate, avg confidence); Recharts visualisations; unanswered-questions (gap) table with export; feedback stats.
**QA Gate:** all interactions logged and visible; stats/charts accurate on a known dataset; gap table populated and exportable; feedback persists; admin pages access-controlled.

### Phase 6 — Advanced Retrieval & AI Features
Hybrid retrieval (dense + BM25); cross-encoder reranker (e.g. bge-reranker); semantic caching; auto-suggested starter questions; language detection + multilingual answers; human-escalation handoff on low confidence.
**QA Gate:** hybrid+rerank beats dense-only on a keyword-heavy query; repeated question served from cache; suggested questions relevant; non-English question answered in kind; low-confidence offers handoff and logs a ticket.

### Phase 7 — Security, Multi-Tenancy & Scale
JWT auth + roles; multi-tenancy (isolate docs + vector namespace by `tenant_id`); guardrails (PII redaction, profanity, prompt-injection defense); per-tenant/IP rate limiting; cost/usage view; document versioning with incremental re-indexing.
**QA Gate:** tenant isolation holds; auth/role checks enforced; injection payload in a doc doesn't override system instructions; PII redacted in logs; rate limits return clean 429s; cost dashboard reconciles with provider usage.

### Phase 8 — Polish, Evaluation & Release
Eval harness with golden Q&A set + groundedness scoring (RAGAS) in CI; embeddable chat widget (single `<script>` bundle); final UI polish pass; full docs (setup, Mermaid architecture, API reference, deploy); live demo with seeded docs; sub-90-second demo video.
**QA Gate:** eval harness in CI meets your groundedness threshold; widget works on a separate HTML page; live demo works from a clean session; README works for a stranger; demo video < 90s shows happy path + graceful refusal; no secrets/data/console errors in production build.

## Additional Features (fold into the relevant phases)

- Streaming responses via SSE with token-by-token rendering.
- Semantic caching of near-identical questions to cut cost/latency.
- Hybrid retrieval (dense + BM25) with a cross-encoder reranker.
- Auto-suggested questions generated per document set, shown as clickable starter chips.
- Multi-document conflict detection — surface both sources and flag contradictions in the UI.
- Feedback loop — thumbs up/down per answer, surfaced in admin.
- Multi-tenant support — isolate docs and vector namespace by `tenant_id`.
- Document versioning & incremental re-indexing — re-embed only changed chunks.
- PII/profanity guardrails + prompt-injection defense (treat retrieved text as untrusted data).
- Multilingual — detect language and answer in kind.
- Scanned-PDF OCR fallback (pytesseract).
- Human escalation handoff — offer "talk to a human" on low confidence; log a ticket.
- Cost/usage dashboard — tokens and $ per tenant.
- Embeddable chat widget — a single `<script>` snippet businesses paste into their site.
- Rate limiting per tenant/IP.
- Eval harness — golden Q&A set + automated groundedness scoring (RAGAS) in CI.

## Folder Structure

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
└── README.md
```

## Edge Cases (must handle)

200-page PDFs without OOM (batched chunking); off-topic questions (decline gracefully); rephrased questions (retrieval still hits); empty/corrupt uploads (clear UI errors); contradictory docs (surface both); concurrent uploads; long conversations (memory window + summarization); SSE reconnection on dropped connections.

## Quality Bar

TypeScript strict mode and ESLint/Prettier on the frontend; type hints, docstrings, and `pytest` on the backend; structured logging; `.env.example` with no real keys; README with setup, Mermaid architecture diagram, screenshots, and a demo script. Never commit `.env`, `data/`, or `node_modules`.

## Standing QA Principles (apply every phase)

- Commit after each passing gate; never commit a phase that fails its QA.
- Keep the grounding rule sacred: the bot must refuse rather than hallucinate at every stage.
- No secrets in the repo — verify before every push.
- Each new feature ships with at least one test and updated README notes.
- Re-run the previous phase's gate after major changes to catch regressions.
- Track cost: watch token usage so the demo stays cheap to run.

## Deliverable

Full app runnable via `docker-compose up`, seeded with sample docs, plus a documented 90-second demo flow: upload → ask 3–4 questions (including one the docs can't answer) → show streaming answer, citations, confidence badge, and the admin dashboard. The frontend must look genuinely polished and portfolio-ready.

---

**Start with Phase 0, confirm it runs end to end, then proceed through each phase in order. Give me a short summary after each phase and do not advance past a phase until its QA Gate passes.**
