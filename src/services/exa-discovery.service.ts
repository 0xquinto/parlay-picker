import axios from "axios";
import { Source } from "@prisma/client";
import { env } from "../config/environment";
import { log } from "../utils/logger";

type ExaResult = { url: string; publishedDate?: string };

const EXA_ENDPOINT = "https://api.exa.ai/search";

const buildQuery = (source: Source, week: number, season: number): string => {
  const teamPart = source.associatedTeam ? ` ${source.associatedTeam} ` : " ";
  return `${source.blogName}${teamPart} week ${week} picks ${season} site:${source.baseUrl}`;
};

const isRecent = (publishedDate?: string): boolean => {
  if (!publishedDate) return true;
  const published = new Date(publishedDate);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return published >= cutoff;
};

export const discoverArticlesForSource = async (source: Source, week: number, season: number): Promise<string[]> => {
  const query = buildQuery(source, week, season);

  log.info("Searching Exa for articles", { source: source.blogName, query });

  try {
    const response = await axios.post(
      EXA_ENDPOINT,
      { query, numResults: 10 },
      {
        headers: { "Content-Type": "application/json", "x-api-key": env.EXA_API_KEY },
        timeout: 10_000,
      },
    );

    const results: ExaResult[] = response.data?.results ?? [];
    const filtered = results.filter((result) => isRecent(result.publishedDate)).map((result) => result.url);

    log.info("Exa discovery complete", { source: source.blogName, count: filtered.length });
    return filtered;
  } catch (error) {
    log.error("Exa discovery failed", { source: source.blogName, error });
    return [];
  }
};
