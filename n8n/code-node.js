// n8n Code 节点：每日拉 Open-Meteo + 蒙特卡洛概率化 + 提交 forecast.json 到 GitHub。
//
// 本文件是模板：含 n8n 变量占位（参考 .env.example），无密钥，可 commit。
// 实际粘贴到 n8n 的版本是 code-node.local.js（gitignored，由 npm run build:n8n 生成）。

// n8n Code 节点沙箱：用 this.helpers.httpRequest 实现 fetch 兼容层
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
    typeof res.body === "string"
      ? res.body
      : res.body == null
        ? ""
        : JSON.stringify(res.body);
  return {
    ok: res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    text: async () => bodyStr,
    json: async () =>
      typeof res.body === "object" && res.body !== null
        ? res.body
        : JSON.parse(bodyStr),
  };
}

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
  { id: "taiyuan",      name: "太原",   lat: 37.8706, lon: 112.5489 },
  { id: "datong",       name: "大同",   lat: 40.0768, lon: 113.3001 },
  { id: "yangquan",     name: "阳泉",   lat: 37.8574, lon: 113.5817 },
  { id: "changzhi",     name: "长治",   lat: 36.1955, lon: 113.1163 },
  { id: "jincheng",     name: "晋城",   lat: 35.4910, lon: 112.8513 },
  { id: "shuozhou",     name: "朔州",   lat: 39.3315, lon: 112.4329 },
  { id: "jinzhong",     name: "晋中",   lat: 37.6873, lon: 112.7528 },
  { id: "yuncheng",     name: "运城",   lat: 35.0263, lon: 111.0067 },
  { id: "xinzhou",      name: "忻州",   lat: 38.4163, lon: 112.7344 },
  { id: "linfen",       name: "临汾",   lat: 36.0883, lon: 111.5190 },
  { id: "lvliang",      name: "吕梁",   lat: 37.5191, lon: 111.1442 },
  { id: "jinan",        name: "济南",   lat: 36.6512, lon: 117.1201 },
  { id: "zibo",         name: "淄博",   lat: 36.8136, lon: 118.0548 },
  { id: "zaozhuang",    name: "枣庄",   lat: 34.8107, lon: 117.3236 },
  { id: "jining",       name: "济宁",   lat: 35.4150, lon: 116.5871 },
  { id: "taian",        name: "泰安",   lat: 36.1944, lon: 117.0879 },
  { id: "liaocheng",    name: "聊城",   lat: 36.4565, lon: 115.9854 },
  { id: "dezhou",       name: "德州",   lat: 37.4346, lon: 116.3578 },
  { id: "binzhou",      name: "滨州",   lat: 37.3866, lon: 117.9707 },
  { id: "zhengzhou",    name: "郑州",   lat: 34.7466, lon: 113.6253 },
  { id: "kaifeng",      name: "开封",   lat: 34.7986, lon: 114.3074 },
  { id: "anyang",       name: "安阳",   lat: 36.0991, lon: 114.3931 },
  { id: "hebi",         name: "鹤壁",   lat: 35.7474, lon: 114.2954 },
  { id: "xinxiang",     name: "新乡",   lat: 35.3030, lon: 113.9268 },
  { id: "jiaozuo",      name: "焦作",   lat: 35.2159, lon: 113.2418 },
  { id: "puyang",       name: "濮阳",   lat: 35.7681, lon: 115.0292 },
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
