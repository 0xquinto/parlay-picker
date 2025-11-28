# parlay-picker - Detailed Implementation Plan

# NFL Prediction Aggregation System – Implementation Plan

## A. PROJECT OVERVIEW

We're building an NFL prediction aggregation system using TypeScript that automatically discovers weekly picks articles from curated NFL blogs, extracts predictions using LLM-based parsing, calculates consensus scores, and outputs results to Google Sheets. The system uses a monolithic Express.js architecture with a plugin-based extractor system, Exa MCP for content discovery, OpenRouter for LLM extraction, Supabase for PostgreSQL database, and node-cron for daily scheduling. The pipeline runs daily during NFL season, caching processed articles to avoid re-processing, and maintains a running weekly sheet that accumulates picks as new articles are published.

## B. TECHNOLOGY STACK & DEPENDENCIES

Core Libraries for TypeScript:
- express for HTTP server and API routing
- @supabase/supabase-js for PostgreSQL database operations
- prisma for type-safe database ORM and migrations
- node-cron for scheduled job execution
- axios for HTTP requests to fetch articles
- cheerio for HTML parsing and content extraction
- googleapis for Google Sheets API integration
- zod for runtime type validation and schema definition
- dotenv for environment variable management
- winston for structured logging
- crypto for generating content hashes

## C. FILE STRUCTURE

```
nfl-prediction-aggregator/
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── environment.ts
│   ├── database/
│   │   ├── client.ts
│   │   └── schema.prisma
│   ├── services/
│   │   ├── exa-discovery.service.ts
│   │   ├── article-fetcher.service.ts
│   │   ├── llm-extraction.service.ts
│   │   ├── consensus-calculator.service.ts
│   │   ├── sheets-writer.service.ts
│   │   ├── schedule-fetcher.service.ts
│   │   └── cache.service.ts
│   ├── jobs/
│   │   └── daily-ingestion.job.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── logger.ts
│       └── team-normalizer.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## D. COMPLETE FILE-BY-FILE IMPLEMENTATION

### FILE: package.json
Purpose: Project dependencies and scripts configuration

```json
{
  "name": "nfl-prediction-aggregator",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@supabase/supabase-js": "^2.39.0",
    "@prisma/client": "^5.8.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.5",
    "cheerio": "^1.0.0-rc.12",
    "googleapis": "^131.0.0",
    "zod": "^3.22.4",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.6",
    "@types/node-cron": "^3.0.11",
    "prisma": "^5.8.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

### FILE: tsconfig.json
Purpose: TypeScript compiler configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### FILE: .env.example
Purpose: Environment variable template

```
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Exa MCP Configuration
EXA_API_KEY=your_exa_api_key

# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS=path_to_service_account_json
GOOGLE_SHEET_ID=your_sheet_id

# Sports API Configuration
SPORTS_API_URL=https://site.api.espn.com/apis/site/v2/sports/football/nfl

# Application Configuration
NODE_ENV=development
PORT=3000
CRON_SCHEDULE=0 6 * * *
```

### FILE: src/config/environment.ts
Purpose: Centralized environment variable validation and configuration

1. IMPORT zod library for runtime environment variable validation
2. IMPORT dotenv library to load environment variables from file
3. CALL dotenv config method to load variables into process environment
4. DEFINE zod schema for all required environment variables with types
5. CREATE validation schema that enforces URL format for API endpoints
6. ADD validation for API keys requiring minimum string length
7. IMPLEMENT schema parsing that throws descriptive errors for missing variables
8. EXPORT validated configuration object with typed properties
9. CREATE helper function to check if running in production environment
10. ADD type definitions for environment configuration object

### FILE: src/utils/logger.ts
Purpose: Structured logging configuration using Winston

1. IMPORT winston library for structured logging functionality
2. IMPORT path library to resolve log file locations
3. DEFINE log format using winston JSON formatter for structured output
4. CREATE console transport with colorized output for development
5. ADD file transport for error logs with rotation configuration
6. IMPLEMENT file transport for combined logs with size limits
7. CREATE logger instance with configured transports and log levels
8. ADD custom log levels for different severity types
9. EXPORT configured logger instance for application-wide use
10. CREATE helper methods for common logging patterns

### FILE: src/utils/team-normalizer.ts
Purpose: Normalize team name variations to canonical codes

1. IMPORT zod library for team code validation
2. DEFINE mapping object from team aliases to canonical codes
3. CREATE array of all valid NFL team codes for validation
4. IMPLEMENT function that takes raw team name string as input
5. ADD logic to convert input to lowercase for case-insensitive matching
6. CREATE lookup logic that checks aliases mapping for matches
7. IMPLEMENT fallback logic that attempts partial string matching
8. ADD validation that ensures returned code is valid NFL team
9. EXPORT normalization function with typed return value
10. CREATE reverse mapping function from code to full team name

### FILE: src/types/index.ts
Purpose: Shared TypeScript type definitions

1. IMPORT zod library for runtime type validation schemas
2. DEFINE Source interface with blog metadata properties
3. CREATE Game interface with schedule and line information
4. IMPLEMENT RawArticle interface for fetched content storage
5. ADD Prediction interface with pick details and confidence
6. CREATE ConsensusScore interface for aggregated results
7. DEFINE PickType enum for spread and total classifications
8. IMPLEMENT PickSide enum for home away over under options
9. CREATE ExtractionMethod enum for tracking extraction approach
10. ADD zod schemas for runtime validation of each interface
11. EXPORT all type definitions and validation schemas
12. CREATE utility types for partial updates and queries

### FILE: src/database/schema.prisma
Purpose: Prisma schema defining database structure

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("SUPABASE_URL")
}

model Source {
  id              String    @id @default(uuid())
  blogName        String    @map("blog_name")
  baseUrl         String    @map("base_url")
  associatedTeam  String?   @map("associated_team")
  blogType        String    @map("blog_type")
  activeFlag      Boolean   @default(true) @map("active_flag")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  rawArticles     RawArticle[]
  predictions     Prediction[]

  @@map("sources")
}

model Game {
  id          String    @id @default(uuid())
  season      Int
  week        Int
  gameDate    DateTime  @map("game_date")
  homeTeam    String    @map("home_team")
  awayTeam    String    @map("away_team")
  spreadLine  Float?    @map("spread_line")
  totalLine   Float?    @map("total_line")
  status      String    @default("scheduled")
  createdAt   DateTime  @default(now()) @map("created_at")
  predictions Prediction[]
  consensus   ConsensusScore[]

  @@unique([season, week, homeTeam, awayTeam])
  @@map("games")
}

model RawArticle {
  id            String    @id @default(uuid())
  sourceId      String    @map("source_id")
  fetchedAt     DateTime  @default(now()) @map("fetched_at")
  url           String
  html          String    @db.Text
  articleHash   String    @map("article_hash")
  week          Int?
  processed     Boolean   @default(false)
  createdAt     DateTime  @default(now()) @map("created_at")
  source        Source    @relation(fields: [sourceId], references: [id])

  @@unique([sourceId, articleHash])
  @@map("raw_articles")
}

model Prediction {
  id                    String    @id @default(uuid())
  sourceId              String    @map("source_id")
  gameId                String    @map("game_id")
  season                Int
  week                  Int
  pickType              String    @map("pick_type")
  pickSide              String    @map("pick_side")
  lineAtPick            Float     @map("line_at_pick")
  extractionMethod      String    @map("extraction_method")
  extractionConfidence  Float     @map("extraction_confidence")
  extractedAt           DateTime  @default(now()) @map("extracted_at")
  articleUrl            String    @map("article_url")
  rawQuote              String?   @map("raw_quote") @db.Text
  source                Source    @relation(fields: [sourceId], references: [id])
  game                  Game      @relation(fields: [gameId], references: [id])

  @@unique([sourceId, gameId, pickType])
  @@map("predictions")
}

model ConsensusScore {
  id              String    @id @default(uuid())
  gameId          String    @map("game_id")
  season          Int
  week            Int
  pickType        String    @map("pick_type")
  majoritySide    String    @map("majority_side")
  score           Int
  signalLabel     String    @map("signal_label")
  numPredictions  Int       @map("num_predictions")
  calculatedAt    DateTime  @default(now()) @map("calculated_at")
  game            Game      @relation(fields: [gameId], references: [id])

  @@unique([gameId, pickType])
  @@map("consensus_scores")
}
```

### FILE: src/database/client.ts
Purpose: Prisma client initialization and connection management

1. IMPORT PrismaClient from prisma client package
2. IMPORT logger utility for database operation logging
3. DECLARE global prisma variable to prevent multiple instances
4. CREATE function to initialize new PrismaClient instance
5. ADD connection logging configuration to track queries
6. IMPLEMENT error logging for failed database operations
7. CREATE singleton pattern to reuse client across application
8. ADD graceful shutdown handler for database disconnection
9. EXPORT prisma client instance for application-wide use
10. IMPLEMENT connection retry logic for transient failures

### FILE: src/services/cache.service.ts
Purpose: Article caching to prevent re-processing

1. IMPORT crypto library for generating content hashes
2. IMPORT prisma client for database operations
3. IMPORT logger utility for cache operation tracking
4. CREATE function that generates SHA256 hash from article URL and content
5. IMPLEMENT function to check if article hash exists in database
6. ADD function to store new article with generated hash
7. CREATE query that searches raw articles by source and hash
8. IMPLEMENT cache hit logging for monitoring effectiveness
9. ADD cache miss logging to track new article discoveries
10. EXPORT cache checking and storage functions

### FILE: src/services/schedule-fetcher.service.ts
Purpose: Fetch NFL schedule and lines from sports API

1. IMPORT axios library for HTTP requests to sports API
2. IMPORT prisma client for storing schedule data
3. IMPORT logger utility for schedule fetch tracking
4. IMPORT environment config for API URL configuration
5. CREATE function that fetches current week schedule from ESPN API
6. IMPLEMENT response parsing to extract game details
7. ADD logic to extract spread and total lines from odds data
8. CREATE function to normalize team names from API response
9. IMPLEMENT upsert logic to update existing games or create new
10. ADD error handling for API failures with retry logic
11. CREATE function to determine current NFL week from date
12. EXPORT schedule fetching function for job orchestration

### FILE: src/services/exa-discovery.service.ts
Purpose: Discover weekly picks articles using Exa MCP

1. IMPORT axios library for Exa API HTTP requests
2. IMPORT environment config for Exa API key
3. IMPORT logger utility for discovery operation tracking
4. IMPORT Source type definition for type safety
5. CREATE function that constructs Exa search query from source metadata
6. IMPLEMENT query template that includes site domain and keywords
7. ADD week number and team name to search query parameters
8. CREATE function that calls Exa search API with constructed query
9. IMPLEMENT response parsing to extract article URLs
10. ADD filtering logic to only return articles from last 24 hours
11. CREATE date range calculation for time-based filtering
12. IMPLEMENT error handling for Exa API failures
13. ADD logging for discovered URLs per source
14. EXPORT discovery function that returns array of URLs

### FILE: src/services/article-fetcher.service.ts
Purpose: Fetch article HTML content via HTTP

1. IMPORT axios library for HTTP requests
2. IMPORT cheerio library for HTML parsing
3. IMPORT logger utility for fetch operation tracking
4. IMPORT cache service to check for existing articles
5. CREATE function that accepts URL and returns HTML content
6. IMPLEMENT axios request with user agent header
7. ADD timeout configuration to prevent hanging requests
8. CREATE error handling for 404 and 5xx responses
9. IMPLEMENT retry logic with exponential backoff
10. ADD function to extract text content from HTML
11. CREATE function to remove script and style tags
12. IMPLEMENT cache checking before fetching
13. ADD logging for successful and failed fetches
14. EXPORT fetch function with typed return value

### FILE: src/services/llm-extraction.service.ts
Purpose: Extract predictions from articles using LLM

1. IMPORT axios library for OpenRouter API requests
2. IMPORT environment config for API key
3. IMPORT logger utility for extraction tracking
4. IMPORT zod schemas for prediction validation
5. IMPORT team normalizer for canonical team codes
6. CREATE function that constructs LLM prompt from article text
7. IMPLEMENT prompt template that requests JSON output
8. ADD game schedule context to prompt for team matching
9. CREATE JSON schema definition for expected output format
10. IMPLEMENT function that calls OpenRouter API with prompt
11. ADD response parsing to extract JSON from LLM output
12. CREATE validation logic using zod schemas
13. IMPLEMENT confidence scoring based on explicit language
14. ADD logic to convert score predictions to spread and total
15. CREATE function to match extracted teams to games
16. IMPLEMENT error handling for malformed JSON

---
Generated by Socrates AI Architecture - 11/27/2025