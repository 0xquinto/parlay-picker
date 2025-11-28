import axios from "axios";
import { Game, Prediction } from "@prisma/client";
import { PickSide, PickType, ExtractionMethod, ExtractedPredictionSchema } from "../types";
import { env } from "../config/environment";
import { log } from "../utils/logger";
import { getTeamAliases, normalizeTeamName, TeamCode } from "../utils/team-normalizer";
import { prisma } from "../database/client";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "x-ai/grok-4.1-fast:free";

type GameWithAliases = Game & { aliases: { home: string[]; away: string[] } };

const canonicalKey = (home: TeamCode, away: TeamCode): string => {
  const sorted = [home, away].sort();
  return `${sorted[0]}-${sorted[1]}`;
};

const articleMentionsTeam = (text: string, aliases: string[]): boolean =>
  aliases.some((alias) => text.includes(alias.toLowerCase()));

const findRelevantGames = (articleText: string, games: Game[]): GameWithAliases[] => {
  const lowered = articleText.toLowerCase();
  const augmented: GameWithAliases[] = games.map((g) => ({
    ...g,
    aliases: {
      home: getTeamAliases(g.homeTeam as TeamCode),
      away: getTeamAliases(g.awayTeam as TeamCode),
    },
  }));

  const relevant = augmented.filter((game) => {
    const hasHome = articleMentionsTeam(lowered, game.aliases.home);
    const hasAway = articleMentionsTeam(lowered, game.aliases.away);
    return hasHome && hasAway;
  });

  return relevant.length ? relevant : [];
};

const buildPrompt = (articleText: string, games: GameWithAliases[]): string => {
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
  try {
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
      log.error("OpenRouter response missing content", { 
        responseData: response.data,
        status: response.status,
      });
      throw new Error("OpenRouter response missing content");
    }
    return content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      log.error("OpenRouter API call failed", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code,
      });
      throw new Error(`OpenRouter API error: ${error.response?.status} ${error.response?.statusText || error.message}`);
    }
    throw error;
  }
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

  const relevantGames = findRelevantGames(articleText, games);
  if (!relevantGames.length) {
    log.warn("Skipping article with no matching games this week", { articleUrl, season, week });
    return [];
  }

  const prompt = buildPrompt(articleText, relevantGames);
  const content = await callModel(prompt);

  let parsed: unknown;
  try {
    parsed = safeJsonParse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Failed to parse LLM output", { 
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      contentPreview: content.slice(0, 500),
      contentLength: content.length,
    });
    return [];
  }

  const validation = ExtractedPredictionSchema.array().safeParse(parsed);
  if (!validation.success) {
    log.error("LLM output validation failed", { errors: validation.error.issues });
    return [];
  }

  const predictions: Prediction[] = [];
  const gameMap = new Map<string, GameWithAliases>();
  for (const g of relevantGames) {
    gameMap.set(canonicalKey(g.homeTeam as TeamCode, g.awayTeam as TeamCode), g);
  }

  for (const extracted of validation.data) {
    const { game, pickType, pickSide, line, confidence = 0.5, quote } = extracted;
    const homeCode = normalizeTeamName(game.homeTeam);
    const awayCode = normalizeTeamName(game.awayTeam);
    if (!homeCode || !awayCode) continue;

    const matchedGame = gameMap.get(canonicalKey(homeCode, awayCode));
    if (!matchedGame) {
      log.warn("Dropping prediction for unmatched game", { articleUrl, homeCode, awayCode, season, week });
      continue;
    }

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
