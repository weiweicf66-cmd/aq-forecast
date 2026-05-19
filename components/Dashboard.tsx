"use client";

import { useMemo, useState } from "react";
import type { ForecastDocument } from "@/lib/types";
import { CITIES } from "@/lib/cities";
import { CitySelector } from "./CitySelector";
import { WeekHeatmap } from "./WeekHeatmap";
import { DailyProbabilityCard } from "./DailyProbabilityCard";

export function Dashboard({ data }: { data: ForecastDocument }) {
  const availableCities = useMemo(
    () => CITIES.filter((c) => data.cities[c.id]?.days?.length),
    [data],
  );
  const [cityId, setCityId] = useState<string>(availableCities[0]?.id ?? CITIES[0].id);

  const cityData = data.cities[cityId];
  const days = cityData?.days ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {cityData?.name ?? "—"} · 未来 {days.length} 天 AQI 概率
        </h2>
        <CitySelector cities={availableCities} value={cityId} onChange={setCityId} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">每个等级的发生概率（颜色越深概率越高）</div>
        <WeekHeatmap days={days} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">逐日概率分布与 PM2.5 区间</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((d) => (
            <DailyProbabilityCard key={d.date} day={d} />
          ))}
        </div>
      </section>
    </div>
  );
}
