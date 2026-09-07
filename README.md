# 泳池水质通项目总览

本仓库是“泳池水质通”项目的本地工作区，当前主业务由三个实际工程组成：

- `ios/SwimWaterQualityApp`：iOS 客户端
- `SwimService`：后端服务，基于 `NestJS + Prisma + PostgreSQL`
- `SwimAdminWeb`：运营后台，基于 `React + Vite`


## 1. 仓库结构

```text
projrct4/
├── ios/SwimWaterQualityApp/        # iOS 客户端主工程
├── SwimService/                   # 后端 API 服务
├── SwimAdminWeb/                  # Web 运营后台
└── README.md                      # 当前总览文档
```

注意：

- 当前主业务入口不是根目录的 `src/` 和 `package.json`
- 根目录保留了一个历史 Vite 壳工程，后续建议单独整理或迁出，避免和 `SwimAdminWeb` 混淆

## 2. 三端说明

### 2.1 iOS 客户端

路径：

- `ios/SwimWaterQualityApp`

工程入口：

- `ios/SwimWaterQualityApp/SwimWaterQualityApp.xcodeproj`

关键说明：

- 使用 `SwiftUI`
- 接口地址通过 `Info.plist` 中的 `SWIM_SERVICE_BASE_URL` 注入
- 当前工程已切到云端接口地址：`http://api.swim666.cloud/api/`

本地打开方式：

1. 用 Xcode 打开 `ios/SwimWaterQualityApp/SwimWaterQualityApp.xcodeproj`
2. 选择模拟器或真机
3. 直接运行 `SwimWaterQualityApp`

### 2.2 后端服务

路径：

- `SwimService`

技术栈：

- `NestJS`
- `Prisma`
- `PostgreSQL`
- 文件存储支持 `local / OSS`
- 邮件支持 `log / smtp`

服务特征：

- 全局 API 前缀为 `/api`
- 本地默认地址：`http://127.0.0.1:3000/api`
- 正式环境域名：`http://api.swim666.cloud`

本地启动：

```bash
cd SwimService
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

健康检查：

```bash
http://127.0.0.1:3000/api/health
```

### 2.3 Web 运营后台

路径：

- `SwimAdminWeb`

技术栈：

- `React`
- `Vite`
- `Zustand`

关键说明：

- API Base URL 由 `VITE_API_BASE_URL` 控制
- 本地默认值为 `http://localhost:3000/api`
- 正式环境静态资源部署到 `OSS`

本地启动：

```bash
cd SwimAdminWeb
npm install
npm run dev
```

生产构建：

```bash
cd SwimAdminWeb
npm run build
```

## 3. 本地联调链路

推荐顺序：

1. 启动 `SwimService`
2. 配置 `SwimAdminWeb` 的 `VITE_API_BASE_URL`
3. 在 Xcode 中运行 `SwimWaterQualityApp`

典型联调地址：

- 后端：`http://127.0.0.1:3000/api`
- 后台：本地 Vite dev server
- iOS：通过 `SWIM_SERVICE_BASE_URL` 指向本机局域网地址或云端地址

## 4. 阿里云正式环境现状

当前正式环境已完成：

- 后端部署到阿里云服务器并通过 Docker Compose 运行
- Web 后台构建后上传到 OSS
- 文件存储已切换到 OSS
- 邮件验证码已切换到阿里云企业邮箱 SMTP
- iOS 已切到云端域名接口

当前正式环境地址：

- 后端 API：`http://api.swim666.cloud`
- Web 后台：`http://swim666.cloud`
- iOS App API Base URL：`http://api.swim666.cloud/api/`

## 5. 当前建议的后续工作

~~当前最值得继续推进的方向不是"再搭一遍环境"，而是把现有可用版本继续标准化：~~

~~1. 整理仓库入口与文档，降低后续维护成本~~
~~2. 补齐后台管理员会话刷新与注销失效机制~~
~~3. 清理 iOS 调试残留代码~~
~~4. 增补后端与后台的最小自动化回归~~
~~5. 在对外分发前再评估 HTTPS / TestFlight 标准化流程~~
