#!/bin/bash
set -e
cd "$(dirname "$0")"
URL_FILE="cloudflared-url.txt"
rm -f "$URL_FILE"

# 确认 cloudflared，没有就提示
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "ℹ️  未检测到 cloudflared，尝试自动下载到本地 ./cloudflared（≈ 50MB）..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
  else
    CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
  fi
  curl -sL "$CF_URL" -o /tmp/cf.tgz && tar -xzf /tmp/cf.tgz -C . cloudflared 2>/dev/null || true
  if [ -x ./cloudflared ]; then
    CF_BIN="./cloudflared"
  else
    echo "❌ 自动下载 cloudflared 失败，试试 homebrew 安装："
    echo "   brew install cloudflared"
    echo "   或者用方案 D（base64 分片粘贴，最后兜底）"
    exit 1
  fi
else
  CF_BIN="cloudflared"
fi

echo "✅ 使用 cloudflared: $($CF_BIN --version | head -1)"

# 启动 tunnel 并解析出 quick url
echo "🌐 启动 Cloudflare quick tunnel..."
LOG_FILE="/tmp/cloudflared-quick.log"
rm -f "$LOG_FILE"
nohup "$CF_BIN" tunnel --no-autoupdate --url http://127.0.0.1:8765 --loglevel info > "$LOG_FILE" 2>&1 &
CF_PID=$!
echo "  cloudflared PID = $CF_PID（等 10 秒获取 URL）"

# 等 URL 出现
for i in $(seq 1 15); do
  sleep 1
  URL=$(grep -oE 'https://[a-zA-Z0-9\.-]+\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    echo "$URL" > "$URL_FILE"
    echo "✅ 公网 URL PREFIX = $URL"
    echo "  完整文件 URL = $URL/la-pools-insert.sql"
    # 验证
    FULL="$URL/la-pools-insert.sql"
    CODE=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" -L "$FULL")
    echo "  HTTP $CODE（需要是 200）"
    if [ "$CODE" = "200" ]; then
      echo "✅ 连通！把这个 FULL URL 给 ECS 用："
      echo "  PUBLIC_URL=\"$FULL\""
      # 写完整 URL 到文件
      echo "$FULL" > "$URL_FILE"
      echo "⚠️  注意：保持 cloudflared 进程（PID $CF_PID）和 python server 一直开着，ECS 下完才能关！"
      exit 0
    fi
  fi
done

echo "❌ 15 秒内没拿到 trycloudflare URL 或 HTTP 不是 200。LOG = $LOG_FILE："
tail -n 30 "$LOG_FILE"
echo "建议：要么手动重试，要么直接走方案 D（base64 分片粘贴，最稳最后兜底）"
kill $CF_PID 2>/dev/null
exit 1
