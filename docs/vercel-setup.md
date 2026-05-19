# Vercel 部署

## 一次性 import

1. 用 GitHub 登录 https://vercel.com/login
2. 顶部 **Add New... → Project**
3. **Import Git Repository** 列表里找 `weiweicf66-cmd/aq-forecast`（如果没出现：点 "Adjust GitHub App Permissions" 给 Vercel 加这个仓库的访问权）
4. **Configure Project** 界面：
   - Framework Preset: 自动识别为 **Next.js**
   - Root Directory: `./`（默认）
   - Build Command: 留空（用默认 `next build`）
   - Output Directory: 留空（默认 `.next`）
   - Environment Variables: **不需要任何**
5. 点 **Deploy**，等 2-3 分钟首次构建完成

部署成功后会得到一个 `https://<project>-<hash>.vercel.app` 的生产 URL，记下来。

## 之后

任何对 `main` 分支的 push（包括 n8n 的自动 commit）都会触发 Vercel 重新构建。一般 90-120 秒可见生产环境更新。

## 自定义域名（可选）

Vercel Project → Settings → Domains → Add，按提示在 DNS 商解析 CNAME 即可。

## 部署状态

- 在 Vercel 项目主页 Deployments 标签可以看到每次构建日志
- 失败时 Vercel 会给提交者发邮件
