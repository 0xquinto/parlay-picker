# README Supabase update context

- Goal: ensure README explains SUPABASE_URL (pooler) vs SUPABASE_DIRECT_URL (direct/session) to match environment validation and Prisma schema.
- Key files: README.md, .env.example, src/config/environment.ts, src/database/schema.prisma.
- Notes: app should use pooler (port 6543) with `?pgbouncer=true`; migrations use direct/session (port 5432).
- README updated accordingly; no code changes or builds needed.
