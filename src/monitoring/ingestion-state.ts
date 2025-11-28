type IngestionStatus = "idle" | "running" | "success" | "failed" | "skipped";

type IngestionSnapshot = {
  status: IngestionStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  season?: number;
  week?: number;
  message?: string;
  sources?: number;
  articlesProcessed?: number;
  errors?: number;
};

const state: IngestionSnapshot = {
  status: "idle",
};

export const ingestionState = {
  start: (season: number, week: number) => {
    state.status = "running";
    state.startedAt = new Date().toISOString();
    state.finishedAt = undefined;
    state.durationMs = undefined;
    state.message = undefined;
    state.season = season;
    state.week = week;
    state.sources = 0;
    state.articlesProcessed = 0;
    state.errors = 0;
  },
  markSuccess: (meta: Partial<Omit<IngestionSnapshot, "status">>) => {
    state.status = "success";
    state.finishedAt = new Date().toISOString();
    if (meta.durationMs !== undefined) {
      state.durationMs = meta.durationMs;
    } else if (state.startedAt) {
      state.durationMs = new Date(state.finishedAt).getTime() - new Date(state.startedAt).getTime();
    }
    Object.assign(state, meta);
  },
  markFailed: (message: string, meta?: Partial<Omit<IngestionSnapshot, "status">>) => {
    state.status = "failed";
    state.finishedAt = new Date().toISOString();
    if (meta?.durationMs !== undefined) {
      state.durationMs = meta.durationMs;
    } else if (state.startedAt) {
      state.durationMs = new Date(state.finishedAt).getTime() - new Date(state.startedAt).getTime();
    }
    state.message = message;
    Object.assign(state, meta);
  },
  markSkipped: (message: string, meta?: Partial<Omit<IngestionSnapshot, "status">>) => {
    state.status = "skipped";
    state.finishedAt = new Date().toISOString();
    if (meta?.durationMs !== undefined) {
      state.durationMs = meta.durationMs;
    } else if (state.startedAt) {
      state.durationMs = new Date(state.finishedAt).getTime() - new Date(state.startedAt).getTime();
    }
    state.message = message;
    Object.assign(state, meta);
  },
  incrementArticles: () => {
    state.articlesProcessed = (state.articlesProcessed ?? 0) + 1;
  },
  incrementErrors: () => {
    state.errors = (state.errors ?? 0) + 1;
  },
  setSources: (count: number) => {
    state.sources = count;
  },
  snapshot: (): IngestionSnapshot => ({ ...state }),
};
