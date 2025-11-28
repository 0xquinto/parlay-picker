-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "blog_name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "associated_team" TEXT,
    "blog_type" TEXT NOT NULL,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "game_date" TIMESTAMP(3) NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "spread_line" DOUBLE PRECISION,
    "total_line" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_articles" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "article_hash" TEXT NOT NULL,
    "week" INTEGER,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "pick_type" TEXT NOT NULL,
    "pick_side" TEXT NOT NULL,
    "line_at_pick" DOUBLE PRECISION NOT NULL,
    "extraction_method" TEXT NOT NULL,
    "extraction_confidence" DOUBLE PRECISION NOT NULL,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "article_url" TEXT NOT NULL,
    "raw_quote" TEXT,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consensus_scores" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "pick_type" TEXT NOT NULL,
    "majority_side" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "signal_label" TEXT NOT NULL,
    "num_predictions" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consensus_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_season_week_home_team_away_team_key" ON "games"("season", "week", "home_team", "away_team");

-- CreateIndex
CREATE UNIQUE INDEX "raw_articles_source_id_article_hash_key" ON "raw_articles"("source_id", "article_hash");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_source_id_game_id_pick_type_key" ON "predictions"("source_id", "game_id", "pick_type");

-- CreateIndex
CREATE UNIQUE INDEX "consensus_scores_game_id_pick_type_key" ON "consensus_scores"("game_id", "pick_type");

-- AddForeignKey
ALTER TABLE "raw_articles" ADD CONSTRAINT "raw_articles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consensus_scores" ADD CONSTRAINT "consensus_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
