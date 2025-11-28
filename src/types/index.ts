import { z } from "zod";
import { TEAM_CODES, TEAM_CODE_LIST, TeamCode } from "../utils/team-normalizer";

export enum PickType {
  Spread = "spread",
  Total = "total",
}

export enum PickSide {
  Home = "home",
  Away = "away",
  Over = "over",
  Under = "under",
}

export enum ExtractionMethod {
  LLM = "llm",
  Heuristic = "heuristic",
  Manual = "manual",
}

export const TeamCodeSchema = z.enum(TEAM_CODES);

export const SourceSchema = z.object({
  id: z.string().uuid(),
  blogName: z.string(),
  baseUrl: z.string().url(),
  associatedTeam: TeamCodeSchema.nullable(),
  blogType: z.string(),
  activeFlag: z.boolean(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const GameSchema = z.object({
  id: z.string().uuid(),
  season: z.number(),
  week: z.number(),
  gameDate: z.coerce.date(),
  homeTeam: TeamCodeSchema,
  awayTeam: TeamCodeSchema,
  spreadLine: z.number().nullable(),
  totalLine: z.number().nullable(),
  status: z.string(),
  createdAt: z.date().optional(),
});

export type Game = z.infer<typeof GameSchema>;

export const RawArticleSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  fetchedAt: z.coerce.date(),
  url: z.string().url(),
  html: z.string(),
  articleHash: z.string(),
  week: z.number().nullable(),
  processed: z.boolean(),
  createdAt: z.date().optional(),
});

export type RawArticle = z.infer<typeof RawArticleSchema>;

export const PredictionSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  gameId: z.string().uuid(),
  season: z.number(),
  week: z.number(),
  pickType: z.nativeEnum(PickType),
  pickSide: z.nativeEnum(PickSide),
  lineAtPick: z.number(),
  extractionMethod: z.nativeEnum(ExtractionMethod),
  extractionConfidence: z.number().min(0).max(1),
  extractedAt: z.coerce.date(),
  articleUrl: z.string().url(),
  rawQuote: z.string().nullable(),
});

export type Prediction = z.infer<typeof PredictionSchema>;

export const ConsensusScoreSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  season: z.number(),
  week: z.number(),
  pickType: z.nativeEnum(PickType),
  majoritySide: z.nativeEnum(PickSide),
  score: z.number(),
  signalLabel: z.string(),
  numPredictions: z.number(),
  calculatedAt: z.coerce.date(),
});

export type ConsensusScore = z.infer<typeof ConsensusScoreSchema>;

export const ExtractedPredictionSchema = z.object({
  game: z.object({
    homeTeam: TeamCodeSchema,
    awayTeam: TeamCodeSchema,
    week: z.number(),
    season: z.number(),
  }),
  pickType: z.nativeEnum(PickType),
  pickSide: z.nativeEnum(PickSide),
  line: z.number().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  quote: z.string().optional().nullable(),
});

export type ExtractedPrediction = z.infer<typeof ExtractedPredictionSchema>;

export type PartialUpdate<T> = Partial<T> & { id: string };
