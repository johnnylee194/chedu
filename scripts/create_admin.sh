#!/bin/bash
# Chedu 项目级辅助脚本：创建管理员账号

# 检查参数
if [ "$#" -ne 2 ]; then
    echo "用法: ./scripts/create_admin.sh <用户名> <密码>"
    exit 1
fi

ADMIN_USER=$1
ADMIN_PASS=$2

echo "正在通过 Docker 容器创建管理员账号: $ADMIN_USER ..."

# 将环境变量传递给容器，并调用后端的 init-admin 脚本
docker compose exec -e INIT_ADMIN_USER="$ADMIN_USER" -e INIT_ADMIN_PASS="$ADMIN_PASS" chedu npm run init-admin

echo "执行完毕。"
