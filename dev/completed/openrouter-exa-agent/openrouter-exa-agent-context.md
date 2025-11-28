# OpenRouter Exa agent context

- Need: enable OpenRouter agent to call Exa search and scrape content (Exa contents endpoint) via tool calls.
- Existing Exa usage: `src/services/exa-discovery.service.ts` for article discovery using `EXA_ENDPOINT` search only.
- Existing OpenRouter usage: `src/services/llm-extraction.service.ts` uses chat completions for extraction, no tools.
- Approach: OpenAI-compatible tool-calling loop with OpenRouter chat completions; tools call Exa search and contents with `axios` using `EXA_API_KEY`.
- Implemented agent at `src/agents/openrouter-exa-agent.ts` with `runExaGroundedAgent(query)`; tools: `exa_search` and `exa_fetch_content`.
- README updated with usage snippet and env requirements.
- Env: `EXA_API_KEY` and `OPENROUTER_API_KEY` already validated in `src/config/environment.ts`.
- Verification: `npm run build` passes (no live network calls run in this environment).
