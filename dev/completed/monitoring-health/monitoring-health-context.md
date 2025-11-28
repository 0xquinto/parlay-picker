# Monitoring health context

- Need: simple monitoring to tell if DB and ingestion are healthy without external tooling.
- Implemented: ingestion state tracker (`src/monitoring/ingestion-state.ts`) and /health DB ping + snapshot; /ingest returns snapshot when started.
- Affected files: `src/monitoring/ingestion-state.ts`, `src/jobs/daily-ingestion.job.ts`, `src/index.ts`.
- Verification: `npm run build` passes.
