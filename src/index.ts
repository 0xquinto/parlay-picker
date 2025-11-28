import express from "express";
import cron from "node-cron";
import { env } from "./config/environment";
import { log } from "./utils/logger";
import { runDailyIngestion } from "./jobs/daily-ingestion.job";
import { prisma } from "./database/client";

const app = express();
app.use(express.json());

let isIngestionRunning = false;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/ingest", async (_req, res) => {
  if (isIngestionRunning) {
    return res.status(409).json({ status: "busy" });
  }

  isIngestionRunning = true;
  runDailyIngestion()
    .catch((error) => {
      log.error("Manual ingestion failed", { error });
    })
    .finally(() => {
      isIngestionRunning = false;
    });

  res.json({ status: "started" });
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
