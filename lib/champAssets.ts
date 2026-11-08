import { withBasePath } from "@/lib/site";

// Mapeo de código de piloto → ruta local en /public/drivers/
// Fotos oficiales de media.formula1.com (parrilla 2026 + ausentes con su última temporada)
export const DRIVER_PHOTOS: Record<string, string> = {
  ALB: withBasePath("/drivers/2026-ALB.webp"),
  ALO: withBasePath("/drivers/2026-ALO.webp"),
  ANT: withBasePath("/drivers/2026-ANT.webp"),
  BEA: withBasePath("/drivers/2026-BEA.webp"),
  BOR: withBasePath("/drivers/2026-BOR.webp"),
  BOT: withBasePath("/drivers/2026-BOT.webp"),
  COL: withBasePath("/drivers/2026-COL.webp"),
  GAS: withBasePath("/drivers/2026-GAS.webp"),
  HAD: withBasePath("/drivers/2026-HAD.webp"),
  HAM: withBasePath("/drivers/2026-HAM.webp"),
  HUL: withBasePath("/drivers/2026-HUL.webp"),
  LAW: withBasePath("/drivers/2026-LAW.webp"),
  LEC: withBasePath("/drivers/2026-LEC.webp"),
  LIN: withBasePath("/drivers/2026-LIN.webp"),
  NOR: withBasePath("/drivers/2026-NOR.webp"),
  OCO: withBasePath("/drivers/2026-OCO.webp"),
  PER: withBasePath("/drivers/2026-PER.webp"),
  PIA: withBasePath("/drivers/2026-PIA.webp"),
  RUS: withBasePath("/drivers/2026-RUS.webp"),
  SAI: withBasePath("/drivers/2026-SAI.webp"),
  STR: withBasePath("/drivers/2026-STR.webp"),
  VER: withBasePath("/drivers/2026-VER.webp"),
  DOO: withBasePath("/drivers/2025-DOO.webp"),
  TSU: withBasePath("/drivers/2025-TSU.webp"),
};

// Nacionalidad (Jolpica) → código de país de 3 letras (estilo F1/COI)
export const NATIONALITY_CODE: Record<string, string> = {
  Dutch: "NED",
  British: "GBR",
  Monegasque: "MON",
  Spanish: "ESP",
  Australian: "AUS",
  Mexican: "MEX",
  Finnish: "FIN",
  German: "GER",
  French: "FRA",
  Danish: "DEN",
  Canadian: "CAN",
  Thai: "THA",
  Japanese: "JPN",
  American: "USA",
  Chinese: "CHN",
  Italian: "ITA",
  Brazilian: "BRA",
  Argentine: "ARG",
  Argentinian: "ARG",
  Austrian: "AUT",
  Swiss: "SUI",
  "New Zealander": "NZL",
  Belgian: "BEL",
  Russian: "RUS",
  Polish: "POL",
};

// Mapeo de constructorId (Jolpica) → coche 2026 oficial en /public/cars/
export const CAR_IMAGES: Record<string, string> = {
  red_bull: withBasePath("/cars/2026-red_bull.webp"),
  mercedes: withBasePath("/cars/2026-mercedes.webp"),
  ferrari: withBasePath("/cars/2026-ferrari.webp"),
  mclaren: withBasePath("/cars/2026-mclaren.webp"),
  aston_martin: withBasePath("/cars/2026-aston_martin.webp"),
  alpine: withBasePath("/cars/2026-alpine.webp"),
  williams: withBasePath("/cars/2026-williams.webp"),
  rb: withBasePath("/cars/2026-rb.webp"),
  racing_bulls: withBasePath("/cars/2026-rb.webp"),
  haas: withBasePath("/cars/2026-haas.webp"),
  audi: withBasePath("/cars/2026-audi.webp"),
  cadillac: withBasePath("/cars/2026-cadillac.webp"),
};

// Mapeo de constructorId (Jolpica) → ruta local en /public/teams/
export const TEAM_LOGOS: Record<string, string> = {
  red_bull: withBasePath("/teams/red-bull.png"),
  mercedes: withBasePath("/teams/mercedes.png"),
  ferrari: withBasePath("/teams/ferrari.png"),
  mclaren: withBasePath("/teams/mclaren.png"),
  aston_martin: withBasePath("/teams/aston-martin.png"),
  alpine: withBasePath("/teams/alpine.png"),
  williams: withBasePath("/teams/williams.png"),
  rb: withBasePath("/teams/visa-red.png"),
  racing_bulls: withBasePath("/teams/visa-red.png"),
  kick_sauber: withBasePath("/teams/kick.png"),
  sauber: withBasePath("/teams/kick.png"),
  haas: withBasePath("/teams/haas.png"),
  audi: withBasePath("/teams/audi.png"),
  cadillac: withBasePath("/teams/cadillac.png"),
};

// Colores de respaldo por constructorId (Jolpica) si OpenF1 no responde.
// Los reales se leen por temporada de OpenF1 (ver resolveTeamColor).
export const TEAM_COLORS: Record<string, string> = {
  red_bull: "#4781D7",
  mercedes: "#00D7B6",
  ferrari: "#ED1131",
  mclaren: "#F47600",
  aston_martin: "#229971",
  alpine: "#00A1E8",
  williams: "#1868DB",
  rb: "#6C98FF",
  racing_bulls: "#6C98FF",
  kick_sauber: "#52E252",
  sauber: "#52E252",
  haas: "#9C9FA2",
  audi: "#F50537",
  cadillac: "#909090",
};

export function teamColor(id: string): string {
  return TEAM_COLORS[id] ?? "#888888";
}

// Palabras clave para casar el constructorId de Jolpica con el nombre de equipo de OpenF1
const TEAM_KEYWORDS: Record<string, string[]> = {
  red_bull: ["red bull racing", "red bull"],
  rb: ["racing bulls", "visa cash app rb", "rb"],
  racing_bulls: ["racing bulls", "visa cash app rb", "rb"],
  kick_sauber: ["kick sauber", "sauber"],
  sauber: ["kick sauber", "sauber", "alfa romeo"],
  alfa: ["alfa romeo"],
  aston_martin: ["aston martin"],
  mclaren: ["mclaren"],
  mercedes: ["mercedes"],
  ferrari: ["ferrari"],
  alpine: ["alpine"],
  williams: ["williams"],
  haas: ["haas"],
  audi: ["audi"],
  cadillac: ["cadillac"],
};

/** Color del equipo en la temporada: paleta de OpenF1 si casa, si no el respaldo. */
export function resolveTeamColor(
  id: string,
  seasonColors: Record<string, string> | undefined,
): string {
  if (seasonColors) {
    const names = Object.keys(seasonColors);
    for (const kw of TEAM_KEYWORDS[id] ?? [id.replace(/_/g, " ")]) {
      const hit = names.find((n) => {
        const name = n.toLowerCase();
        return kw.length <= 3 ? name === kw : name.includes(kw);
      });
      if (hit) return seasonColors[hit];
    }
  }
  return teamColor(id);
}
