import axios from "axios";
import { Game, Prediction } from "@prisma/client";
import { PickSide, PickType, ExtractionMethod, ExtractedPredictionSchema } from "../types";
import { env } from "../config/environment";
import { log } from "../utils/logger";
import { normalizeTeamName } from "../utils/team-normalizer";
import { prisma } from "../database/client";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

const buildPrompt = (articleText: string, games: Game[]): string => {
  const schedule = games
    .map(
      (game) =>
        `${game.awayTeam} at ${game.homeTeam} on ${new Date(game.gameDate).toISOString()} (spread: ${game.spreadLine ?? "N/A"}, total: ${
          game.totalLine ?? "N/A"
        })`,
    )
    .join("\n");

  return `
You are an information extraction model that reads NFL betting articles and returns structured picks.

NFL schedule (homeTeam vs awayTeam, ISO date):
${schedule}

Extract all explicit betting picks. Return JSON only, no prose.
Schema:
[
  {
    "game": { "homeTeam": "KC", "awayTeam": "BUF", "week": 5, "season": 2024 },
    "pickType": "spread" | "total",
    "pickSide": "home" | "away" | "over" | "under",
    "line": number,
    "confidence": number between 0 and 1,
    "quote": "verbatim supporting sentence"
  }
]

Rules:
- Use the team codes exactly as shown in the schedule.
- For spread picks, pickSide is "home" or "away" relative to the listed homeTeam.
- For total picks, pickSide is "over" or "under".
- Include every pick found; omit speculative statements.
- If no picks are present, return an empty array [].

Article:
"""${articleText.slice(0, 6000)}"""`;
};

const callModel = async (prompt: string): Promise<string> => {
  const response = await axios.post(
    OPENROUTER_ENDPOINT,
    {
      model: MODEL,
      messages: [
        { role: "system", content: "Extract structured NFL betting picks in valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20_000,
    },
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response missing content");
  }
  return content;
};

const safeJsonParse = (text: string): unknown => {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("[");
  const jsonEnd = trimmed.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON array found in model output");
  }
  const jsonSlice = trimmed.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(jsonSlice);
};

export const extractPredictionsFromArticle = async (params: {
  articleUrl: string;
  articleText: string;
  games: Game[];
  sourceId: string;
  season: number;
  week: number;
}): Promise<Prediction[]> => {
  const { articleUrl, articleText, games, sourceId, season, week } = params;
  if (!games.length) return [];

  const prompt = buildPrompt(articleText, games);
  const content = await callModel(prompt);

  let parsed: unknown;
  try {
    parsed = safeJsonParse(content);
  } catch (error) {
    log.error("Failed to parse LLM output", { error, content });
    return [];
  }

  const validation = ExtractedPredictionSchema.array().safeParse(parsed);
  if (!validation.success) {
    log.error("LLM output validation failed", { errors: validation.error.issues });
    return [];
  }

  const predictions: Prediction[] = [];

  for (const extracted of validation.data) {
    const { game, pickType, pickSide, line, confidence = 0.5, quote } = extracted;
    const homeCode = normalizeTeamName(game.homeTeam);
    const awayCode = normalizeTeamName(game.awayTeam);
    if (!homeCode || !awayCode) continue;

    const matchedGame = games.find((g) => g.homeTeam === homeCode && g.awayTeam === awayCode);
    if (!matchedGame) continue;

    const prediction = await prisma.prediction.upsert({
      where: {
        sourceId_gameId_pickType: {
          sourceId,
          gameId: matchedGame.id,
          pickType,
        },
      },
      update: {
        pickSide,
        lineAtPick: line ?? (pickType === PickType.Total ? matchedGame.totalLine ?? 0 : matchedGame.spreadLine ?? 0),
        extractionConfidence: confidence,
        extractionMethod: ExtractionMethod.LLM,
        articleUrl,
        rawQuote: quote ?? null,
        season,
        week,
      },
      create: {
        sourceId,
        gameId: matchedGame.id,
        season,
        week,
        pickType,
        pickSide,
        lineAtPick: line ?? (pickType === PickType.Total ? matchedGame.totalLine ?? 0 : matchedGame.spreadLine ?? 0),
        extractionMethod: ExtractionMethod.LLM,
        extractionConfidence: confidence,
        articleUrl,
        rawQuote: quote ?? null,
      },
    });

    predictions.push(prediction);
  }

  log.info("LLM extraction complete", { articleUrl, count: predictions.length });
  return predictions;
};
