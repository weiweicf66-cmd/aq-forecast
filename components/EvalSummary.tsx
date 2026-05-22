import type { EvalDocument } from "@/lib/types";

function fmtPct(x: number | null | undefined, digits = 0): string {
  if (typeof x !== "number") return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function EvalSummary({ data }: { data: EvalDocument }) {
  const n = data.overall.n_pairs;
  const enoughData = n >= 30; // ~5 days × 6 cities or so

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">预报准确度回顾</h2>
        <span className="text-xs text-zinc-500">
          数据窗口 {data.evaluation_window_days} 天 · 实测源 {data.ground_truth_source}
        </span>
      </header>

      {n === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          还没有可评估的预报样本（运行一两天后开始累积）。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="已评估样本" value={String(n)} hint="预报-实测配对" />
            <Stat
              label="等级预报准确率"
              value={fmtPct(data.overall.categorical_accuracy)}
              hint="最可能等级与实测吻合的比例"
            />
            <Stat
              label="概率误差 (Brier)"
              value={
                typeof data.overall.brier_score === "number"
                  ? data.overall.brier_score.toFixed(3)
                  : "—"
              }
              hint="越低越好；0 = 完美，1+ = 较差"
            />
          </div>

          {enoughData ? (
            <CityBreakdown data={data} />
          ) : (
            <p className="text-xs text-zinc-500">
              样本量较少（{n} 对），结果仅供参考；积累至少 30 对后更稳定。
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-zinc-400">{hint}</span>
    </div>
  );
}

function CityBreakdown({ data }: { data: EvalDocument }) {
  const rows = Object.entries(data.city_metrics)
    .filter(([, m]) => m.n_pairs > 0)
    .sort((a, b) => (b[1].n_pairs ?? 0) - (a[1].n_pairs ?? 0));
  if (rows.length === 0) return null;

  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
        分城市详情
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-2 py-1 text-left font-normal">城市</th>
              <th className="px-2 py-1 text-right font-normal">样本</th>
              <th className="px-2 py-1 text-right font-normal">准确率</th>
              <th className="px-2 py-1 text-right font-normal">Brier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, m]) => (
              <tr key={id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1">{m.name}</td>
                <td className="px-2 py-1 text-right tabular-nums">{m.n_pairs}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmtPct(m.categorical_accuracy)}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {typeof m.brier_score === "number" ? m.brier_score.toFixed(3) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
