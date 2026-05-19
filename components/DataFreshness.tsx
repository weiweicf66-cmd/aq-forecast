export function DataFreshness({ generatedAt, methodVersion }: { generatedAt: string; methodVersion: string }) {
  const dt = new Date(generatedAt);
  const fmt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
  return (
    <div className="text-xs text-zinc-500 dark:text-zinc-400">
      数据生成于 {fmt} · 方法 {methodVersion}
    </div>
  );
}
