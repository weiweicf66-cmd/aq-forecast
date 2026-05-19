import type { AqiCategory } from "./aqi";

export type DailyDistribution = {
  date: string;            // YYYY-MM-DD
  pm25_p10: number;
  pm25_p50: number;
  pm25_p90: number;
  categories: Record<AqiCategory, number>;  // 概率，和为 1
  dominant: AqiCategory;
};

export type CityForecast = {
  name: string;
  days: DailyDistribution[];
};

export type ForecastDocument = {
  generated_at: string;     // ISO 8601
  method_version: string;
  horizon_days: number;
  cities: Record<string, CityForecast>;
};
