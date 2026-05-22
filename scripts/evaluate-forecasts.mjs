#!/usr/bin/env node
// 评估过去 forecasts 与 Open-Meteo reanalysis 的吻合度
// 输出 public/data/eval.json：Brier score、分类准确率、按 lead day 拆分
//
// 数据流：
//   1. 从 GitHub Contents API 拿过去 N 天的 forecast.json 历史版本
//   2. 从 Open-Meteo past_days 拿过去 7 天的实测 PM2.5 (CAMS reanalysis)
//   3. 把每个 (commit_date, predicted_day) 配对，predicted_day < today 才可评估
//   4. 计算 Brier score 和分类准确率，按城市 + 按 lead day 拆分

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OWNER = "weiweicf66-cmd";
const REPO = "aq-forecast";
const BRANCH = "main";
const TOKEN = process.env.GITHUB_TOKEN || "";
const EVAL_WINDOW_DAYS = 14;

const CITIES = [
  { id: "beijing",      name: "北京",   lat: 39.9042, lon: 116.4074 },
  { id: "tianjin",      name: "天津",   lat: 39.0851, lon: 117.1995 },
  { id: "shijiazhuang", name: "石家庄", lat: 38.0428, lon: 114.5149 },
  { id: "tangshan",     name: "唐山",   lat: 39.6320, lon: 118.1804 },
  { id: "qinhuangdao",  name: "秦皇岛", lat: 39.9354, lon: 119.6004 },
  { id: "handan",       name: "邯郸",   lat: 36.6256, lon: 114.5391 },
  { id: "xingtai",      name: "邢台",   lat: 37.0682, lon: 114.5048 },
  { id: "baoding",      name: "保定",   lat: 38.8748, lon: 115.4646 },
  { id: "zhangjiakou",  name: "张家口", lat: 40.8242, lon: 114.9087 },
  { id: "chengde",      name: "承德",   lat: 40.9758, lon: 117.9382 },
  { id: "cangzhou",     name: "沧州",   lat: 38.3045, lon: 116.8388 },
  { id: "langfang",     name: "廊坊",   lat: 39.5188, lon: 116.7035 },
  { id: "hengshui",     name: "衡水",   lat: 37.7349, lon: 115.6705 },
  { id: "shanghai",     name: "上海",   lat: 31.2304, lon: 121.4737 },
  { id: "nanjing",      name: "南京",   lat: 32.0617, lon: 118.7778 },
  { id: "suzhou",       name: "苏州",   lat: 31.2989, lon: 120.5853 },
  { id: "hangzhou",     name: "杭州",   lat: 30.2741, lon: 120.1551 },
  { id: "guangzhou",    name: "广州",   lat: 23.1291, lon: 113.2644 },
  { id: "shenzhen",     name: "深圳",   lat: 22.5431, lon: 114.0579 },
  { id: "dongguan",     name: "东莞",   lat: 23.0207, lon: 113.7517 },
  { id: "chengdu",      name: "成都",   lat: 30.5728, lon: 104.0668 },
  { id: "xian",         name: "西安",   lat: 34.3416, lon: 108.9398 },
  { id: "wuhan",        name: "武汉",   lat: 30.5928, lon: 114.3055 },
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
  const h = { Accept: "application/vnd.github+json" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
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
  const res = await fetch(url, { headers: { "User-Agent": "aq-forecast-eval/0.1" } });
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
  return Math.round((new Date(later + "T00:00:00Z") - new Date(earlier + "T00:00:00Z")) / (1000 * 60 * 60 * 24));
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`今天: ${today}, 窗口: 过去 ${EVAL_WINDOW_DAYS} 天`);

  console.log("拉取 forecast.json 的历史 commits...");
  const commits = await listForecastCommits(EVAL_WINDOW_DAYS);
  console.log(`  找到 ${commits.length} 个 commit`);

  console.log("加载每个 commit 的 forecast 内容...");
  const forecasts = [];
  for (const c of commits) {
    try {
      const forecast = await getForecastAtCommit(c.sha);
      const commitDate = c.commit.committer.date.slice(0, 10);
      forecasts.push({ commitDate, sha: c.sha.slice(0, 7), forecast });
    } catch (e) {
      console.warn(`  跳过 ${c.sha.slice(0, 7)}: ${e.message}`);
    }
  }
  console.log(`  加载 ${forecasts.length} 份历史 forecast`);

  console.log("拉取各城市过去实测...");
  const observations = {};
  for (const city of CITIES) {
    try {
      observations[city.id] = await fetchObservations(city);
      const days = Object.keys(observations[city.id]).length;
      console.log(`  ${city.name}: ${days} 天实测数据`);
    } catch (e) {
      console.warn(`  ${city.name} 失败: ${e.message}`);
      observations[city.id] = {};
    }
  }

  console.log("配对预测与实测...");
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
          predictedDay: day.date,
          leadDay,
          predictedProbs: day.categories,
          predictedDominant: day.dominant,
          observedPm25: +observedPm25.toFixed(1),
          observedCat,
        });
      }
    }
  }
  console.log(`  共 ${pairs.length} 个可评估配对`);

  const cityMetrics = {};
  for (const city of CITIES) {
    const cityPairs = pairs.filter((p) => p.cityId === city.id);
    if (cityPairs.length === 0) {
      cityMetrics[city.id] = { name: city.name, n_pairs: 0 };
      continue;
    }
    const briers = cityPairs.map((p) => brierContribution(p.predictedProbs, p.observedCat));
    const accs = cityPairs.map((p) => (p.predictedDominant === p.observedCat ? 1 : 0));
    const meanBrier = briers.reduce((s, x) => s + x, 0) / briers.length;
    const accuracy = accs.reduce((s, x) => s + x, 0) / accs.length;

    const leadDays = [...new Set(cityPairs.map((p) => p.leadDay))].sort((a, b) => a - b);
    const byLeadDay = leadDays.map((ld) => {
      const ldPairs = cityPairs.filter((p) => p.leadDay === ld);
      const ldBriers = ldPairs.map((p) => brierContribution(p.predictedProbs, p.observedCat));
      const ldAccs = ldPairs.map((p) => (p.predictedDominant === p.observedCat ? 1 : 0));
      return {
        lead_day: ld,
        n: ldPairs.length,
        brier: +(ldBriers.reduce((s, x) => s + x, 0) / ldBriers.length).toFixed(3),
        accuracy: +(ldAccs.reduce((s, x) => s + x, 0) / ldAccs.length).toFixed(3),
      };
    });

    cityMetrics[city.id] = {
      name: city.name,
      n_pairs: cityPairs.length,
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

  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = path.resolve(here, "..", "public", "data", "eval.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(doc, null, 2), "utf8");
  console.log(`写入 ${out}`);
  console.log(`总体: ${overall.n_pairs} 对, Brier=${overall.brier_score}, Acc=${overall.categorical_accuracy}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
