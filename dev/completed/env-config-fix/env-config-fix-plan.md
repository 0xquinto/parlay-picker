# Env config fix plan

## Objective
Resolve startup crash from overly strict environment validation and ensure Supabase direct URL is validated alongside existing config.

## Plan
1. Review current environment validation and dependent config (schema.prisma, README) to confirm required keys and current strictness.
2. Update environment schema to accept standard process env keys and include SUPABASE_DIRECT_URL validation matching Supabase connection guidance.
3. Align documentation/notes to reflect the new required variable and run a TypeScript build to verify config compiles.
4. Record outcomes and next steps in task docs.
