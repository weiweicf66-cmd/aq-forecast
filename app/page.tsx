import fs from "node:fs/promises";
import path from "node:path";
import type { ForecastDocument, EvalDocument } from "@/lib/types";
import { Dashboard } from "@/components/Dashboard";
import { DataFreshness } from "@/components/DataFreshness";
import { EvalSummary } from "@/components/EvalSummary";

async function loadJson<T>(file: string): Promise<T | null> {
  try {
    const p = path.join(process.cwd(), "public", "data", file);
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default async function Page() {
  const data = await loadJson<ForecastDocument>("forecast.json");
  const evalData = await loadJson<EvalDocument>("eval.json");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">空气质量概率预报</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          基于 Open-Meteo Air Quality 点预测，通过本地蒙特卡洛合成集合得到概率分布。
          <span className="ml-1 text-zinc-500">概率为统计估计，仅供参考。</span>
        </p>
      </header>

      {data ? (
        <>
          <Dashboard data={data} />
          {evalData && <EvalSummary data={evalData} />}
          <footer className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <DataFreshness generatedAt={data.generated_at} methodVersion={data.method_version} />
          </footer>
        </>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
          尚未生成数据。请先在项目根目录运行：
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-800/50">
            node scripts/generate-forecast.mjs
          </code>
        </div>
      )}
    </main>
  );
}
