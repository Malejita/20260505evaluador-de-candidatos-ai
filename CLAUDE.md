# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Arranca backend (puerto 3001) + frontend (puerto 3000) simultáneamente
npm run build     # Production build del frontend
npm run preview   # Preview production build
npm run lint      # TypeScript type checking (tsc --noEmit)
```

There are no automated tests — `lint` is the only validation step.

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. The API key is used exclusively by the backend server (`server/index.ts`) — it is never exposed to the browser.

## Architecture

React 19 + TypeScript + Vite frontend with an Express backend. The project is organized in two clear layers:

```
server/                  ← BACKEND (la cocina) — Node.js, never visible in browser
  index.ts              ← Express server + 4 API routes on port 3001
  services/
    gemini.ts           ← All Gemini SDK calls (uses GEMINI_API_KEY)

src/                     ← FRONTEND (el cliente) — runs in browser
  App.tsx               ← Full UI and state machine (~695 lines)
  services/
    apiClient.ts        ← HTTP client that calls /api/* endpoints (no AI SDK here)
  lib/
    fileParser.ts       ← Client-side file parsing (PDF/DOCX/TXT)
```

**[server/index.ts](server/index.ts)** — Express server. Receives requests from the frontend, delegates to `server/services/gemini.ts`, returns JSON. In production, also serves the built frontend as static files.

**[server/services/gemini.ts](server/services/gemini.ts)** — All Gemini API calls. Uses `gemini-2.0-flash` model. Four exported functions:
- `extractCriteria(jobDescription)` → `JDCriteria`
- `evaluateCandidate(cvText, criteria, jobTitle)` → `CandidateEvaluation`
- `generateExecutiveSummary(evaluations)` → `{ summary: string }`
- `generateInterviewQuestions(candidate, jobDescription)` → `{ questions: string[] }`

**[src/App.tsx](src/App.tsx)** — The entire UI and state machine (~695 lines). Manages two views:
- `evaluation`: sidebar with job description input + criteria extraction; main area with CV uploads, scoring table, executive summary, and candidate selection.
- `interview`: shows selected candidates with their AI-generated interview questions.

State flows strictly downward — there is no external state library. Key state:
- `jdCriteria`: extracted from job description via AI, editable by user before evaluation
- `candidates`: array with file-parsed text + evaluation result per candidate
- `selectedCandidates`: subset advanced to the interview view

**[src/services/apiClient.ts](src/services/apiClient.ts)** — HTTP client. Calls the 4 backend endpoints (`/api/extract-criteria`, `/api/evaluate-candidate`, `/api/executive-summary`, `/api/interview-questions`). Does NOT import the Gemini SDK.

**[src/lib/fileParser.ts](src/lib/fileParser.ts)** — Client-side file parsing. `parseFile()` dispatches to:
- `parsePDF()` via `pdfjs-dist` (worker loaded from CDN in development)
- `parseDocx()` via `mammoth`
- `parseText()` via `FileReader`

Throws descriptive errors for password-protected PDFs, scanned-image PDFs, and empty files.

## Key Constraints

- The pdfjs worker is sourced from a CDN URL in `fileParser.ts`. In environments without internet access this will fail silently for PDFs.
- In development, Vite proxies `/api` requests to `http://localhost:3001` (configured in `vite.config.ts`).
- The app is designed for deployment to Google AI Studio (Cloud Run). The `metadata.json` at the root is an AI Studio manifest.
- Tailwind is configured via the `@tailwindcss/vite` plugin (not a `tailwind.config.*` file). Path alias `@/` maps to `src/`.
