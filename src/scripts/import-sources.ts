import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../database/client";
import { normalizeTeamName } from "../utils/team-normalizer";
import { log } from "../utils/logger";

interface CsvRow {
  division: string;
  team: string;
  blogName: string;
  url: string;
  networkType: string;
  picksFormat: string;
  spreadPicks: string;
  ouPicks: string;
  weeklyColumn: string;
  rssAvailable: string;
  scrapingPriority: string;
  urlPatternForPicks: string;
  notes: string;
}

function parseCsv(csvContent: string): CsvRow[] {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Parse header and create mapping
  const headerLine = parseCsvLine(lines[0]);
  const headerMap: Record<string, number> = {};
  headerLine.forEach((header, idx) => {
    const normalized = header.trim().toLowerCase();
    headerMap[normalized] = idx;
  });

  // Helper to get value by header name
  const getValue = (values: string[], headerName: string): string => {
    const idx = headerMap[headerName.toLowerCase()];
    return idx !== undefined ? (values[idx]?.trim() || "") : "";
  };

  // Parse rows
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === 0) continue;

    const row: CsvRow = {
      division: getValue(values, "Division"),
      team: getValue(values, "Team"),
      blogName: getValue(values, "Blog Name"),
      url: getValue(values, "URL"),
      networkType: getValue(values, "Network Type"),
      picksFormat: getValue(values, "Picks Format"),
      spreadPicks: getValue(values, "Spread Picks"),
      ouPicks: getValue(values, "O/U Picks"),
      weeklyColumn: getValue(values, "Weekly Column"),
      rssAvailable: getValue(values, "RSS Available"),
      scrapingPriority: getValue(values, "Scraping Priority"),
      urlPatternForPicks: getValue(values, "URL Pattern for Picks"),
      notes: getValue(values, "Notes"),
    };

    // Skip empty rows
    if (!row.blogName && !row.url) continue;

    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current); // Add last value

  return values;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getActiveFlag(priority: string): boolean {
  const tier = priority.trim().toLowerCase();
  // Tier 1 and Tier 2 are active, Tier 3 can be inactive or active (defaulting to true)
  return tier.includes("tier 1") || tier.includes("tier 2") || tier.includes("tier 3");
}

async function importSources() {
  try {
    log.info("Starting source import from CSV");

    const csvPath = join(process.cwd(), "nfl_parlay_sources.xlsx - Master Source List.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    const rows = parseCsv(csvContent);

    log.info(`Parsed ${rows.length} rows from CSV`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        // Normalize URL
        const baseUrl = normalizeUrl(row.url);
        if (!baseUrl || baseUrl === "https://") {
          log.warn(`Skipping row with invalid URL: ${row.blogName}`);
          skipped++;
          continue;
        }

        // Normalize team name
        const associatedTeam = normalizeTeamName(row.team);

        // Determine blog type (use Network Type)
        const blogType = row.networkType || row.picksFormat || "Unknown";

        // Determine active flag based on priority
        const activeFlag = getActiveFlag(row.scrapingPriority);

        // Check if source already exists
        const existing = await prisma.source.findFirst({
          where: { baseUrl },
        });

        if (existing) {
          log.info(`Source already exists: ${row.blogName} (${baseUrl}), skipping`);
          skipped++;
          continue;
        }

        // Create source
        await prisma.source.create({
          data: {
            blogName: row.blogName.trim(),
            baseUrl,
            associatedTeam,
            blogType,
            activeFlag,
          },
        });

        imported++;
        log.info(`Imported: ${row.blogName} (${baseUrl}) - Team: ${associatedTeam || "N/A"} - Active: ${activeFlag}`);
      } catch (error) {
        errors++;
        log.error(`Error importing ${row.blogName}:`, { error });
      }
    }

    log.info("Import complete", {
      imported,
      skipped,
      errors,
      total: rows.length,
    });

    // Show summary
    const activeCount = await prisma.source.count({ where: { activeFlag: true } });
    const inactiveCount = await prisma.source.count({ where: { activeFlag: false } });
    log.info("Source summary", {
      total: activeCount + inactiveCount,
      active: activeCount,
      inactive: inactiveCount,
    });
  } catch (error) {
    log.error("Failed to import sources", { error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  importSources()
    .then(() => {
      log.info("Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      log.error("Script failed", { error });
      process.exit(1);
    });
}

export { importSources };

