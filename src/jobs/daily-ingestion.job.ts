import { prisma } from "../database/client";
import { log } from "../utils/logger";
import { fetchAndStoreSchedule, getCurrentWeek } from "../services/schedule-fetcher.service";
import { discoverArticlesForSource } from "../services/exa-discovery.service";
import { fetchArticle } from "../services/article-fetcher.service";
import { extractPredictionsFromArticle } from "../services/llm-extraction.service";
import { calculateConsensus } from "../services/consensus-calculator.service";
import { publishConsensusToSheets } from "../services/sheets-writer.service";

export const runDailyIngestion = async () => {
  const season = new Date().getFullYear();
  const week = getCurrentWeek();

  log.info("Starting daily ingestion", { season, week });

  let games;
  try {
    games = await fetchAndStoreSchedule({ season, week });
  } catch (error) {
    log.error("Schedule fetch failed, aborting ingestion", { error });
    return;
  }

  if (!games.length) {
    log.warn("No games retrieved for week, skipping ingestion", { week, season });
    return;
  }

  const sources = await prisma.source.findMany({ where: { activeFlag: true } });

  if (!sources.length) {
    log.warn("No active sources found, skipping article discovery");
    return;
  }

  for (const source of sources) {
    const urls = await discoverArticlesForSource(source, week, season);

    for (const url of urls) {
      try {
        const { text } = await fetchArticle(source.id, url);
        await extractPredictionsFromArticle({
          articleUrl: url,
          articleText: text,
          games,
          sourceId: source.id,
          season,
          week,
        });

        await prisma.rawArticle.updateMany({
          where: { sourceId: source.id, url },
          data: { processed: true, week },
        });
      } catch (error) {
        log.error("Failed processing article", { url, source: source.blogName, error });
      }
    }
  }

  await calculateConsensus(season, week);
  await publishConsensusToSheets(week, season);

  log.info("Daily ingestion complete", { season, week });
};
