# Monitoring health plan

## Objective
Expose lightweight runtime signals (DB ping + ingestion status) to help monitor the service via /health and ingestion runs.

## Plan
1. Add ingestion run state tracking (start/success/fail/skip, counts/errors, duration).
2. Expose DB ping and ingestion snapshot on /health and surface snapshot on /ingest response.
3. Build to verify types and keep docs noted.
