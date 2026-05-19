// 这个文件是 n8n Code 节点的代码源（也作为 PR review 用的版本控制副本）。
// 拷贝整段到 n8n 的 "Code" 节点 (mode: "Run Once for All Items", language: JavaScript)。
//
// 前置：在工作流变量里设置：
//   GITHUB_TOKEN  = fine-grained PAT (Contents: read/write, 仅 aq-forecast 仓库)
//   GITHUB_OWNER  = "weiweicf66-cmd"
//   GITHUB_REPO   = "aq-forecast"
//   GITHUB_BRANCH = "main"
// n8n 用 $env 读取系统环境变量；用 $vars 读取 workflow variables（在 Settings 里设）。

const CITIES = [
  { id: "beijing",   name: "北京", lat: 39.9042, lon: 116.4074 },
  { id: "shanghai",  name: "上海", lat: 31.2304, lon: 121.4737 },
  { id: "guangzhou", name: "广州", lat: 23.1291, lon: 113.2644 },
  { id: "shenzhen",  name: "深圳", lat: 22.5431, lon: 114.0579 },
  { id: "chengdu",   name: "成都", lat: 30.5728, lon: 104.0668 },
  { id: "xian",      name: "西安", lat: 34.3416, lon: 108.9398 },
];

const PM25_BREAKS = [
  { high: 35,  cat: "优" },
  { high: 75,  cat: "良" },
  { high: 115, cat: "轻度污染" },
  { high: 150, cat: "中度污染" },
  { high: 250, cat: "重度污染" },
  { high: Infinity, cat: "严重污染" },
];
const CATEGORIES = ["优", "良", "轻度污染", "中度污染", "重度污染", "严重污染"];

const pm25ToCategory = (v) => {
  for (const b of PM25_BREAKS) if (v <= b.high) return b.cat;
  return "严重污染";
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function* gaussianStream(seed) {
  const rand = mulberry32(seed);
  while (true) {
    let u1 = rand(), u2 = rand();
    if (u1 < 1e-12) u1 = 1e-12;
    const mag = Math.sqrt(-2 * Math.log(u1));
    yield mag * Math.cos(2 * Math.PI * u2);
    yield mag * Math.sin(2 * Math.PI * u2);
  }
}

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

function probabilizeDay({ mean, leadDay, seed, samples = 1000 }) {
  const sigma = Math.max(8, mean * 0.20 * (1 + leadDay * 0.15));
  const gen = gaussianStream(seed);
  const buckets = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  const draws = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const z = gen.next().value;
    const v = Math.max(0, mean + sigma * z);
    draws[i] = v;
    buckets[pm25ToCategory(v)] += 1;
  }
  draws.sort((a, b) => a - b);
  const probs = Object.fromEntries(CATEGORIES.map(c => [c, +(buckets[c] / samples).toFixed(3)]));
  let dominant = CATEGORIES[0];
  for (const c of CATEGORIES) if (probs[c] > probs[dominant]) dominant = c;
  return {
    pm25_p10: Math.round(quantile(draws, 0.1)),
    pm25_p50: Math.round(quantile(draws, 0.5)),
    pm25_p90: Math.round(quantile(draws, 0.9)),
    categories: probs,
    dominant,
  };
}

async function fetchCity(c) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&hourly=pm2_5&forecast_days=7&timezone=Asia%2FShanghai`;
  const res = await fetch(url, { headers: { "User-Agent": "aq-forecast-n8n/0.1" } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${c.id}`);
  return res.json();
}

function dailyMeans(payload) {
  const times = payload?.hourly?.time ?? [];
  const values = payload?.hourly?.pm2_5 ?? [];
  const byDate = new Map();
  for (let i = 0; i < times.length; i++) {
    const d = times[i].slice(0, 10);
    const v = values[i];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(v);
  }
  return [...byDate.entries()]
    .map(([date, arr]) => ({ date, mean: arr.reduce((s, x) => s + x, 0) / arr.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function buildForecast() {
  const cities = {};
  for (const c of CITIES) {
    try {
      const payload = await fetchCity(c);
      const dailies = dailyMeans(payload).slice(0, 7);
      const seedBase = [...c.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
      cities[c.id] = {
        name: c.name,
        days: dailies.map((d, i) => ({
          date: d.date,
          ...probabilizeDay({ mean: d.mean, leadDay: i, seed: seedBase + i }),
        })),
      };
    } catch (e) {
      cities[c.id] = { name: c.name, days: [], error: String(e.message || e) };
    }
  }
  return {
    generated_at: new Date().toISOString(),
    method_version: "v1-synthetic-ensemble",
    horizon_days: 7,
    cities,
  };
}

async function commitToGitHub(content) {
  const owner = $vars.GITHUB_OWNER;
  const repo = $vars.GITHUB_REPO;
  const branch = $vars.GITHUB_BRANCH || "main";
  const token = $vars.GITHUB_TOKEN;
  const path = "public/data/forecast.json";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // 1) 先取当前 sha（如果文件已存在）
  let sha;
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers },
  );
  if (getRes.ok) sha = (await getRes.json()).sha;
  else if (getRes.status !== 404) throw new Error(`GitHub GET ${getRes.status}`);

  // 2) PUT 新内容
  const body = {
    message: `chore(data): daily forecast ${new Date().toISOString().slice(0, 10)}`,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  };
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { method: "PUT", headers, body: JSON.stringify(body) },
  );
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`GitHub PUT ${putRes.status}: ${txt}`);
  }
  return await putRes.json();
}

// === n8n entrypoint ===
const forecast = await buildForecast();
const content = JSON.stringify(forecast, null, 2);
const result = await commitToGitHub(content);
return [
  {
    json: {
      ok: true,
      generated_at: forecast.generated_at,
      cities_with_data: Object.entries(forecast.cities).filter(([, c]) => c.days.length).length,
      cities_failed: Object.entries(forecast.cities).filter(([, c]) => !c.days.length).map(([id]) => id),
      commit_sha: result.commit?.sha,
      commit_url: result.commit?.html_url,
    },
  },
];
