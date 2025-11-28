# OpenRouter Exa agent plan

## Objective
Implement an OpenRouter-driven agent that uses Exa search + content scraping as tools, so LLM responses can ground on fetched web content.

## Plan
1. Review current Exa and OpenRouter usage and choose API approach (OpenAI-compatible tools with chat/completions).
2. Implement an agent module that defines Exa search/content tools, runs the tool-calling loop with OpenRouter, and returns grounded answers.
3. Add lightweight README notes on configuring Exa + OpenRouter keys and how to invoke the agent.
4. Validate with a small dry-run (non-networked mock) or code review for correctness; update task docs.
