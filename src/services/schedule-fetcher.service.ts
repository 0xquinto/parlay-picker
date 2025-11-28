import axios from "axios";
import { prisma } from "../database/client";
import { env } from "../config/environment";
import { log } from "../utils/logger";
import { normalizeTeamName } from "../utils/team-normalizer";
import { Game } from "@prisma/client";

type Competition = {
  date: string;
  competitors: Array<{
    homeAway: "home" | "away";
    team: { displayName: string; name?: string; abbreviation?: string };
  }>;
  odds?: Array<{ details?: string; overUnder?: number; spread?: number }>;
  status?: { type?: { name?: string } };
};

const deriveWeekFromDate = (today = new Date()): number => {
  // Rough approximation anchored to the start of the regular season (first week of September)
  const seasonStart = new Date(today.getFullYear(), 8, 1);
  const diffDays = Math.floor((today.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(18, Math.ceil(diffDays / 7)));
};

const parseSpread = (odds?: Competition["odds"]): number | null => {
  if (!odds?.length) return null;
  const detail = odds[0].details;
  if (typeof odds[0].spread === "number") return odds[0].spread;
  if (!detail) return null;
  const match = detail.match(/([+-]?\d+\.?\d*)/);
  return match ? Number(match[1]) : null;
};

export const fetchAndStoreSchedule = async (params?: { week?: number; season?: number }): Promise<Game[]> => {
  const week = params?.week ?? deriveWeekFromDate();
  const season = params?.season ?? new Date().getFullYear();

  const url = `${env.SPORTS_API_URL}/scoreboard`;
  log.info("Fetching schedule", { week, season, url });

  const response = await axios.get(url, {
    params: { week, year: season, seasontype: 2 },
    timeout: 10_000,
  });

  const competitions: Competition[] = response.data?.events?.map((event: any) => event?.competitions?.[0]).filter(Boolean) ?? [];

  const storedGames: Game[] = [];

  for (const competition of competitions) {
    const home = competition.competitors.find((c) => c.homeAway === "home");
    const away = competition.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeTeam = normalizeTeamName(home.team.abbreviation || home.team.name || home.team.displayName);
    const awayTeam = normalizeTeamName(away.team.abbreviation || away.team.name || away.team.displayName);

    if (!homeTeam || !awayTeam) {
      log.warn("Skipping game due to unmapped team", { home: home.team, away: away.team });
      continue;
    }

    const spreadLine = parseSpread(competition.odds);
    const totalLine = competition.odds?.[0]?.overUnder ?? null;
    const gameDate = new Date(competition.date);
    const status = competition.status?.type?.name ?? "scheduled";

    const game = await prisma.game.upsert({
      where: {
        season_week_homeTeam_awayTeam: { season, week, homeTeam, awayTeam },
      },
      update: {
        gameDate,
        spreadLine,
        totalLine,
        status,
      },
      create: {
        season,
        week,
        gameDate,
        homeTeam,
        awayTeam,
        spreadLine,
        totalLine,
        status,
      },
    });

    storedGames.push(game);
  }

  log.info("Schedule sync complete", { week, season, games: storedGames.length });
  return storedGames;
};

export const getCurrentWeek = (): number => deriveWeekFromDate();
