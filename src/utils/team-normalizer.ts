import { z } from "zod";

export const TEAM_CODES = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LV",
  "LAC",
  "LAR",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS",
] as const;

export type TeamCode = (typeof TEAM_CODES)[number];

const TeamCodeSchema = z.enum(TEAM_CODES);

const aliasToCode: Record<string, TeamCode> = {
  "arizona cardinals": "ARI",
  cardinals: "ARI",
  cards: "ARI",
  "atlanta falcons": "ATL",
  falcons: "ATL",
  "baltimore ravens": "BAL",
  ravens: "BAL",
  "buffalo bills": "BUF",
  bills: "BUF",
  "carolina panthers": "CAR",
  panthers: "CAR",
  "chicago bears": "CHI",
  bears: "CHI",
  "cincinnati bengals": "CIN",
  bengals: "CIN",
  "cleveland browns": "CLE",
  browns: "CLE",
  "dallas cowboys": "DAL",
  cowboys: "DAL",
  "denver broncos": "DEN",
  broncos: "DEN",
  "detroit lions": "DET",
  lions: "DET",
  "green bay packers": "GB",
  packers: "GB",
  "houston texans": "HOU",
  texans: "HOU",
  "indianapolis colts": "IND",
  colts: "IND",
  "jacksonville jaguars": "JAX",
  jaguars: "JAX",
  jags: "JAX",
  "kansas city chiefs": "KC",
  chiefs: "KC",
  "las vegas raiders": "LV",
  raiders: "LV",
  "los angeles chargers": "LAC",
  chargers: "LAC",
  "la chargers": "LAC",
  "los angeles rams": "LAR",
  rams: "LAR",
  "la rams": "LAR",
  "miami dolphins": "MIA",
  dolphins: "MIA",
  fins: "MIA",
  "minnesota vikings": "MIN",
  vikings: "MIN",
  vikes: "MIN",
  "new england patriots": "NE",
  patriots: "NE",
  pats: "NE",
  "new orleans saints": "NO",
  saints: "NO",
  "new york giants": "NYG",
  giants: "NYG",
  gmen: "NYG",
  "new york jets": "NYJ",
  jets: "NYJ",
  "philadelphia eagles": "PHI",
  eagles: "PHI",
  "pittsburgh steelers": "PIT",
  steelers: "PIT",
  "seattle seahawks": "SEA",
  seahawks: "SEA",
  hawks: "SEA",
  "san francisco 49ers": "SF",
  "san francisco": "SF",
  niners: "SF",
  "tampa bay buccaneers": "TB",
  buccaneers: "TB",
  bucs: "TB",
  "tennessee titans": "TEN",
  titans: "TEN",
  "washington commanders": "WAS",
  "washington football team": "WAS",
  commanders: "WAS",
  "football team": "WAS",
};

const codeToName: Record<TeamCode, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LV: "Las Vegas Raiders",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

export const normalizeTeamName = (rawName: string | null | undefined): TeamCode | null => {
  if (!rawName) return null;
  const cleaned = rawName.trim().toLowerCase();

  if (!cleaned) return null;

  const exactAlias = aliasToCode[cleaned];
  if (exactAlias) return exactAlias;

  const upperRaw = rawName.trim().toUpperCase();
  if (TeamCodeSchema.safeParse(upperRaw).success) {
    return upperRaw as TeamCode;
  }

  const partialAlias = Object.entries(aliasToCode).find(([alias]) => cleaned.includes(alias) || alias.includes(cleaned));
  if (partialAlias) {
    return partialAlias[1];
  }

  return null;
};

export const teamCodeToName = (code: TeamCode | string): string | null => {
  if (!code) return null;
  const parsed = TeamCodeSchema.safeParse(code.toUpperCase());
  if (!parsed.success) return null;
  return codeToName[parsed.data];
};

export const TEAM_CODE_LIST: TeamCode[] = [...TEAM_CODES];

export const getTeamAliases = (code: TeamCode): string[] => {
  const name = teamCodeToName(code);
  const aliases = Object.entries(aliasToCode)
    .filter(([, value]) => value === code)
    .map(([alias]) => alias);

  return [
    code.toLowerCase(),
    code.toUpperCase(),
    ...(name ? [name, name.toLowerCase()] : []),
    ...aliases,
  ];
};
