# 概率预报评估方法

## 目的

回答两个问题：
1. 我们说"明天 60% 概率是良"，实际"良"出现的频率真有 60% 吗？（**校准度**）
2. 最可能的等级预报，实际命中率多高？（**分类准确率**）

## 数据流

```
评估管线（n8n 第二个工作流，每日 07:30 Asia/Shanghai）：
  1. GitHub API → 拉过去 14 天 forecast.json 的 commit 历史
  2. Open-Meteo past_days=14 → 拉各城市过去 14 天小时级 PM2.5
  3. 配对：对每个 (commit_date, predicted_day)，只取 predicted_day < today 的（已经能观测）
  4. 计算指标：Brier score + 分类准确率，按城市 + 按 lead day 拆分
  5. 写 public/data/eval.json → commit → Vercel 重建
```

## 指标定义

### Brier Score（多类版）

对一次预报 `p = (p_1, p_2, ..., p_C)` 和实际类别 `y`（one-hot 编码 `o = (o_1, ..., o_C)`）：

```
BS_one = sum_c (p_c - o_c)^2
```

整个评估窗口的 Brier Score 是所有样本 `BS_one` 的平均。

**取值范围**：6 个等级时，0 ≤ BS ≤ 2。0 = 完美预报，越接近 0 越好。基准参考：均匀预报（每类 1/6）的 BS ≈ 0.83。

### 分类准确率（categorical accuracy）

简单地，每次预报选 `dominant`（最可能等级），如果跟实测类别一致就算命中：

```
acc = #(predicted_dominant == observed_category) / N
```

### lead day 拆分

`lead_day = predicted_day - commit_date`（天数差）。
- lead 0 = 当天预报当天，最容易准
- lead 6 = 6 天后预报，误差累积最大

后续可以画出 brier(lead_day) 曲线看模型在不同时长上的退化速度。

## "实测"的数据来源说明（重要诚信声明）

我们用 **Open-Meteo `past_days=14`** 拿到的 PM2.5 值作为"实测"。这其实是 CAMS 模型的**reanalysis**（重分析）输出——同一个物理模型 + 历史观测数据同化后的回算值，**不是站点直接观测**。

**这意味着什么：**
- 我们的预报跟 CAMS reanalysis 比，本质上是在跟"同一个模型在已知更多信息后的事后估计"比
- 模型一致的系统性 bias 不会被发现（如果 CAMS 整体高估，我们的预报基于 CAMS 也高估，那 reanalysis 也高估，配对看不出问题）
- 但**短期天气演变带来的预报误差**仍然能被这套评估捕捉到——这是评估的核心价值

**v2 升级到真实地面观测的路径：**
- AQICN API（需注册免费 token）— 中国国控站实测数据
- 中国环境监测总站直接抓取（需爬虫，不规范）
- 自建 station agreement 数据库（不现实）

v1 目标是建立闭环并产出可重复指标，CAMS reanalysis 已经够用。

## 不评估什么

- **lead 0 当天发布的预报**：要等当天结束才能评估。我们的脚本只看 `predicted_day < today` 的对，所以今天的当日预报要明天才会评估到。
- **数据缺失日**：Open-Meteo 偶有空值，我们要求一天至少 12 小时有效才计入。

## 如何用评估结果

1. **首页底部"预报准确度回顾"区块**：n_pairs / 准确率 / Brier 三个数字 + 可展开的分城市表
2. **后续 v2 用法**：
   - 拿残差校准 σ 公式：`σ_v2 = mean(|predicted - observed|) × scale`，把固定 20% 换成数据驱动
   - 校准曲线（reliability diagram）：画 (predicted_prob_bin, observed_freq) 散点，看哪些 bin 偏离 y=x
   - 看哪个城市哪种污染等级误差最大，针对性优化（如某城常年低估冬季重污染）

## 当前样本量预期

- 第 1 天（今天 2026-05-22）：~18 对（初始 commit 的过去 3 天 × 6 城）
- 第 2 天：~36 对
- 第 7 天：~84 对（lead 0-5 都有了）
- 第 14 天：~150+ 对（满窗口）

样本量 ≥ 30 时，首页开始展示分城市详情；之前只展示总体三个数字。
