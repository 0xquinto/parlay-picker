# Cross contamination guard context

- Issue: articles/predictions being matched to the wrong games (same team different matchup/week/season).
- Approach: tighten article relevance to current week games using team alias detection, skip if no matchup found, and validate LLM outputs against an order-insensitive game map.
- Implemented: `getTeamAliases` in team normalizer; extraction now finds relevant games by alias hits in article text, skips if none, builds an order-insensitive game map, and logs dropped predictions.
- Key files: `src/utils/team-normalizer.ts`, `src/services/llm-extraction.service.ts`.
- Verification: `npm run build` passes.
