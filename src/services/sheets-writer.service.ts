import fs from "fs";
import { google, sheets_v4 } from "googleapis";
import { env } from "../config/environment";
import { log } from "../utils/logger";
import { prisma } from "../database/client";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const getSheetsClient = async (): Promise<sheets_v4.Sheets> => {
  if (!fs.existsSync(env.GOOGLE_SHEETS_CREDENTIALS)) {
    throw new Error(`Google Sheets credentials file not found at ${env.GOOGLE_SHEETS_CREDENTIALS}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_SHEETS_CREDENTIALS,
    scopes: SCOPES,
  });

  return google.sheets({ version: "v4", auth });
};

const ensureSheetExists = async (sheets: sheets_v4.Sheets, title: string) => {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: env.GOOGLE_SHEET_ID });
  const exists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  log.info("Created new sheet tab", { title });
};

export const publishConsensusToSheets = async (week: number, season: number) => {
  const sheets = await getSheetsClient();
  const title = `Week ${week}`;

  await ensureSheetExists(sheets, title);

  const consensus = await prisma.consensusScore.findMany({ where: { week, season } });
  const games = await prisma.game.findMany({ where: { week, season } });
  const gameLookup = new Map(games.map((game) => [game.id, game]));

  const values = [
    ["Season", "Week", "Home", "Away", "Pick Type", "Majority", "Score", "Signal", "Num Predictions"],
    ...consensus.map((entry) => {
      const game = gameLookup.get(entry.gameId);
      return [
        entry.season,
        entry.week,
        game?.homeTeam ?? "",
        game?.awayTeam ?? "",
        entry.pickType,
        entry.majoritySide,
        entry.score,
        entry.signalLabel,
        entry.numPredictions,
      ];
    }),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEET_ID,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  log.info("Published consensus to Google Sheets", { week, season, rows: values.length - 1 });
};
