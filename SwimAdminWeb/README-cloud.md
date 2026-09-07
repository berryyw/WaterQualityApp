# SwimAdminWeb Cloud 部署说明

`SwimAdminWeb` 在 cloud 版本中推荐部署到：

- `OSS` 托管静态文件
- `CDN` 对外分发

## 构建前准备

复制环境变量模板：

```bash
cp .env.cloud.example .env.production.local
```

修改为你的云端 API 地址：

```env
VITE_API_BASE_URL="http://your-ecs-public-ip:3000/api"
```

> 当前按你的要求，先使用“地址形式”而不是正式域名。后续申请域名后，再把这里替换成 `https://api.xxx.com/api`。

## 构建

```bash
npm install
npm run build:cloud
```

构建产物目录：

```bash
dist/
```

## 部署到 OSS + CDN

建议步骤：

1. 创建 OSS Bucket
2. 上传 `dist/` 下所有文件
3. 打开静态网站托管
4. 前置 CDN
5. 用 OSS/CDN 地址访问后台

## 与后端的联动要求

后端 `SwimService` 必须允许当前 Web 来源：

```env
CORS_ALLOWED_ORIGINS=http://your-admin-oss-address,https://your-cdn-address
```

如果后续切换成正式域名，只需要同时更新：

- `SwimAdminWeb` 的 `VITE_API_BASE_URL`
- `SwimService` 的 `CORS_ALLOWED_ORIGINS`
