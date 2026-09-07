#!/bin/bash
cd "$(dirname "$0")"
echo "🖥️  本地 HTTP 服务器启动：端口 8765（pid=$$）"
exec python3 -m http.server 8765 --bind 127.0.0.1
