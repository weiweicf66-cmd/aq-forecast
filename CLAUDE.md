# 空气质量概率预报 — 项目记忆

中文 Web 应用：未来 6-7 天每日 AQI 概率预报。给未来 Claude 会话快速建立上下文。

## Stack
- **前端**: Next.js 16.2.6 (App Router) + TypeScript + Tailwind v4
- **数据源**: Open-Meteo Air Quality（免 key，PM2.5 hourly，实际可用窗口 5-6 天）
- **编排**: 本地 n8n（Docker）每日 07:00 Asia/Shanghai cron
- **部署**: Vercel + GitHub main 分支自动构建
- **Repo**: https://github.com/weiweicf66-cmd/aq-forecast
- **生产 URL**: https://aq-forecast.vercel.app/

## 数据流
```
n8n (Schedule + Code) → Open-Meteo fetch → 蒙特卡洛合成集合 (1000 samples)
  → public/data/forecast.json (PUT via GitHub Contents API)
  → Vercel webhook 自动 next build
```

前端纯静态读 `public/data/forecast.json`，无 API Route、无运行时依赖。

## 本地开发
- `npm run dev` → http://localhost:3000
- `node scripts/generate-forecast.mjs` 不经 n8n 重新生成数据（与 n8n 共享同一份算法）
- n8n 启动：`docker start n8n` 后访问 http://localhost:5678

## 重要决策记录

- **「概率」是合成的，不是真实集合预报**。Open-Meteo 只给确定性点预测，我们在本地用高斯扰动 + 蒙特卡洛伪造集合。UI 上标注「仅供参考」，详见 docs/probabilistic-method.md。
- **σ 公式**：`max(8, mean * 0.20 * (1 + leadDay * 0.15))`。20% 基础相对误差，每延后一天扩大 15%。
- **PRNG 用 mulberry32**，不用简单 LCG，避免 JS 53 位浮点精度损失。
- **AQI 分级**用中国 GB 3095-2012 六级，PM2.5 24h 均值断点（35/75/115/150/250）。
- **数据 horizon 是 6 天而不是 7 天**：Open-Meteo 的 PM2.5 第 7 天通常全 null。UI 用 `days.length` 动态渲染。
- **算法的版本权威源是 `scripts/generate-forecast.mjs`**；n8n/code-node.js 是它的镜像（手动同步）。
- **n8n Code 节点沙箱限制**：不暴露 `fetch`，`require('https')` 被禁。HTTP 调用必须用 `this.helpers.httpRequest`。n8n/code-node.js 顶部已写好兼容层（探测过 `typeof this.helpers.httpRequest === "function"`）。
- **n8n 本地编排环境强依赖代理**：用户网络拉 Docker Hub 不稳，最终是用 Clash TUN 模式接管 WSL2 流量才拉下 n8n 镜像。详情见 docs/n8n-setup.md。

## 关键文件
- [lib/aqi.ts](lib/aqi.ts) — PM2.5 → AQI 等级映射（纯函数）
- [scripts/generate-forecast.mjs](scripts/generate-forecast.mjs) — 本地一次性生成（无 n8n 也能用）
- [n8n/code-node.js](n8n/code-node.js) — n8n Code 节点完整源码（注意保持与上面同步）
- [n8n/workflow.json](n8n/workflow.json) — n8n 工作流骨架（Code 节点 jsCode 需手动粘贴）
- [components/Dashboard.tsx](components/Dashboard.tsx) — 主交互（城市切换 + 渲染）
- [public/data/forecast.json](public/data/forecast.json) — n8n 产出物，前端唯一数据源

## 用户偏好
- UI 是中文消费者向，避免统计学行话。例如 P10/P50/P90 改为「区间 X–Y，最可能 Z」并加 hover tooltip。

## TODO / 已知 risk
- [ ] **GitHub MCP** 还没接入。用户需要在 Claude Code 里 `claude mcp add github` 后告知，Claude 才能代提 commit。当前用 git CLI。
- [ ] **滚动残差替代固定 σ**：累积 30 天 (pred, obs) 后切到数据驱动 σ
- [ ] **加 O3 / NO2** 维度
- [ ] **Open-Meteo 中国大陆访问稳定性**：偶发延迟/限流。n8n Code 节点目前没加重试，必要时加 3 次重试 + 30s 超时
- [x] ~~首次推 GitHub~~（已完成）
- [x] ~~Vercel 部署~~（已完成，URL 见上）
- [x] ~~n8n 工作流配置~~（已完成 2026-05-22，首条自动 commit 39009d3）
- [ ] 用户需在 n8n 编辑器右上角把工作流切到 **Active**，每日 07:00 才会自动跑
- [ ] 用户需轮换 GitHub PAT（之前的 token 在聊天里漏过），新 token 替换到 [n8n/code-node.local.js](n8n/code-node.local.js)
