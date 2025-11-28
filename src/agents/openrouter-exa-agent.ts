import axios from "axios";
import { env } from "../config/environment";
import { log } from "../utils/logger";

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  name?: string;
  tool_call_id?: string;
};

type OpenRouterChoice = {
  message?: ChatMessage;
  finish_reason?: string;
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
};

type ExaSearchResult = {
  id?: string;
  url: string;
  title?: string;
  publishedDate?: string;
  text?: string;
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const EXA_SEARCH_ENDPOINT = "https://api.exa.ai/search";
const EXA_CONTENTS_ENDPOINT = "https://api.exa.ai/contents";

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const MAX_TOOL_ITERATIONS = 4;
const MAX_CONTENT_PREVIEW = 1200;

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "exa_search",
      description: "Search the web with Exa and return recent, relevant URLs.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query to run on Exa." },
          numResults: { type: "integer", description: "Max number of results to return", default: 5, minimum: 1, maximum: 10 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exa_fetch_content",
      description: "Fetch the page content for Exa result ids or URLs to ground the answer.",
      parameters: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            description: "Exa result ids from exa_search.",
            items: { type: "string" },
          },
          urls: {
            type: "array",
            description: "URLs to fetch if ids are not available.",
            items: { type: "string", format: "uri" },
          },
        },
      },
    },
  },
];

const headers = {
  openrouter: {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  exa: {
    "x-api-key": env.EXA_API_KEY,
    "Content-Type": "application/json",
  },
};

const safeParseArgs = (args: string): Record<string, unknown> => {
  try {
    return JSON.parse(args);
  } catch (error) {
    log.error("Failed to parse tool arguments", { args, error });
    return {};
  }
};

const normalizeText = (text?: string): string => {
  if (!text) return "";
  if (text.length <= MAX_CONTENT_PREVIEW) return text;
  return `${text.slice(0, MAX_CONTENT_PREVIEW)}…`;
};

const exaSearch = async (query: string, numResults: number): Promise<ExaSearchResult[]> => {
  const body = { query, numResults, useAutoprompt: true, text: true };
  const response = await axios.post(EXA_SEARCH_ENDPOINT, body, { headers: headers.exa, timeout: 15_000 });
  const results: ExaSearchResult[] = response.data?.results ?? [];
  return results.slice(0, numResults).map((result) => ({
    id: result.id,
    url: result.url,
    title: result.title,
    publishedDate: result.publishedDate,
    text: normalizeText(result.text),
  }));
};

const exaFetchContent = async (ids: string[], urls: string[]): Promise<{ id?: string; url?: string; text?: string }[]> => {
  const payload: Record<string, unknown> = { text: true };
  if (ids.length) payload.ids = ids;
  if (urls.length) payload.urls = urls;
  const response = await axios.post(EXA_CONTENTS_ENDPOINT, payload, { headers: headers.exa, timeout: 20_000 });
  const results: Array<{ id?: string; url?: string; text?: string }> = response.data?.results ?? response.data?.contents ?? [];
  return results.map((result) => ({
    id: result.id,
    url: result.url,
    text: normalizeText(result.text),
  }));
};

const callOpenRouter = async (messages: ChatMessage[], model = DEFAULT_MODEL): Promise<OpenRouterChoice> => {
  const response = await axios.post<OpenRouterResponse>(
    OPENROUTER_ENDPOINT,
    {
      model,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
    },
    { headers: headers.openrouter, timeout: 30_000 },
  );

  const choice = response.data?.choices?.[0];
  if (!choice?.message) {
    throw new Error("OpenRouter returned no message");
  }
  return choice;
};

const runToolCall = async (toolCall: ToolCall): Promise<string> => {
  const args = safeParseArgs(toolCall.function.arguments);

  if (toolCall.function.name === "exa_search") {
    const query = typeof args.query === "string" ? args.query : "";
    const numResults = typeof args.numResults === "number" ? Math.max(1, Math.min(10, Math.floor(args.numResults))) : 5;
    if (!query) return JSON.stringify({ error: "Missing query" });
    const results = await exaSearch(query, numResults);
    return JSON.stringify({ results });
  }

  if (toolCall.function.name === "exa_fetch_content") {
    const ids = Array.isArray(args.ids) ? (args.ids.filter((id) => typeof id === "string") as string[]) : [];
    const urls = Array.isArray(args.urls) ? (args.urls.filter((u) => typeof u === "string") as string[]) : [];
    if (!ids.length && !urls.length) {
      return JSON.stringify({ error: "Provide ids or urls" });
    }
    const contents = await exaFetchContent(ids, urls);
    return JSON.stringify({ contents });
  }

  return JSON.stringify({ error: `Unknown tool ${toolCall.function.name}` });
};

export type AgentRunResult = {
  answer: string;
  messages: ChatMessage[];
  finishReason?: string;
};

export const runExaGroundedAgent = async (query: string, options?: { model?: string }): Promise<AgentRunResult> => {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a focused research agent. Use the provided Exa tools to search and fetch page content before answering. Always cite URLs from tool results. Be concise.",
    },
    { role: "user", content: query },
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;
    const choice = await callOpenRouter(messages, options?.model);
    const message = choice.message!;

    const toolCalls = message.tool_calls ?? [];
    if (!toolCalls.length) {
      const answer = message.content ?? "";
      return { answer, messages: [...messages, message], finishReason: choice.finish_reason };
    }

    messages.push(message);

    for (const toolCall of toolCalls) {
      try {
        const result = await runToolCall(toolCall);
        messages.push({
          role: "tool",
          content: result,
          name: toolCall.function.name,
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        const fallback = error instanceof Error ? error.message : "Unknown tool error";
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: fallback }),
          name: toolCall.function.name,
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  throw new Error("Agent stopped after reaching max tool iterations without a final answer");
};
