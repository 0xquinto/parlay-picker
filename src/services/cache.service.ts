import crypto from "crypto";
import { RawArticle } from "@prisma/client";
import { prisma } from "../database/client";
import { log } from "../utils/logger";

const buildHash = (url: string, html: string): string => {
  return crypto.createHash("sha256").update(url).update(html).digest("hex");
};

export const getCachedArticle = async (sourceId: string, url: string, html: string): Promise<RawArticle | null> => {
  const articleHash = buildHash(url, html);
  const existing = await prisma.rawArticle.findFirst({
    where: {
      sourceId,
      articleHash,
    },
  });

  if (existing) {
    log.info("Cache hit for article", { sourceId, url });
    return existing;
  }

  log.debug("Cache miss for article", { sourceId, url });
  return null;
};

export const storeArticle = async (params: {
  sourceId: string;
  url: string;
  html: string;
  week?: number | null;
  processed?: boolean;
}): Promise<RawArticle> => {
  const { sourceId, url, html, week = null, processed = false } = params;
  const articleHash = buildHash(url, html);

  const existing = await prisma.rawArticle.findFirst({
    where: { sourceId, articleHash },
  });

  if (existing) {
    return existing;
  }

  const created = await prisma.rawArticle.create({
    data: {
      sourceId,
      url,
      html,
      articleHash,
      week,
      processed,
    },
  });

  log.info("Stored article in cache", { sourceId, url });
  return created;
};
