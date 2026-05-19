# 空气质量概率预报

未来 6-7 天每日 AQI 概率分布的中文 Web 应用。基于 [Open-Meteo Air Quality](https://open-meteo.com/) 点预测 + 本地蒙特卡洛合成集合。

## 架构

```
n8n（本地 Docker，每日 07:00）→ Open-Meteo 拉数据 → 蒙特卡洛概率化
  → commit public/data/forecast.json → GitHub
  → Vercel 自动构建部署
```

前端是纯静态 Next.js，读 JSON 渲染，无服务端依赖，零运行成本。

## 本地开发

```bash
npm install
node scripts/generate-forecast.mjs   # 拉 6 个城市的数据，生成 public/data/forecast.json
npm run dev                          # http://localhost:3000
```

## 项目结构

| 路径 | 说明 |
| --- | --- |
| `app/` | Next.js App Router 页面与布局 |
| `components/` | UI 组件（CitySelector / WeekHeatmap / DailyProbabilityCard …） |
| `lib/` | AQI 分级、城市列表、类型、配色 |
| `scripts/generate-forecast.mjs` | 不依赖 n8n 的本地数据生成脚本 |
| `n8n/` | n8n 工作流定义 + Code 节点源码 |
| `public/data/forecast.json` | n8n 产出物（也是前端唯一数据源） |
| `docs/` | n8n 部署 / Vercel 部署 / 概率化方法说明 |

## 部署链路

1. 在 GitHub 创建空仓库 `weiweicf66-cmd/aq-forecast`（不勾 README）
2. 本地：
   ```bash
   git remote add origin https://github.com/weiweicf66-cmd/aq-forecast.git
   git push -u origin main
   ```
3. 在 https://vercel.com/new 导入这个仓库（详见 [docs/vercel-setup.md](docs/vercel-setup.md)）
4. 配置 n8n 工作流（详见 [docs/n8n-setup.md](docs/n8n-setup.md)）

## 数据可信度

「概率」是基于点预测合成的，**不是真实集合预报**。详见 [docs/probabilistic-method.md](docs/probabilistic-method.md)。UI 已标注「仅供参考」。

## License

MIT
