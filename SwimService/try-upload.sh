#!/bin/bash
set -e
cd "$(dirname "$0")"
URL_FILE="my-url.txt"
rm -f "$URL_FILE"

echo "📡 尝试 1/2：transfer.sh ..."
TRANSFER_URL=$(curl -s --max-time 30 --upload-file la-pools-insert.sql "https://transfer.sh/la-pools-$(date +%s).sql")
if [ -n "$TRANSFER_URL" ] && [[ "$TRANSFER_URL" == http* ]]; then
  # 验证
  CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -L "$TRANSFER_URL")
  echo "  transfer.sh 响应：$TRANSFER_URL (HTTP $CODE)"
  if [ "$CODE" = "200" ]; then
    echo "✅ 选 transfer.sh"
    echo "$TRANSFER_URL" > "$URL_FILE"
    exit 0
  fi
fi

echo "📡 尝试 2/2：file.io ..."
JSON=$(curl -s --max-time 30 -F "file=@la-pools-insert.sql" "https://file.io")
echo "  file.io 原始响应 = $JSON"
FILEIO_URL=$(echo "$JSON" | python3 -c "import sys,json
try:
  d = json.load(sys.stdin)
  print(d.get('link') or d.get('url') or '')
except Exception as e:
  print('')
" 2>/dev/null)
if [ -n "$FILEIO_URL" ] && [[ "$FILEIO_URL" == http* ]]; then
  CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -L "$FILEIO_URL")
  echo "  file.io URL = $FILEIO_URL (HTTP $CODE)"
  if [ "$CODE" = "200" ]; then
    echo "✅ 选 file.io"
    echo "$FILEIO_URL" > "$URL_FILE"
    exit 0
  fi
fi

echo "❌ 两个公共托管都失败，需要走方案 C（本地起服务器 + 内网穿透）或方案 D（base64 分片粘贴）"
exit 1
