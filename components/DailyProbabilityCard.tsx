import type { DailyDistribution } from "@/lib/types";
import { AQI_CATEGORIES } from "@/lib/aqi";
import { CATEGORY_BG, CATEGORY_HEX } from "@/lib/colors";

function weekdayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+08:00");
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "Asia/Shanghai" }).format(d);
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+08:00");
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" }).format(d);
}

export function DailyProbabilityCard({ day }: { day: DailyDistribution }) {
  const dominantHex = CATEGORY_HEX[day.dominant];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">{shortDate(day.date)}</span>
          <span className="text-xs text-zinc-500">{weekdayLabel(day.date)}</span>
        </div>
        <span
          className="rounded-md px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: dominantHex }}
        >
          最可能：{day.dominant}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {AQI_CATEGORIES.map((cat) => {
          const p = day.categories[cat] ?? 0;
          return (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-zinc-600 dark:text-zinc-400">{cat}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`absolute inset-y-0 left-0 ${CATEGORY_BG[cat]}`}
                  style={{ width: `${Math.max(0, p * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {(p * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>PM2.5 (µg/m³)</span>
        <span className="tabular-nums" title="基于 1000 次蒙特卡洛采样的 10% / 50% / 90% 分位数">
          区间{" "}
          <span className="text-zinc-700 dark:text-zinc-200">
            {day.pm25_p10}–{day.pm25_p90}
          </span>
          <span className="mx-1.5 text-zinc-300">·</span>
          最可能{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{day.pm25_p50}</span>
        </span>
      </div>
    </div>
  );
}
