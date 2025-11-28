# Cross contamination guard plan

## Objective
Reduce mis-attribution of articles/predictions to the wrong games by tightening article relevance checks and schedule-aware validation during extraction.

## Plan
1. Add team alias helper to evaluate article text against team mentions.
2. In extraction, detect relevant games for the week based on article content; skip ingestion when no clear matchup, and use order-insensitive game mapping when validating LLM output.
3. Log drops for audit and keep build passing.
