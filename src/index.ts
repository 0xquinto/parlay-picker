import express from "express";
import cron from "node-cron";
import { env } from "./config/environment";
import { log } from "./utils/logger";
import { runDailyIngestion } from "./jobs/daily-ingestion.job";
import { prisma } from "./database/client";
import { ingestionState } from "./monitoring/ingestion-state";

const app = express();
app.use(express.json());

let isIngestionRunning = false;

app.get("/health", async (_req, res) => {
  let dbOk = true;
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbOk = false;
    dbError = error instanceof Error ? error.message : "Unknown DB error";
  }

  const payload = {
    status: dbOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    db: { ok: dbOk, error: dbError },
    ingestion: ingestionState.snapshot(),
  };

  res.status(dbOk ? 200 : 503).json(payload);
});

app.post("/ingest", async (_req, res) => {
  if (isIngestionRunning) {
    return res.status(409).json({ status: "busy" });
  }

  isIngestionRunning = true;
  runDailyIngestion()
    .catch((error) => {
      log.error("Manual ingestion failed", { error });
      ingestionState.markFailed("Manual ingestion failed", { errors: 1 });
    })
    .finally(() => {
      isIngestionRunning = false;
    });

  res.json({ status: "started", ingestion: ingestionState.snapshot() });
});

app.get("/sources", async (_req, res) => {
  const sources = await prisma.source.findMany();
  res.json(sources);
});

app.get("/predictions", async (_req, res) => {
  const predictions = await prisma.prediction.findMany({ take: 100 });
  res.json(predictions);
});

app.listen(env.PORT, () => {
  log.info(`Server listening on port ${env.PORT}`);
});

cron.schedule(env.CRON_SCHEDULE, () => {
  if (isIngestionRunning) {
    log.warn("Skipped scheduled ingestion because a job is already running");
    return;
  }

  isIngestionRunning = true;
  runDailyIngestion()
    .catch((error) => log.error("Scheduled ingestion failed", { error }))
    .finally(() => {
      isIngestionRunning = false;
    });
});
