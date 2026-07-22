#!/bin/zsh
set -e
cd "$(dirname "$0")"

echo "幻境 AI · Cloudflare 安全部署"
echo "输入内容不会显示，也不会保存到项目文件。"
echo

echo "正在检查 Cloudflare 登录状态…"
if ! npx wrangler whoami --config "$PWD/wrangler.jsonc" >/dev/null 2>&1; then
  echo "需要重新登录 Cloudflare，浏览器即将打开。"
  npx wrangler login
fi

read -s "FAL_KEY_INPUT?粘贴 fal.ai API Key，然后按回车："
echo

npx wrangler deploy --config "$PWD/wrangler.jsonc"
print -rn -- "$FAL_KEY_INPUT" | npx wrangler secret put FAL_KEY --config "$PWD/wrangler.jsonc"

unset FAL_KEY_INPUT
echo
echo "部署完成。请把上方显示的 workers.dev 地址复制给 Codex。"
