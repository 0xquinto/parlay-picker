# README Supabase update plan

## Objective
Clarify Supabase connection string usage (pooler vs direct) in README, aligning with environment validation and .env.example.

## Plan
1. Review current README env/database guidance and .env.example defaults.
2. Add concise instructions for SUPABASE_URL (pooler, pgbouncer flag) vs SUPABASE_DIRECT_URL (direct/session) with example formats.
3. Update task/context docs and keep build status noted (no code changes expected).
