#!/bin/zsh
set -e
cd "$(dirname "$0")"

echo "幻境 AI · Cloudflare 安全部署"
echo "输入内容不会显示，也不会保存到项目文件。"
echo
read -s "CF_TOKEN?粘贴 Cloudflare API Token，然后按回车："
echo
read -s "GEMINI_KEY?粘贴 Gemini API Key，然后按回车："
echo

export CLOUDFLARE_API_TOKEN="$CF_TOKEN"
npx wrangler deploy --config "$PWD/wrangler.jsonc"
print -rn -- "$GEMINI_KEY" | npx wrangler secret put GEMINI_API_KEY --config "$PWD/wrangler.jsonc"

unset CF_TOKEN GEMINI_KEY CLOUDFLARE_API_TOKEN
echo
echo "部署完成。请把上方显示的 workers.dev 地址复制给 Codex。"
