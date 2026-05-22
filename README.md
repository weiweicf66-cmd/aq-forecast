# 空气质量概率预报

未来 6-7 天每日 AQI 概率分布的中文 Web 应用。基于 [Open-Meteo Air Quality](https://open-meteo.com/) 点预测 + 本地蒙特卡洛合成集合 + 滚动评估。

## 架构

```
工作流 1（n8n 本地 Docker，每日 07:00）：
  Open-Meteo → 蒙特卡洛概率化 → commit forecast.json → GitHub → Vercel

工作流 2（每日 07:30）：
  GitHub 14 天 commit 历史 + Open-Meteo 实测 → Brier + 准确率
  → commit eval.json → GitHub → Vercel
```

前端是纯静态 Next.js，读 JSON 渲染，无服务端依赖，零运行成本。

## 本地开发

```bash
npm install

# 拷贝环境变量模板，填上你的 GitHub PAT
cp .env.example .env.local
# 编辑 .env.local

npm run forecast      # 生成 public/data/forecast.json
npm run evaluate      # 生成 public/data/eval.json（用 GITHUB_TOKEN 鉴权调 API）
npm run build:n8n     # 从 n8n/*.js 模板 + .env.local 生成 n8n/*.local.js
npm run dev           # http://localhost:3000
```

## 密钥管理

- **`.env.local`**（gitignore 屏蔽）：唯一存放 GitHub PAT 的地方
- **`n8n/code-node.js`、`n8n/eval-code-node.js`**：算法权威源，含 `$vars.GITHUB_TOKEN` 等占位，无密钥
- **`n8n/*.local.js`**（gitignore 屏蔽，自动生成）：由 `npm run build:n8n` 从模板 + `.env.local` 生成，含 PAT 的最终版，**用于粘贴到 n8n Code 节点**

**轮换 PAT**：编辑 `.env.local` → `npm run build:n8n` → 把新的 `.local.js` 粘进 n8n 替换。
**改算法**：编辑 `n8n/code-node.js` 或 `eval-code-node.js` → `npm run build:n8n` → 重新粘贴。

## 项目结构

| 路径 | 说明 |
| --- | --- |
| `app/` | Next.js App Router 页面与布局 |
| `components/` | UI 组件（CitySelector / WeekHeatmap / DailyProbabilityCard / EvalSummary …） |
| `lib/` | AQI 分级、城市列表、类型、配色 |
| `scripts/generate-forecast.mjs` | 本地一次性生成 forecast.json |
| `scripts/evaluate-forecasts.mjs` | 本地一次性生成 eval.json |
| `scripts/build-n8n-code.mjs` | 从 `n8n/*.js` + `.env.local` 生成 `n8n/*.local.js` |
| `n8n/code-node.js`, `eval-code-node.js` | n8n Code 节点模板（含 `$vars.X` 占位） |
| `n8n/workflow.json`, `eval-workflow.json` | 两个 n8n 工作流骨架 |
| `public/data/forecast.json`, `eval.json` | 数据产出物 + 前端数据源 |
| `docs/` | n8n / Vercel / 方法学 / 评估方法 |

## 部署链路

1. 在 GitHub 创建空仓库 `weiweicf66-cmd/aq-forecast`（不勾 README）
2. 本地：
   ```bash
   git remote add origin https://github.com/weiweicf66-cmd/aq-forecast.git
   git push -u origin main
   ```
3. 在 https://vercel.com/new 导入这个仓库（详见 [docs/vercel-setup.md](docs/vercel-setup.md)）
4. 配置 n8n 两个工作流（详见 [docs/n8n-setup.md](docs/n8n-setup.md) 和 [docs/eval-methodology.md](docs/eval-methodology.md)）

## 数据可信度

「概率」是基于点预测合成的，**不是真实集合预报**；评估的"实测"用 CAMS reanalysis，**非真实地面观测**。详见 [docs/probabilistic-method.md](docs/probabilistic-method.md) 和 [docs/eval-methodology.md](docs/eval-methodology.md)。UI 已标注「仅供参考」。

## License

MIT
