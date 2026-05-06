# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server on port 3000
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # TypeScript type checking (tsc --noEmit)
```

There are no automated tests — `lint` is the only validation step.

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. The Vite config injects this into the bundle via `import.meta.env.VITE_GEMINI_API_KEY`. A second variable `APP_URL` is used for the AI Studio deployment URL but is not required for local dev.

## Architecture

Single-page React 19 + TypeScript app built with Vite. All application logic lives in three files:

**[src/App.tsx](src/App.tsx)** — The entire UI and state machine (~695 lines). Manages two views:
- `evaluation`: sidebar with job description input + criteria extraction; main area with CV uploads, scoring table, executive summary, and candidate selection.
- `interview`: shows selected candidates with their AI-generated interview questions.

State flows strictly downward — there is no external state library. Key state:
- `jdCriteria`: extracted from job description via AI, editable by user before evaluation
- `candidates`: array with file-parsed text + evaluation result per candidate
- `selectedCandidates`: subset advanced to the interview view

**[src/services/geminiService.ts](src/services/geminiService.ts)** — All Gemini API calls. Uses `gemini-2.0-flash` model. Four functions:
- `extractCriteriaFromJD(jobDescription)` → `JDCriteria` (experience, skills, education, achievements)
- `evaluateCandidate(cvText, criteria)` → `CandidateEvaluation` (score 1–10, justification, strengths, gaps, recommendation)
- `generateExecutiveSummary(evaluations)` → markdown string recommending top 3
- `generateInterviewQuestions(candidate, criteria)` → 3 personalized questions

All functions parse JSON from model responses. If the model wraps output in a markdown code block, the response is stripped before parsing.

**[src/lib/fileParser.ts](src/lib/fileParser.ts)** — Client-side file parsing. `parseFile()` dispatches to:
- `parsePDF()` via `pdfjs-dist` (worker loaded from CDN in development)
- `parseDocx()` via `mammoth`
- `parseText()` via `FileReader`

Throws descriptive errors for password-protected PDFs, scanned-image PDFs, and empty files.

## Key Constraints

- The pdfjs worker is sourced from a CDN URL in `fileParser.ts`. In environments without internet access this will fail silently for PDFs.
- The app is designed for deployment to Google AI Studio (Cloud Run). The `metadata.json` at the root is an AI Studio manifest.
- Tailwind is configured via the `@tailwindcss/vite` plugin (not a `tailwind.config.*` file). Path alias `@/` maps to `src/`.
