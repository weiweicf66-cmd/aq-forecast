import type { DailyDistribution } from "@/lib/types";
import { AQI_CATEGORIES } from "@/lib/aqi";
import { CATEGORY_HEX } from "@/lib/colors";

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+08:00");
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" }).format(d);
}

export function WeekHeatmap({ days }: { days: DailyDistribution[] }) {
  if (!days.length) return null;
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1.5 text-xs"
        style={{
          gridTemplateColumns: `auto repeat(${days.length}, minmax(64px, 1fr))`,
        }}
      >
        <div />
        {days.map((d) => (
          <div key={d.date} className="text-center text-zinc-600 dark:text-zinc-400">
            {shortDate(d.date)}
          </div>
        ))}

        {AQI_CATEGORIES.map((cat) => (
          <FragmentRow key={cat} cat={cat} days={days} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ cat, days }: { cat: (typeof AQI_CATEGORIES)[number]; days: DailyDistribution[] }) {
  const hex = CATEGORY_HEX[cat];
  return (
    <>
      <div className="pr-2 text-right text-zinc-600 dark:text-zinc-400">{cat}</div>
      {days.map((d) => {
        const p = d.categories[cat] ?? 0;
        return (
          <div
            key={d.date + cat}
            className="flex h-8 items-center justify-center rounded-sm text-[11px] font-medium"
            style={{
              backgroundColor: hex,
              opacity: 0.15 + 0.85 * p,
              color: p > 0.35 ? "#fff" : "#000",
            }}
            title={`${cat} ${(p * 100).toFixed(0)}%`}
          >
            {p >= 0.05 ? `${(p * 100).toFixed(0)}%` : ""}
          </div>
        );
      })}
    </>
  );
}
