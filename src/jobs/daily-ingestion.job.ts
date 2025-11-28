import { prisma } from "../database/client";
import { log } from "../utils/logger";
import { fetchAndStoreSchedule, getCurrentWeek } from "../services/schedule-fetcher.service";
import { discoverArticlesForSource } from "../services/exa-discovery.service";
import { fetchArticle } from "../services/article-fetcher.service";
import { extractPredictionsFromArticle } from "../services/llm-extraction.service";
import { calculateConsensus } from "../services/consensus-calculator.service";
import { publishConsensusToSheets } from "../services/sheets-writer.service";
import { ingestionState } from "../monitoring/ingestion-state";

export const runDailyIngestion = async () => {
  const season = new Date().getFullYear();
  const week = getCurrentWeek();
  const startedAt = Date.now();
  ingestionState.start(season, week);

  log.info("Starting daily ingestion", { season, week });

  let games;
  try {
    games = await fetchAndStoreSchedule({ season, week });
  } catch (error) {
    log.error("Schedule fetch failed, aborting ingestion", { error });
    ingestionState.markFailed("Schedule fetch failed", { errors: 1, durationMs: Date.now() - startedAt });
    return;
  }

  if (!games.length) {
    log.warn("No games retrieved for week, skipping ingestion", { week, season });
    ingestionState.markSkipped("No games for week", { durationMs: Date.now() - startedAt });
    return;
  }

  const sources = await prisma.source.findMany({ where: { activeFlag: true } });
  ingestionState.setSources(sources.length);

  if (!sources.length) {
    log.warn("No active sources found, skipping article discovery");
    ingestionState.markSkipped("No active sources", { durationMs: Date.now() - startedAt });
    return;
  }

  let errors = 0;

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
        ingestionState.incrementArticles();
      } catch (error) {
        log.error("Failed processing article", { url, source: source.blogName, error });
        errors += 1;
        ingestionState.incrementErrors();
      }
    }
  }

  try {
    await calculateConsensus(season, week);
  } catch (error) {
    errors += 1;
    ingestionState.incrementErrors();
    log.error("Consensus calculation failed", { error });
  }

  try {
    await publishConsensusToSheets(week, season);
  } catch (error) {
    errors += 1;
    ingestionState.incrementErrors();
    log.error("Publish to sheets failed", { error });
  }

  if (errors > 0) {
    ingestionState.markFailed("Ingestion completed with errors", { errors, durationMs: Date.now() - startedAt });
    log.warn("Daily ingestion finished with errors", { errors, season, week });
    return;
  }

  log.info("Daily ingestion complete", { season, week });
  ingestionState.markSuccess({ durationMs: Date.now() - startedAt });
};
