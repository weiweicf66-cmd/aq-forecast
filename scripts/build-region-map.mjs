#!/usr/bin/env node
// 下载行政区 GeoJSON，合并成 public/geo/regions.json
// 我们关心 4 个省的地级市级粒度（河北/江苏/浙江/广东），其他保留省级。
//
// 用法： node scripts/build-region-map.mjs

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const cacheDir = path.join(root, "public", "geo", "_cache");
const outFile = path.join(root, "public", "geo", "regions.json");

// 想要替换为地级市粒度的省（adcode → 省 GeoJSON 路径）
const PREFECTURE_PROVINCES = {
  130000: "河北省",
  320000: "江苏省",
  330000: "浙江省",
  440000: "广东省",
};

async function download(adcode, full = true) {
  const suffix = full ? "_full" : "";
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}${suffix}.json`;
  const cachePath = path.join(cacheDir, `${adcode}${suffix}.json`);
  try {
    const cached = await readFile(cachePath, "utf8");
    return JSON.parse(cached);
  } catch {}
  console.log(`  下载 ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${adcode}`);
  const text = await res.text();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, text, "utf8");
  return JSON.parse(text);
}

async function main() {
  console.log("加载全国省级地图...");
  const country = await download(100000, true);
  console.log(`  全国 ${country.features.length} 个省级行政区`);

  console.log("加载地级市粒度的省...");
  const prefectureMaps = {};
  for (const [adcode, name] of Object.entries(PREFECTURE_PROVINCES)) {
    const data = await download(adcode, true);
    prefectureMaps[name] = data.features;
    console.log(`  ${name}: ${data.features.length} 个地级市`);
  }

  // 合并：替换 4 个省的 feature 为它们的地级市 features
  const replacedNames = new Set(Object.values(PREFECTURE_PROVINCES));
  const mergedFeatures = [];
  for (const feature of country.features) {
    const name = feature.properties?.name;
    if (name && replacedNames.has(name)) {
      mergedFeatures.push(...prefectureMaps[name]);
    } else {
      mergedFeatures.push(feature);
    }
  }

  const merged = {
    type: "FeatureCollection",
    features: mergedFeatures,
  };

  await writeFile(outFile, JSON.stringify(merged), "utf8");
  const size = (JSON.stringify(merged).length / 1024).toFixed(0);
  console.log(`写入 ${outFile} (${size} KB, ${mergedFeatures.length} features)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
