import axios from "axios";
import cheerio from "cheerio";
import { prisma } from "../database/client";
import { log } from "../utils/logger";
import { getCachedArticle, storeArticle } from "./cache.service";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";

const extractText = (html: string): string => {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
};

const fetchWithRetry = async (url: string, attempt = 1): Promise<string> => {
  try {
    const response = await axios.get<string>(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10_000,
      responseType: "text",
      maxRedirects: 3,
    });
    return response.data;
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }
    const delay = 500 * attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, attempt + 1);
  }
};

export const fetchArticle = async (sourceId: string, url: string): Promise<{ html: string; text: string; fromCache: boolean }> => {
  const existingByUrl = await prisma.rawArticle.findFirst({ where: { sourceId, url } });
  if (existingByUrl) {
    log.info("Article already stored by URL", { url });
    return { html: existingByUrl.html, text: extractText(existingByUrl.html), fromCache: true };
  }

  const html = await fetchWithRetry(url);
  const cached = await getCachedArticle(sourceId, url, html);
  if (cached) {
    return { html: cached.html, text: extractText(cached.html), fromCache: true };
  }

  const stored = await storeArticle({ sourceId, url, html, processed: false });
  return { html: stored.html, text: extractText(stored.html), fromCache: false };
};

export { extractText };
