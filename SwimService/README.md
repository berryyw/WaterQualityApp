# SwimService

`SwimService` 是“泳池水质通”的后端服务，基于 `NestJS + Prisma + PostgreSQL` 实现，负责为 iOS App 和 Web 管理后台提供统一 REST API。

## 本地开发

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run start:dev
```

默认健康检查：

```bash
http://127.0.0.1:3000/api/health
```

补充说明：

- `npm run prisma:seed` 会初始化默认管理员，并为当前内置城市生成测试泳馆数据
- 当前默认会为 `北京 / 上海 / 深圳` 各生成约 `10` 个测试泳馆，便于 App 与后台联调

## 关键环境变量

参考 `SwimService/.env.example`：

- `HOST`
- `PORT`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `STORAGE_PROVIDER`
- `SERVICE_PUBLIC_BASE_URL`
- `OSS_*`
- `EMAIL_*`
- `REDIS_*`

## 云端部署建议

当前 `cloud` 分支默认按“小体量、单机 ECS”准备：

- 计算：`阿里云 ECS + Docker`
- 数据库：`PostgreSQL 16 容器`
- 文件存储：默认 `local`（挂载到宿主机 `uploads/`），正式环境建议切 `OSS`
- 缓存：默认关闭
- 邮件：正式环境建议 `smtp`

### 1. 构建镜像

```bash
docker build -t swim-service:cloud .
```

### 2. 单机 ECS 启动

```bash
cp .env.cloud.example .env.cloud
# 修改 .env.cloud 中的 JWT 密钥、ECS 公网 IP、数据库密码
docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build
```

容器启动后会自动执行数据库迁移并启动服务：

```bash
npm run prisma:migrate:deploy
npm run start:prod
```

### 3. 云端发布顺序

1. 上传 `SwimService/` 到 ECS
2. 复制 `cp .env.cloud.example .env.cloud`
3. 修改 `.env.cloud` 中的 JWT 密钥与 `SERVICE_PUBLIC_BASE_URL`
4. 执行 `docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build`
5. 检查 `GET /api/health`
6. 再发布 `SwimAdminWeb`

### 4. 当前正式环境推荐值

如果你沿用当前项目的正式域名方案：

```env
CORS_ALLOWED_ORIGINS=http://swim666.cloud
SERVICE_PUBLIC_BASE_URL=http://api.swim666.cloud

EMAIL_PROVIDER=smtp
EMAIL_FROM=泳池水质通 <system@swim666.cloud>
EMAIL_SMTP_HOST=smtp.qiye.aliyun.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
EMAIL_SMTP_USER=system@swim666.cloud
EMAIL_SMTP_DIAGNOSTIC=false
```

切 OSS 时再补齐：

```env
STORAGE_PROVIDER=oss
OSS_ENDPOINT=...
OSS_REGION=...
OSS_BUCKET=...
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
OSS_PUBLIC_BASE_URL=...
```

## 注意事项

### 1. CORS

云端请务必配置后台地址白名单：

```env
CORS_ALLOWED_ORIGINS=http://your-admin-address
```

### 2. 存储

当前云端默认可用：

```env
STORAGE_PROVIDER=local
```

正式环境如切 OSS，改为：

```env
STORAGE_PROVIDER=oss
```

### 3. 邮件

当前正式环境建议：

```env
EMAIL_PROVIDER=smtp
```

### 4. 调试残留

上线前仍建议继续清理 iOS 中固定局域网调试上报逻辑，避免将本地联调代码带入正式环境。
