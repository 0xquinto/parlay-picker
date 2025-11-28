import { PickSide, PickType } from "../types";
import { prisma } from "../database/client";
import { log } from "../utils/logger";

const deriveSignalLabel = (score: number): string => {
  if (score >= 4) return "strong";
  if (score >= 2) return "moderate";
  return "lean";
};

export const calculateConsensus = async (season: number, week: number) => {
  const predictions = await prisma.prediction.findMany({
    where: { season, week },
  });

  const grouped = new Map<string, typeof predictions>();

  for (const prediction of predictions) {
    const key = `${prediction.gameId}-${prediction.pickType}`;
    const list = grouped.get(key) ?? [];
    list.push(prediction);
    grouped.set(key, list);
  }

  for (const [key, group] of grouped.entries()) {
    const [gameId, pickTypeRaw] = key.split("-");
    const pickType = pickTypeRaw as PickType;

    const counts: Record<PickSide, number> = {
      [PickSide.Home]: 0,
      [PickSide.Away]: 0,
      [PickSide.Over]: 0,
      [PickSide.Under]: 0,
    };

    for (const prediction of group) {
      const pickSide = prediction.pickSide as PickSide;
      if (counts[pickSide] === undefined) {
        log.warn("Skipping prediction with unknown pick side", { pickSide: prediction.pickSide, predictionId: prediction.id });
        continue;
      }
      counts[pickSide]++;
    }

    let majoritySide: PickSide;
    if (pickType === PickType.Spread) {
      majoritySide = counts[PickSide.Home] >= counts[PickSide.Away] ? PickSide.Home : PickSide.Away;
    } else {
      majoritySide = counts[PickSide.Over] >= counts[PickSide.Under] ? PickSide.Over : PickSide.Under;
    }

    const sortedCounts = Object.values(counts).sort((a, b) => b - a);
    const score = sortedCounts[0] - (sortedCounts[1] ?? 0);
    const numPredictions = group.length;

    await prisma.consensusScore.upsert({
      where: { gameId_pickType: { gameId, pickType } },
      update: {
        majoritySide,
        score,
        signalLabel: deriveSignalLabel(score),
        numPredictions,
        season,
        week,
      },
      create: {
        gameId,
        season,
        week,
        pickType,
        majoritySide,
        score,
        signalLabel: deriveSignalLabel(score),
        numPredictions,
      },
    });
  }

  log.info("Consensus calculation complete", { groups: grouped.size });
};
