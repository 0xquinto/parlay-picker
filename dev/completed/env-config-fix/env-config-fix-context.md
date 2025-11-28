# Env config fix context

- Problem: environment validation uses `z.strict()` against `process.env`, causing startup failure from extra system keys; schema also omits `SUPABASE_DIRECT_URL` required by `schema.prisma`.
- Key files: `src/config/environment.ts` (validation), `src/database/schema.prisma` (directUrl reference), `.env` guidance in `README.md`.
- Desired outcome: allow standard env vars through while validating required Supabase URLs (including direct URL) and keep build passing.
- Current changes: removed `.strict()` from `EnvSchema` and added `SUPABASE_DIRECT_URL` string validation (min length 10).
- Additional fixes to clear build: typed Prisma log config and handlers in `src/database/client.ts` (LogDefinition[] + explicit Prisma event types) and guarded/casted pick side indexing in `src/services/consensus-calculator.service.ts`.
- Verification: `npm run build` now passes.
