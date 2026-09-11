#!/bin/bash
set -e

# ============================================================
#  SwimService 一键部署脚本（阿里云 ECS）
#  说明：排除 node_modules 等大文件，只传构建必需代码
#  首次使用：请修改下方的 3 个配置项
# ============================================================

# ---------- 配置区（请根据实际情况修改） ----------
ECS_HOST="47.253.51.32"         # ECS 公网 IP，例：123.56.78.90
ECS_USER="root"                     # SSH 登录用户名，通常是 root
ECS_DEPLOY_PATH="/root/SwimService" # ✅ 已确认：ECS 上的实际部署目录
# SSH_KEY="~/.ssh/ecs-key.pem"      # 如果使用密钥登录，取消注释并改为密钥路径
# -------------------------------------------------

LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_TARGET="${ECS_USER}@${ECS_HOST}:${ECS_DEPLOY_PATH}"

echo ""
echo "🚀  SwimService 云端部署脚本"
echo "================================"
echo "📡 目标服务器: ${ECS_USER}@${ECS_HOST}"
echo "📂 远程路径:   ${ECS_DEPLOY_PATH}"
echo "💻 本地代码:   ${LOCAL_DIR}"
echo ""

# 检查必填配置
if [[ "$ECS_HOST" == "xxx.xxx.xxx.xxx" ]]; then
    echo "❌ 错误：请先编辑脚本，修改 ECS_HOST / ECS_USER / ECS_DEPLOY_PATH 配置项。"
    echo ""
    exit 1
fi

# 构造 rsync 参数
RSYNC_OPTS="-avz --progress"
# 注意：已移除 --delete 参数，避免误删 ECS 上独有的文件（如 .env.cloud、uploads/ 等）
# SSH 选项
SSH_CMD="ssh"
if [[ -n "$SSH_KEY" ]]; then
    SSH_CMD="ssh -i ${SSH_KEY}"
fi
RSYNC_OPTS="${RSYNC_OPTS} -e '${SSH_CMD}'"

# 必须排除的文件/目录（关键！排除 500MB+ 的无用内容）
EXCLUDE_LIST=(
    --exclude='node_modules'
    --exclude='dist'
    --exclude='coverage'
    --exclude='.git'
    --exclude='.DS_Store'
    --exclude='cloudflared'
    --exclude='cloudflared-url.txt'
    --exclude='uploads'
    --exclude='runtime'
    --exclude='*.log'
    --exclude='.env'
    --exclude='.env.local'
    --exclude='.env.cloud'        # 云端环境变量只在 ECS 上存在，rsync 不要碰它
    --exclude='.env.*.example'    # 示例文件不同步，避免覆盖
    --exclude='la-*.sql'
    --exclude='la-*.json'
    --exclude='generate-la-*.js'
    --exclude='patch-la-*.js'
    --exclude='google-ingest-la-*.js'
    --exclude='try-upload.sh'
    --exclude='start-tunnel.sh'
    --exclude='start-server.sh'
)

echo "⏳ Step 1/3: 正在同步代码到 ECS（rsync 增量同步，秒传级）..."
echo ""

eval rsync ${RSYNC_OPTS} \
    "${EXCLUDE_LIST[@]}" \
    "${LOCAL_DIR}/" \
    "${REMOTE_TARGET}/"

echo ""
echo "✅ Step 1/3: 代码同步完成"
echo ""

echo "⏳ Step 2/3: 在 ECS 上重建 Docker 容器..."
echo ""

# 远程执行部署命令
DOCKER_CMD="cd ${ECS_DEPLOY_PATH} && \
    docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build --force-recreate"

eval ${SSH_CMD} ${ECS_USER}@${ECS_HOST} "\"${DOCKER_CMD}\""

echo ""
echo "✅ Step 2/3: 容器重建命令已提交"
echo ""

echo "⏳ Step 3/3: 验证服务状态（健康检查）..."
echo ""

# 等 5 秒让容器启动
sleep 5

HEALTH_CHECK_CMD="curl -s --max-time 10 http://127.0.0.1:3000/api/health 2>/dev/null || echo '未响应'"
HEALTH_RESULT=$(eval ${SSH_CMD} ${ECS_USER}@${ECS_HOST} "\"${HEALTH_CHECK_CMD}\"")

echo "🔍 健康检查结果: ${HEALTH_RESULT}"
echo ""

# 查看容器状态
echo "🔍 容器运行状态:"
eval ${SSH_CMD} ${ECS_USER}@${ECS_HOST} "\"docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -5\""

echo ""
echo "🎉 部署完成！"
echo "================================"
echo "📖 如果健康检查失败，可登录 ECS 查看日志："
echo "   ssh ${ECS_USER}@${ECS_HOST}"
echo "   docker logs swimservice-cloud --tail 100"
echo ""
