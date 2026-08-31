# Azure 部署建议

推荐低成本方案：
- Azure Container Apps：部署 frontend 与 backend 容器。
- Azure Database for PostgreSQL Flexible Server：生产数据库。
- Azure Container Registry：存储镜像。

流程：
1. GitHub Actions 构建并推送镜像到 ACR。
2. Container Apps 拉取镜像并注入环境变量。
3. backend 配置 DATABASE_URL 指向 Azure PostgreSQL。
4. frontend 配置 VITE_API_BASE_URL 指向 backend 域名。

本地先通过 `docker compose up --build` 完成验证。

## Netlify（前端）+ 云后端（推荐）

适合先快速上线可远程访问网页版：

1. 前端部署到 Netlify（本仓库已配置 `netlify.toml`，base=`frontend`）。
2. 后端部署到 Azure Container Apps（或其他支持 Python/FastAPI 的平台）。
3. 在 Netlify 环境变量中设置 `VITE_API_BASE_URL=https://<backend-domain>/api`。
4. 重新部署前端并验证登录、行情、下单接口连通性。
