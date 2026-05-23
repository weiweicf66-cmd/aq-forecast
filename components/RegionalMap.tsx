"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ForecastDocument, DailyDistribution } from "@/lib/types";
import { CITIES } from "@/lib/cities";
import { CATEGORY_HEX } from "@/lib/colors";
import { AQI_CATEGORIES } from "@/lib/aqi";

// ECharts 自托管（public/vendor/echarts.min.js）。
// 不依赖外部 CDN，跟 forecast.json 走同一条 Vercel 链路，国内访问稳定。
// 更新 echarts 版本：替换 public/vendor/echarts.min.js 即可。
const ECHARTS_URL = "/vendor/echarts.min.js";

type EChartsInstance = {
  setOption: (opt: unknown) => void;
  resize: () => void;
  dispose: () => void;
};
type EChartsGlobal = {
  init: (el: HTMLElement) => EChartsInstance;
  registerMap: (name: string, geo: unknown) => void;
};

function loadEcharts(): Promise<EChartsGlobal> {
  const w = window as unknown as { echarts?: EChartsGlobal };
  if (w.echarts) return Promise.resolve(w.echarts);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ECHARTS_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () =>
        w.echarts ? resolve(w.echarts) : reject(new Error("ECharts CDN 加载后未挂到 window")),
      );
      existing.addEventListener("error", () => reject(new Error("ECharts CDN 加载失败")));
      return;
    }
    const s = document.createElement("script");
    s.src = ECHARTS_URL;
    s.async = true;
    s.onload = () => (w.echarts ? resolve(w.echarts) : reject(new Error("ECharts CDN 加载后未挂到 window")));
    s.onerror = () => reject(new Error("ECharts 加载失败（vendor 文件未部署？）"));
    document.head.appendChild(s);
  });
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+08:00");
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(d);
}

function weekdayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+08:00");
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short", timeZone: "Asia/Shanghai" }).format(d);
}

export function RegionalMap({ data }: { data: ForecastDocument }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const [echartsReady, setEchartsReady] = useState(false);
  const [echartsErr, setEchartsErr] = useState<string | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const days: string[] = useMemo(() => {
    const sample = Object.values(data.cities).find((c) => c.days.length > 0);
    return (sample?.days ?? []).map((d) => d.date);
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let chart: EChartsInstance | null = null;

    (async () => {
      try {
        const echarts = await loadEcharts();
        if (cancelled) return;
        const geoRes = await fetch("/geo/regions.json");
        if (!geoRes.ok) throw new Error("加载行政区地图失败");
        const geoJson = await geoRes.json();
        if (cancelled) return;
        echarts.registerMap("china-regions", geoJson);
        if (!containerRef.current) return;
        chart = echarts.init(containerRef.current);
        chartRef.current = chart;
        setEchartsReady(true);

        const handleResize = () => chart?.resize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      } catch (e: unknown) {
        if (!cancelled) setEchartsErr(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !echartsReady) return;
    if (days.length === 0) return;
    const dayIdx = Math.min(selectedDayIdx, days.length - 1);
    const targetDate = days[dayIdx];

    type RegionDatum = {
      name: string;          // feature.properties.name (用于匹配)
      cityName: string;      // 展示用
      dayInfo: DailyDistribution;
      itemStyle: { areaColor: string };
      value: number;         // dominant 概率（驱动透明度可选）
    };

    const regionData: RegionDatum[] = CITIES.flatMap((city) => {
      const cf = data.cities[city.id];
      const day = cf?.days?.find((d) => d.date === targetDate);
      if (!day) return [];
      const dominantProb = day.categories[day.dominant] ?? 0;
      return [
        {
          name: city.featureName,
          cityName: city.name,
          dayInfo: day,
          itemStyle: { areaColor: CATEGORY_HEX[day.dominant] },
          value: dominantProb,
        },
      ];
    });

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (p: { data?: RegionDatum; name?: string }) => {
          const d = p.data;
          if (!d?.dayInfo) {
            return p.name ? `<div style="color:#888;">${p.name}<br/><span style="font-size:11px;">未监测</span></div>` : "";
          }
          const cats = AQI_CATEGORIES.map(
            (c) =>
              `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;"><span>${c}</span><span>${((d.dayInfo.categories[c] ?? 0) * 100).toFixed(0)}%</span></div>`,
          ).join("");
          return `
            <div style="font-weight:600;margin-bottom:4px;">${d.cityName}</div>
            <div style="font-size:11px;color:#888;margin-bottom:6px;">最可能：${d.dayInfo.dominant} · PM2.5 ${d.dayInfo.pm25_p10}–${d.dayInfo.pm25_p90}</div>
            ${cats}
          `;
        },
      },
      series: [
        {
          name: "AQI",
          type: "map",
          map: "china-regions",
          roam: true,
          zoom: 1.2,
          center: [110, 36],
          scaleLimit: { min: 0.8, max: 6 },
          itemStyle: {
            areaColor: "#f4f4f5",
            borderColor: "#d4d4d8",
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: { areaColor: undefined, borderColor: "#18181b", borderWidth: 1.5 },
            label: { show: true, fontWeight: 600, color: "#18181b" },
          },
          select: { disabled: true },
          label: { show: false },
          data: regionData,
        },
      ],
    });
  }, [data, selectedDayIdx, days, echartsReady]);

  if (echartsErr) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
        地图加载失败：{echartsErr}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">区域概率地图</h2>
        <span className="text-xs text-zinc-500">行政区颜色 = 该城市最可能 AQI 等级 · 灰色 = 未监测 · 悬停看详情</span>
      </header>

      {days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {days.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDayIdx(i)}
              className={
                "rounded-md border px-2.5 py-1 text-xs font-medium transition " +
                (i === selectedDayIdx
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200")
              }
            >
              {shortDate(d)}
              <span className="ml-1 text-[10px] opacity-70">{weekdayLabel(d)}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={containerRef} className="h-[560px] w-full" />

      <Legend />
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
      {AQI_CATEGORIES.map((cat) => (
        <span key={cat} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: CATEGORY_HEX[cat] }}
          />
          {cat}
        </span>
      ))}
    </div>
  );
}
