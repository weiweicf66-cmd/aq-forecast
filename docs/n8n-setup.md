# n8n 本地部署与工作流配置

## 1. 启动 n8n（Docker）

需要先装好 Docker Desktop for Windows。

```powershell
docker volume create n8n_data

docker run -d --name n8n --restart unless-stopped `
  -p 5678:5678 `
  -e GENERIC_TIMEZONE=Asia/Shanghai `
  -e TZ=Asia/Shanghai `
  -v n8n_data:/home/node/.n8n `
  n8nio/n8n
```

首次访问 http://localhost:5678 创建本地账号（账号信息只存在本机的 Docker 卷 `n8n_data` 里）。

后续重启电脑后只需 `docker start n8n` 即可恢复。

## 2. 申请 GitHub PAT

1. 打开 https://github.com/settings/personal-access-tokens
2. **New token (fine-grained)**
3. **Repository access** → Only select repositories → 选 `weiweicf66-cmd/aq-forecast`
4. **Repository permissions** → **Contents: Read and write**（其他默认 No access）
5. 有效期建议 90 天，到期前会收到邮件提醒
6. 复制生成的 token（只显示一次）

## 3. 在 n8n 里配置工作流变量

在 n8n 顶部菜单 → **Settings → Variables**（n8n Enterprise 才有这个面板；Community 版改用下面的方式：在工作流编辑器右上角 ⋯ → Workflow Settings → Variables）。

如果你的 n8n 版本没有 Variables UI，**替代方案**：把 `n8n/code-node.js` 顶部 `$vars.GITHUB_TOKEN` 等改成硬编码字符串，临时跑通后再迁移到环境变量。

需要的变量：

| 变量名 | 值 |
| --- | --- |
| GITHUB_TOKEN | 上一步复制的 PAT |
| GITHUB_OWNER | weiweicf66-cmd |
| GITHUB_REPO | aq-forecast |
| GITHUB_BRANCH | main |

## 4. 导入工作流

1. n8n 左上角 → **Import from File** → 选 `n8n/workflow.json`
2. 打开 "Build forecast + commit" 节点
3. 把 `n8n/code-node.js` 的**全部内容**复制粘贴到 Code 节点的 JS 编辑器里（替换占位错误抛出）
4. 点 **Save** → **Active** 切换为 ON

## 5. 手动测试一次

- 在工作流编辑器里点 **Execute Workflow**（不要等 cron）
- 等 5-15 秒。Code 节点应该输出类似：
  ```json
  {
    "ok": true,
    "cities_with_data": 6,
    "cities_failed": [],
    "commit_sha": "abc123...",
    "commit_url": "https://github.com/weiweicf66-cmd/aq-forecast/commit/..."
  }
  ```
- 打开 GitHub 仓库确认 `public/data/forecast.json` 有新的 commit
- 如果有 Vercel 已连，~2 分钟后访问生产 URL 看页面是否更新

## 6. 故障排除

- **`fetch is not defined`**：你的 n8n 版本太老（< 1.0）。升级到最新 n8n 镜像 `docker pull n8nio/n8n:latest`。
- **GitHub PUT 422**：通常是 sha 错配——通常 Code 节点的 GET-then-PUT 已经处理。如果初次提交，仓库里还没这个文件，应该走 "create" 路径（无 sha）。Code 节点已兼容。
- **Open-Meteo 拉取失败/超时**：中国网络偶发问题。可以在 Code 节点的 `fetchCity` 里加重试，或在 HTTP Request 节点替代时设置 retries=3 timeout=30000。
- **想换城市**：改 Code 节点顶部的 `CITIES` 数组，记得同步改前端 `lib/cities.ts`。
- **想换 cron 时间**：改 Schedule Trigger 节点的 cronExpression。注意 n8n 容器的 TZ 是 Asia/Shanghai（启动 docker 时设了），所以 `0 7 * * *` 就是早 7 点本地时间。
