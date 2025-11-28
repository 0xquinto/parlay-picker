import { PrismaClient, Prisma } from "@prisma/client";
import { log } from "../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClientWithEvents | undefined;
}

type PrismaClientWithEvents = PrismaClient<Prisma.PrismaClientOptions & { log: Prisma.LogDefinition[] }>;

const prismaLogConfig: Prisma.LogDefinition[] = [
  { emit: "event", level: "query" },
  { emit: "event", level: "error" },
  { emit: "event", level: "warn" },
];

const createPrismaClient = (): PrismaClientWithEvents =>
  new PrismaClient({
    log: prismaLogConfig,
  }) as PrismaClientWithEvents;

const prisma = global.prismaClient || createPrismaClient();

prisma.$on("error", (e: Prisma.LogEvent) => log.error("Prisma error", { message: e.message, target: e.target }));
prisma.$on("warn", (e: Prisma.LogEvent) => log.warn("Prisma warning", { message: e.message }));
prisma.$on("query", (e: Prisma.QueryEvent) => log.debug("Prisma query", { query: e.query, duration: e.duration }));

const connectWithRetry = async (attempt = 1): Promise<void> => {
  try {
    await prisma.$connect();
    log.info("Connected to database");
  } catch (error) {
    const delay = Math.min(2000 * attempt, 10_000);
    log.error("Database connection failed, retrying", { attempt, error });
    await new Promise((resolve) => setTimeout(resolve, delay));
    return connectWithRetry(attempt + 1);
  }
};

connectWithRetry();

const gracefulShutdown = async () => {
  log.info("Shutting down Prisma client");
  await prisma.$disconnect();
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

if (!global.prismaClient) {
  global.prismaClient = prisma;
}

export { prisma };
