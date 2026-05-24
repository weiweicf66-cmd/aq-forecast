#!/usr/bin/env node
// 拉 Open-Meteo Air Quality → 蒙特卡洛合成集合 → public/data/forecast.json
// 本脚本与 n8n/code-node.js 共享同一份概率化算法，便于本地验证。

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 城市列表唯一源：lib/cities.json。n8n 端通过 npm run build:n8n 同步注入。
const here = path.dirname(fileURLToPath(import.meta.url));
const CITIES = JSON.parse(await readFile(path.join(here, "../lib/cities.json"), "utf8"));

// PM2.5 (µg/m³ 24h) → 中国 AQI 等级
const PM25_BREAKS = [
  { high: 35,  cat: "优" },
  { high: 75,  cat: "良" },
  { high: 115, cat: "轻度污染" },
  { high: 150, cat: "中度污染" },
  { high: 250, cat: "重度污染" },
  { high: Infinity, cat: "严重污染" },
];
const CATEGORIES = ["优", "良", "轻度污染", "中度污染", "重度污染", "严重污染"];

function pm25ToCategory(v) {
  for (const b of PM25_BREAKS) if (v <= b.high) return b.cat;
  return "严重污染";
}

// mulberry32 PRNG（32 位整数算术，JS 安全；通过 Math.imul 避免 53 位浮点精度损失）
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

// Box-Muller 一次产 2 个独立标准正态
function* gaussianStream(seed = 1) {
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

function probabilizeDay({ mean, leadDay, samples = 1000, seed }) {
  const baseRel = 0.20;                            // 相对标准差基线 ~20%
  const sigma = Math.max(8, mean * baseRel * (1 + leadDay * 0.15));
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
  // 用最大概率类别为 dominant；同概率时按 CATEGORIES 顺序优先
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

async function fetchCity(city) {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(city.lat));
  url.searchParams.set("longitude", String(city.lon));
  url.searchParams.set("hourly", "pm2_5");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "Asia/Shanghai");
  const res = await fetch(url, { headers: { "User-Agent": "aq-forecast/0.1" } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${city.id}`);
  return res.json();
}

function dailyMeans(payload) {
  const times = payload?.hourly?.time ?? [];
  const values = payload?.hourly?.pm2_5 ?? [];
  const byDate = new Map();
  for (let i = 0; i < times.length; i++) {
    const date = times[i].slice(0, 10);
    const v = values[i];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(v);
  }
  return [...byDate.entries()]
    .map(([date, arr]) => ({ date, mean: arr.reduce((s, x) => s + x, 0) / arr.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function buildForecast() {
  const cities = {};
  for (const c of CITIES) {
    process.stdout.write(`  - 拉取 ${c.name}... `);
    try {
      const payload = await fetchCity(c);
      const dailies = dailyMeans(payload).slice(0, 7);
      const seedBase = [...c.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
      const days = dailies.map((d, i) => ({
        date: d.date,
        ...probabilizeDay({ mean: d.mean, leadDay: i, seed: seedBase + i }),
      }));
      cities[c.id] = { name: c.name, days };
      console.log(`✓ ${days.length} 天`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
      cities[c.id] = { name: c.name, days: [] };
    }
  }
  return {
    generated_at: new Date().toISOString(),
    method_version: "v1-synthetic-ensemble",
    horizon_days: 7,
    cities,
  };
}

async function main() {
  console.log("生成空气质量概率预报...");
  const doc = await buildForecast();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = path.resolve(here, "..", "public", "data", "forecast.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(doc, null, 2), "utf8");
  console.log(`写入 ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
