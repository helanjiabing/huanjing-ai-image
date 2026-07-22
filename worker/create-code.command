#!/bin/zsh
set -e

echo "幻境 AI · 生成付款兑换码"
echo "套餐额度：1 张 / 5 张 / 15 张"
read "CREDITS?输入用户购买的张数："
read -s "ADMIN_SECRET_INPUT?输入部署时设置的管理员密码："
echo

curl -sS "https://huanjing-image-api.huanjing-ai.workers.dev/admin/create-code" \
  -H "Origin: https://helanjiabing.github.io" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET_INPUT" \
  --data "{\"credits\":$CREDITS}"
echo
echo "把上方 HJ- 开头的兑换码发给付款用户。"

unset CREDITS ADMIN_SECRET_INPUT
