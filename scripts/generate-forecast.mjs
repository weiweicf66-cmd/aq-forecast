#!/usr/bin/env node
// 拉 Open-Meteo Air Quality → 蒙特卡洛合成集合 → public/data/forecast.json
// 本脚本与 n8n/code-node.js 共享同一份概率化算法，便于本地验证。

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 注意：城市列表必须与 lib/cities.ts / n8n/code-node.js / n8n/eval-code-node.js 保持同步
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
