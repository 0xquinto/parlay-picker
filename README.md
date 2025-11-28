# NFL Prediction Aggregator

TypeScript service that discovers weekly NFL picks from curated blogs, extracts predictions with LLMs, stores them in Postgres via Prisma, calculates consensus signals, and publishes results to Google Sheets.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Environment**
   - Copy `.env.example` to `.env`.
   - Supabase:
     - `SUPABASE_URL`: use the **pooler/transaction** URI (usually port `6543`) and add `?pgbouncer=true` so Prisma treats it as pooled.
     - `SUPABASE_DIRECT_URL`: use the **direct/session** URI (usually port `5432`) without the pgbouncer flag for migrations.
   - Provide Exa, OpenRouter, and Google credentials. Ensure `GOOGLE_SHEETS_CREDENTIALS` points to a local service account JSON file.
3. **Database**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
   - App traffic: Supabase **pooler** URI (`aws-0-<region>.pooler.supabase.com:6543` or similar) with `?pgbouncer=true` in `SUPABASE_URL`.
   - Migrations: Supabase **session/direct** URI (typically port 5432) in `SUPABASE_DIRECT_URL`.
4. **Run**
   ```bash
   npm run dev
   ```
   - Health check: `GET /health`
   - Trigger ingestion: `POST /ingest`

## Architecture

- **Express** API with scheduled ingestion via `node-cron`.
- **Services** for Exa discovery, article fetching, LLM extraction (OpenRouter), consensus calculation, and Google Sheets publishing.
- **Prisma** models defined in `src/database/schema.prisma`.
- **Config** and validation in `src/config/environment.ts`.

## Exa-grounded OpenRouter agent

- The agent in `src/agents/openrouter-exa-agent.ts` uses OpenRouter tool-calling to invoke Exa search and content scraping.
- Requires `EXA_API_KEY` and `OPENROUTER_API_KEY` in `.env`.
- Example usage:
  ```ts
  import { runExaGroundedAgent } from "./src/agents/openrouter-exa-agent";

  const { answer } = await runExaGroundedAgent("Latest injury updates for the Chiefs this week");
  console.log(answer);
  ```
## Notes

- The ingestion job will skip if another run is in progress.
- Article caching uses SHA256 of URL+HTML to avoid duplicate processing.
