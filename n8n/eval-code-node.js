// n8n Code 节点：每日评估 forecasts 与 Open-Meteo reanalysis 的吻合度。
// 拷贝到 n8n 第二个工作流的 Code 节点 (mode: "Run Once for All Items", language: JavaScript)。
//
// 前置：与 forecast 工作流同样的 PAT。本文件留占位 $vars.GITHUB_TOKEN；
// 真正能跑的版本在 eval-code-node.local.js（gitignored）。

const helpers = this.helpers;

async function fetch(url, options = {}) {
  const res = await helpers.httpRequest({
    url,
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
  });
  const bodyStr =
    typeof res.body === "string" ? res.body : res.body == null ? "" : JSON.stringify(res.body);
  return {
    ok: res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    text: async () => bodyStr,
    json: async () =>
      typeof res.body === "object" && res.body !== null ? res.body : JSON.parse(bodyStr),
  };
}

const OWNER = "weiweicf66-cmd";
const REPO = "aq-forecast";
const BRANCH = "main";
const TOKEN = $vars.GITHUB_TOKEN;
const EVAL_WINDOW_DAYS = 14;

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

function ghHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function listForecastCommits(limit) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=public/data/forecast.json&per_page=${limit}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub commits API ${res.status}`);
  return res.json();
}

async function getForecastAtCommit(sha) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/public/data/forecast.json?ref=${sha}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub contents API ${res.status} (sha=${sha})`);
  const meta = await res.json();
  const decoded = Buffer.from(meta.content, "base64").toString("utf8");
  return JSON.parse(decoded);
}

async function fetchObservations(city) {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}` +
    `&hourly=pm2_5&past_days=14&forecast_days=1&timezone=Asia%2FShanghai`;
  const res = await fetch(url, { headers: { "User-Agent": "aq-forecast-eval-n8n/0.1" } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${city.id}`);
  const data = await res.json();
  const times = data?.hourly?.time ?? [];
  const values = data?.hourly?.pm2_5 ?? [];
  const byDate = new Map();
  for (let i = 0; i < times.length; i++) {
    const d = times[i].slice(0, 10);
    const v = values[i];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(v);
  }
  const result = {};
  for (const [d, arr] of byDate.entries()) {
    if (arr.length >= 12) result[d] = arr.reduce((s, x) => s + x, 0) / arr.length;
  }
  return result;
}

function brierContribution(predictedProbs, actualCategory) {
  let s = 0;
  for (const c of CATEGORIES) {
    const p = predictedProbs[c] ?? 0;
    const obs = c === actualCategory ? 1 : 0;
    s += (p - obs) ** 2;
  }
  return s;
}

function dayDiff(later, earlier) {
  return Math.round(
    (new Date(later + "T00:00:00Z") - new Date(earlier + "T00:00:00Z")) / (1000 * 60 * 60 * 24),
  );
}

async function commitEvalToGitHub(content) {
  const path = "public/data/eval.json";
  let sha;
  const getRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: ghHeaders() },
  );
  if (getRes.ok) sha = (await getRes.json()).sha;
  else if (getRes.status !== 404) throw new Error(`GitHub GET ${getRes.status}`);

  const body = {
    message: `chore(eval): daily evaluation ${new Date().toISOString().slice(0, 10)}`,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };
  const putRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) },
  );
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(`GitHub PUT ${putRes.status}: ${txt}`);
  }
  return await putRes.json();
}

// === n8n entrypoint ===
const today = new Date().toISOString().slice(0, 10);

const commits = await listForecastCommits(EVAL_WINDOW_DAYS);
const forecasts = [];
for (const c of commits) {
  try {
    const forecast = await getForecastAtCommit(c.sha);
    forecasts.push({ commitDate: c.commit.committer.date.slice(0, 10), sha: c.sha.slice(0, 7), forecast });
  } catch (e) {
    // skip bad commit
  }
}

const observations = {};
for (const city of CITIES) {
  try {
    observations[city.id] = await fetchObservations(city);
  } catch (e) {
    observations[city.id] = {};
  }
}

const pairs = [];
for (const { commitDate, forecast } of forecasts) {
  for (const [cityId, cityForecast] of Object.entries(forecast.cities ?? {})) {
    const cityObs = observations[cityId];
    if (!cityObs) continue;
    for (const day of cityForecast.days ?? []) {
      if (!day.date || day.date >= today) continue;
      const observedPm25 = cityObs[day.date];
      if (typeof observedPm25 !== "number") continue;
      const observedCat = pm25ToCategory(observedPm25);
      const leadDay = dayDiff(day.date, commitDate);
      if (leadDay < 0 || leadDay > 6) continue;
      pairs.push({
        cityId,
        leadDay,
        predictedProbs: day.categories,
        predictedDominant: day.dominant,
        observedCat,
      });
    }
  }
}

const cityMetrics = {};
for (const city of CITIES) {
  const cp = pairs.filter((p) => p.cityId === city.id);
  if (cp.length === 0) { cityMetrics[city.id] = { name: city.name, n_pairs: 0 }; continue; }
  const briers = cp.map((p) => brierContribution(p.predictedProbs, p.observedCat));
  const accs = cp.map((p) => (p.predictedDominant === p.observedCat ? 1 : 0));
  const meanBrier = briers.reduce((s, x) => s + x, 0) / briers.length;
  const accuracy = accs.reduce((s, x) => s + x, 0) / accs.length;
  const leadDays = [...new Set(cp.map((p) => p.leadDay))].sort((a, b) => a - b);
  const byLeadDay = leadDays.map((ld) => {
    const lp = cp.filter((p) => p.leadDay === ld);
    const lb = lp.map((p) => brierContribution(p.predictedProbs, p.observedCat));
    const la = lp.map((p) => (p.predictedDominant === p.observedCat ? 1 : 0));
    return {
      lead_day: ld,
      n: lp.length,
      brier: +(lb.reduce((s, x) => s + x, 0) / lb.length).toFixed(3),
      accuracy: +(la.reduce((s, x) => s + x, 0) / la.length).toFixed(3),
    };
  });
  cityMetrics[city.id] = {
    name: city.name,
    n_pairs: cp.length,
    brier_score: +meanBrier.toFixed(3),
    categorical_accuracy: +accuracy.toFixed(3),
    by_lead_day: byLeadDay,
  };
}

let overall = { n_pairs: 0, brier_score: null, categorical_accuracy: null };
if (pairs.length > 0) {
  const allBriers = pairs.map((p) => brierContribution(p.predictedProbs, p.observedCat));
  const allAccs = pairs.map((p) => (p.predictedDominant === p.observedCat ? 1 : 0));
  overall = {
    n_pairs: pairs.length,
    brier_score: +(allBriers.reduce((s, x) => s + x, 0) / allBriers.length).toFixed(3),
    categorical_accuracy: +(allAccs.reduce((s, x) => s + x, 0) / allAccs.length).toFixed(3),
  };
}

const doc = {
  generated_at: new Date().toISOString(),
  evaluation_window_days: EVAL_WINDOW_DAYS,
  ground_truth_source: "open-meteo reanalysis (past_days)",
  today,
  overall,
  city_metrics: cityMetrics,
};

const result = await commitEvalToGitHub(JSON.stringify(doc, null, 2));
return [
  {
    json: {
      ok: true,
      generated_at: doc.generated_at,
      n_pairs: overall.n_pairs,
      brier_score: overall.brier_score,
      categorical_accuracy: overall.categorical_accuracy,
      commit_url: result.commit?.html_url,
    },
  },
];
