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

export type LeadDayMetric = {
  lead_day: number;
  n: number;
  brier: number;
  accuracy: number;
};

export type CityEvalMetric = {
  name: string;
  n_pairs: number;
  brier_score?: number;
  categorical_accuracy?: number;
  by_lead_day?: LeadDayMetric[];
};

export type EvalDocument = {
  generated_at: string;
  evaluation_window_days: number;
  ground_truth_source: string;
  today: string;
  overall: {
    n_pairs: number;
    brier_score: number | null;
    categorical_accuracy: number | null;
  };
  by_lead_day_overall?: LeadDayMetric[];
  city_metrics: Record<string, CityEvalMetric>;
};
