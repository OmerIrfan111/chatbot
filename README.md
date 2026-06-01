# AI Support Agent

A production-grade, RAG-powered AI customer support chatbot. Upload documentation and get an AI assistant that answers questions **strictly grounded in your docs** with cited sources, confidence scoring, conversation memory, and an admin analytics dashboard.

> Portfolio piece — Linear/Vercel/Stripe-quality UI + solid backend engineering.

---

## Quick Start

```bash
# 1. Clone and enter
git clone <repo-url>
cd ai-support-agent

# 2. Configure environment
cp .env.example .env
# Edit .env — set OPENAI_API_KEY and optionally JWT_SECRET

# 3. Launch everything
docker-compose up
```

Open http://localhost:3000 in your browser.

| Service     | URL                          |
|-------------|------------------------------|
| Frontend    | http://localhost:3000        |
| Backend API | http://localhost:8000        |
| API Docs    | http://localhost:8000/docs   |
| ChromaDB    | http://localhost:8001        |

---

## Architecture

```mermaid
flowchart TB
    subgraph Browser["Browser"]
        UI["Next.js 14 App Router<br/>React + Tailwind + Framer Motion"]
        W["Embeddable Widget<br/>&lt;script&gt; tag"]
    end

    subgraph Backend["FastAPI Backend"]
        API["REST + SSE Endpoints"]
        INGEST["Ingestion Pipeline<br/>Parse → Chunk → Embed"]
        RET["Retrieval<br/>Hybrid Dense + BM25"]
        CHAIN["Grounding Chain<br/>LLM + Prompt"]
        MEM["Memory<br/>Window Buffer"]
        CACHE["Semantic Cache"]
        AUTH["JWT Auth<br/>Multi-Tenant"]
        GUARD["Guardrails<br/>PII / Injection / Profanity"]
        USAGE["Cost Tracking<br/>tiktoken"]
    end

    subgraph Storage["Storage Layer"]
        VS["Vector Store<br/>FAISS / ChromaDB"]
        DB["SQLite / PostgreSQL<br/>Metadata + Logs"]
    end

    UI -->|"REST + SSE"| API
    W -->|"REST + SSE"| API
    API --> AUTH
    API --> INGEST
    API --> RET
    API --> CHAIN
    API --> MEM
    API --> CACHE
    API --> GUARD
    API --> USAGE
    INGEST --> VS
    INGEST --> DB
    RET --> VS
    CHAIN --> DB
    USAGE --> DB
```

### Flow

1. **Ingestion**: Upload PDF, DOCX, TXT, CSV, MD, or HTML → parse → chunk (500 tokens, 50 overlap) → embed (OpenAI `text-embedding-3-small`) → store in FAISS + ChromaDB with metadata
2. **Query**: Embed question → hybrid retrieve (dense cosine + BM25, RRF fusion) → optional cross-encoder rerank → pass top chunks + history to LLM with strict grounding prompt → stream answer with citations, confidence, and conflict detection
3. **Memory**: Last 5 conversation turns preserved per session for follow-up support
4. **Analytics**: Every interaction logged with tokens/cost, confidence, and user feedback; surfaced in admin dashboard with charts and gap analysis

---

## Tech Stack

| Layer           | Technology                                                    |
|-----------------|---------------------------------------------------------------|
| Frontend        | Next.js 14 (App Router), TypeScript (strict), Tailwind CSS    |
| UI Components   | Custom + shadcn/ui, Framer Motion, lucide-react               |
| State           | TanStack Query + Zustand                                      |
| Streaming       | Server-Sent Events (SSE)                                      |
| Styling         | Tailwind CSS, CSS variables, OKLCH color palette              |
| Backend         | Python 3.11, FastAPI, Uvicorn                                 |
| RAG Framework   | LangChain                                                     |
| LLM             | OpenAI `gpt-4o-mini` (provider-abstracted)                    |
| Embeddings      | OpenAI `text-embedding-3-small`                               |
| Vector Store    | FAISS (dev) / ChromaDB (prod) — swappable interface           |
| Database        | SQLite (dev) / PostgreSQL (prod) — SQLAlchemy ORM             |
| Retrieval       | Hybrid dense + BM25 (rank_bm25), optional cross-encoder       |
| Auth            | JWT (admin + tenant-scoped user tokens)                       |
| Parsing         | pdfplumber, python-docx, pandas, beautifulsoup4, unstructured |
| OCR             | pytesseract for scanned PDFs                                  |
| Guardrails      | PII redaction, profanity filter, prompt-injection defense     |
| Cost Tracking   | tiktoken token counts × price table                           |
| Infra           | Docker, docker-compose                                        |

---

## Project Structure

```
ai-support-agent/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app + routes
│   │   ├── ingest.py         # File parsing, chunking, embedding
│   │   ├── retriever.py      # Hybrid search (dense + BM25)
│   │   ├── chain.py          # Grounding LLM chain
│   │   ├── memory.py         # Session memory store
│   │   ├── llm.py            # Provider-agnostic LLM wrapper
│   │   ├── vectorstore.py    # FAISS/Chroma swappable interface
│   │   ├── guardrails.py     # PII redaction, injection defense
│   │   ├── analytics.py      # Dashboard stats aggregations
│   │   ├── auth.py           # JWT creation and verification
│   │   ├── ratelimit.py      # Sliding-window rate limiter
│   │   ├── usage.py          # Token counting + cost estimation
│   │   ├── semantic_cache.py # Near-duplicate question cache
│   │   ├── suggestions.py    # Auto-generated starter questions
│   │   ├── reranker.py       # Optional cross-encoder reranker
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── config.py         # Pydantic settings
│   │   └── database.py       # Engine + session factory
│   ├── tests/                # pytest suite (89+ tests)
│   ├── evals/                # Golden Q&A set + eval harness
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/                  # Next.js App Router pages
│   │   ├── page.tsx          # Chat interface
│   │   ├── admin/page.tsx    # Admin dashboard
│   │   └── layout.tsx        # Root layout + providers
│   ├── components/
│   │   ├── chat/             # Message, ChatWindow, ChatInput, etc.
│   │   ├── upload/           # Dropzone, DocumentList
│   │   ├── layout/           # Sidebar, ThemeToggle
│   │   └── ui/               # shadcn/ui primitives
│   ├── lib/                  # API client, hooks, types, utils
│   ├── store/                # Zustand stores
│   ├── widget/               # Embeddable chat widget
│   ├── tailwind.config.ts
│   └── package.json
├── evals/
│   ├── golden_set.json       # 10 golden Q&A pairs
│   ├── evaluate.py           # CI-friendly eval harness
│   └── seed_demo.py          # Seed sample documents for demo
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                 # Build plan & phase tracking
```

---

## Features

### Core RAG
- **Strict grounding**: Answers only from uploaded documents; refuses out-of-scope questions
- **Multi-format ingestion**: PDF, DOCX, TXT, CSV, MD, HTML (6 formats)
- **Hybrid retrieval**: Dense (FAISS cosine) + BM25 fusion with reciprocal rank fusion
- **Optional reranker**: Cross-encoder for improved result ordering
- **Semantic caching**: Near-duplicate questions served from cache (no LLM call)

### Chat Experience
- **SSE streaming**: Token-by-token streaming with typing indicator
- **Conversation memory**: Last 5 turns preserved per session
- **Multilingual**: Auto-detects language and responds in kind
- **Markdown rendering**: Full markdown + code syntax highlighting
- **Citations**: Expandable chips showing source document, page, and snippet
- **Confidence scoring**: Color-coded badge (green/amber/red) with explanatory tooltip
- **Conflict detection**: Flags when answer draws from multiple contradictory sources

### Admin Dashboard
- **Stat cards**: Questions today, answer rate, avg confidence, total questions
- **Charts**: Daily question volume (line), confidence distribution (bar), user feedback (pie)
- **Gap analysis**: Unanswered/low-confidence questions table with CSV export
- **Feedback**: Thumbs up/down per answer with satisfaction rate
- **Usage/cost**: Token and USD cost tracking per tenant

### Enterprise
- **Multi-tenancy**: Isolated documents, vector namespaces, and analytics per tenant
- **JWT auth**: Admin and tenant-scoped user roles
- **Rate limiting**: Per-tenant/IP sliding window with clean 429 responses
- **Guardrails**: PII redaction, profanity filtering, prompt-injection defense
- **Human escalation**: Low-confidence answers offer handoff with ticket logging
- **Document versioning**: Incremental re-indexing of changed chunks only

### Embeddable Widget
- **Single `<script>` tag**: Paste into any HTML page
- **Configurable**: API URL, tenant, color, title, greeting
- **SSE streaming**: Real-time answers in the widget
- **Mobile responsive**: Adapts to small screens

---

## Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- npm
- OpenAI API key

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
cp ../.env.example ../.env
# Edit .env with your OPENAI_API_KEY
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Testing

```bash
# Backend (89+ tests)
cd backend && pytest

# Frontend
cd frontend && npm run lint && npx tsc --noEmit

# Eval harness (against running backend)
cd backend && uvicorn app.main:app &
python ../evals/seed_demo.py
python ../evals/evaluate.py
```

---

## API Reference

### Public Endpoints

| Method | Path              | Description                         |
|--------|-------------------|-------------------------------------|
| GET    | `/health`         | Health check with indexed chunk count |

### Auth

| Method | Path              | Description                         |
|--------|-------------------|-------------------------------------|
| POST   | `/auth/login`     | Admin login (email + password) → JWT |
| POST   | `/auth/token`     | Exchange tenant API key for user token |

### Chat

| Method | Path              | Description                         |
|--------|-------------------|-------------------------------------|
| POST   | `/chat`           | Non-streaming Q&A (returns full answer) |
| POST   | `/chat/stream`    | SSE streaming Q&A response          |
| GET    | `/suggestions`    | Auto-generated starter questions     |
| POST   | `/escalate`       | Submit human handoff ticket          |

**Request body** (`/chat`, `/chat/stream`):
```json
{
  "question": "What is your refund policy?",
  "session_id": "user-abc123",
  "chat_history": []
}
```

**SSE event types** (`/chat/stream`):
```
data: {"type": "token", "content": "We offer a "}
data: {"type": "token", "content": "30-day refund..."}
data: {"type": "done", "sources": [...], "confidence": 0.94, ...}
data: {"type": "error", "message": "..."}
```

### Documents

| Method | Path                    | Description              |
|--------|-------------------------|--------------------------|
| POST   | `/upload`               | Upload a document (multipart) |
| GET    | `/documents`            | List indexed documents   |
| DELETE | `/documents/{id}`       | Remove a document        |

### Feedback

| Method | Path                     | Description              |
|--------|--------------------------|--------------------------|
| POST   | `/feedback/{interaction_id}` | Submit thumbs up/down (1 or -1) |

### Analytics (admin-only)

| Method | Path                          | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | `/analytics/stats`            | Dashboard stats + charts     |
| GET    | `/analytics/usage`            | Token/cost usage per tenant  |
| GET    | `/analytics/gaps`             | Unanswered/low-confidence questions |
| GET    | `/analytics/gaps/export`      | CSV download of gaps         |
| GET    | `/tickets`                    | List human escalation tickets |

### Sessions

| Method | Path                     | Description              |
|--------|--------------------------|--------------------------|
| GET    | `/sessions`              | List active sessions     |
| DELETE | `/sessions/{id}`         | Clear session memory     |

---

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable                       | Default                    | Description                        |
|-------------------------------|----------------------------|------------------------------------|
| `OPENAI_API_KEY`              | —                          | OpenAI API key                     |
| `OPENAI_CHAT_MODEL`           | `gpt-4o-mini`              | LLM model                          |
| `OPENAI_EMBEDDING_MODEL`      | `text-embedding-3-small`   | Embedding model                    |
| `DATABASE_URL`                | `sqlite:///./data/app.db`  | Database connection                |
| `VECTOR_STORE_PATH`           | `./data/faiss_index`       | Vector index directory             |
| `VECTOR_STORE_TYPE`           | `faiss`                    | `faiss` or `chroma`                |
| `JWT_SECRET`                  | `change-me-in-production`  | Secret for JWT signing             |
| `ADMIN_EMAIL`                 | `admin@example.com`        | Admin login email                  |
| `ADMIN_PASSWORD`              | `change-me`               | Admin login password               |
| `RATE_LIMIT_ENABLED`          | `true`                     | Enable rate limiting               |
| `RATE_LIMIT_PER_MINUTE`       | `60`                       | Max requests per minute            |
| `HYBRID_ENABLED`              | `true`                     | Enable hybrid (dense + BM25) retrieval |
| `RERANKER_ENABLED`            | `false`                    | Enable cross-encoder reranker      |
| `SEMANTIC_CACHE_ENABLED`      | `true`                     | Enable semantic caching            |
| `GUARDRAILS_ENABLED`          | `true`                     | Enable PII/injection guardrails    |
| `NEXT_PUBLIC_API_URL`         | `http://localhost:8000`    | Frontend backend URL               |
| `NEXT_PUBLIC_TENANT_ID`       | `default`                  | Tenant ID for widget auth          |
| `NEXT_PUBLIC_TENANT_API_KEY`  | `demo-key`                | Tenant API key for widget auth     |

---

## Deployment

### Docker (recommended)

```bash
# Build and run all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Production considerations

- **Database**: Switch `DATABASE_URL` to PostgreSQL
- **Vector store**: Set `VECTOR_STORE_TYPE=chroma` for persistence
- **Auth**: Set strong `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- **Multi-tenancy**: Configure `TENANT_API_KEYS` as a JSON map
- **CORS**: Set `ALLOWED_ORIGINS` to your production domain
- **Secret management**: Use Docker secrets or a vault; never store secrets in `.env` committed to git

---

## Demo Flow

1. **Upload** a document (PDF, TXT, DOCX) via the folder icon sidebar
2. **Ask** an in-document question — watch the streaming answer with citations
3. **Ask** an out-of-scope question — see the graceful refusal
4. **Check** the confidence badge (green/amber/red) and expand source citations
5. **Give feedback** with thumbs up/down
6. **Visit** `/admin` — sign in (default: `admin@example.com` / `change-me`)
7. **Explore** the dashboard: questions/day chart, confidence breakdown, gap table

## Chunking Strategy

| Parameter       | Value            |
|-----------------|------------------|
| Splitter        | RecursiveCharacterTextSplitter |
| Chunk size      | ~500 tokens      |
| Chunk overlap   | 50 tokens        |
| Metadata        | filename, page, section, chunk_index, timestamp |
| Retrieval       | Top 4-5 chunks (hybrid dense + BM25, RRF fusion) |

