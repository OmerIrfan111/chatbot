# AI Support Agent

A production-grade, RAG-powered AI customer support chatbot. Upload your documentation and get an AI assistant that answers questions grounded strictly in your docs — with cited sources, confidence scoring, and an admin analytics dashboard.

> **Portfolio piece** — Linear/Vercel/Stripe-quality UI + solid backend engineering.

---

## Quick Start

```bash
# 1. Clone
git clone <repo-url>
cd ai-support-agent

# 2. Configure
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Run
docker-compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs
- ChromaDB: http://localhost:8001

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│            Next.js 14 (App Router + SSE)                │
└──────────────────────┬──────────────────────────────────┘
                       │ REST + SSE
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                        │
│  /upload → ingest → chunk → embed → vector store        │
│  /chat   → embed query → retrieve → rerank → LLM → SSE  │
└────────┬────────────────────────────────────┬───────────┘
         │                                    │
┌────────▼────────┐                  ┌────────▼────────┐
│  FAISS / Chroma │                  │  SQLite/Postgres │
│  (vector store) │                  │  (metadata, logs)│
└─────────────────┘                  └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| State | TanStack Query + Zustand |
| Streaming | SSE (Server-Sent Events) |
| Backend | Python 3.11, FastAPI, LangChain |
| LLM | OpenAI gpt-4o-mini + text-embedding-3-small |
| Vector DB | FAISS (dev) / ChromaDB (prod) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (admin + user roles) |
| Infra | Docker + docker-compose |

---

## Project Structure

```
.
├── backend/          # FastAPI application
│   ├── app/          # Application modules
│   └── tests/        # pytest tests
├── frontend/         # Next.js application
│   ├── app/          # App Router pages
│   ├── components/   # React components
│   ├── lib/          # Utilities & API client
│   └── store/        # Zustand stores
├── .env.example      # Environment variable template
├── docker-compose.yml
└── CLAUDE.md         # Build plan & phase tracking
```
## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run lint && npx tsc --noEmit
```

---

## Demo Flow

1. Upload a PDF or DOCX document
2. Ask a question answered by the doc → get a streamed answer with citations and confidence badge
3. Ask a question outside the doc → get a polite refusal (no hallucination)
4. Check the Admin dashboard for analytics and unanswered question gaps
