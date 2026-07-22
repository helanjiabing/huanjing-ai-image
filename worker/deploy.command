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

read -s "FAL_KEY_INPUT?如需更新 fal.ai API Key 请粘贴；保持不变直接按回车："
echo
read -s "ADMIN_SECRET_INPUT?设置一个发放兑换码用的管理员密码，然后按回车："
echo

npx wrangler deploy --config "$PWD/wrangler.jsonc"
if [[ -n "$FAL_KEY_INPUT" ]]; then
  print -rn -- "$FAL_KEY_INPUT" | npx wrangler secret put FAL_KEY --config "$PWD/wrangler.jsonc"
fi
print -rn -- "$ADMIN_SECRET_INPUT" | npx wrangler secret put ADMIN_SECRET --config "$PWD/wrangler.jsonc"

unset FAL_KEY_INPUT ADMIN_SECRET_INPUT
echo
echo "部署完成。请把上方显示的 workers.dev 地址复制给 Codex。"
