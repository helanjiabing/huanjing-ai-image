#!/bin/zsh
set -e
cd "$(dirname "$0")"
echo "正在发布幻境 AI 网页更新…"
git push origin main
echo
echo "发布成功。GitHub Pages 通常会在 1–3 分钟内更新。"
