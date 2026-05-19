// PM2.5 → 中国 AQI 等级 (GB 3095-2012)
// 24h 平均浓度断点 (µg/m³) → AQI 指数断点
// 优 0-50, 良 51-100, 轻度 101-150, 中度 151-200, 重度 201-300, 严重 301-500

export const AQI_CATEGORIES = ["优", "良", "轻度污染", "中度污染", "重度污染", "严重污染"] as const;
export type AqiCategory = (typeof AQI_CATEGORIES)[number];

type Breakpoint = { cLow: number; cHigh: number; iLow: number; iHigh: number; category: AqiCategory };

// 来源：HJ 633-2012 表 1（PM2.5 24h 均值）
const PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0,   cHigh: 35,  iLow: 0,   iHigh: 50,  category: "优" },
  { cLow: 35,  cHigh: 75,  iLow: 50,  iHigh: 100, category: "良" },
  { cLow: 75,  cHigh: 115, iLow: 100, iHigh: 150, category: "轻度污染" },
  { cLow: 115, cHigh: 150, iLow: 150, iHigh: 200, category: "中度污染" },
  { cLow: 150, cHigh: 250, iLow: 200, iHigh: 300, category: "重度污染" },
  { cLow: 250, cHigh: 500, iLow: 300, iHigh: 500, category: "严重污染" },
];

export function pm25ToAqi(pm25: number): number {
  if (pm25 < 0) return 0;
  for (const bp of PM25_BREAKPOINTS) {
    if (pm25 <= bp.cHigh) {
      return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow);
    }
  }
  return 500;
}

export function pm25ToCategory(pm25: number): AqiCategory {
  for (const bp of PM25_BREAKPOINTS) {
    if (pm25 <= bp.cHigh) return bp.category;
  }
  return "严重污染";
}
