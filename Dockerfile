# --- Stage 1: Build Frontend ---
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/client

COPY frontend/package*.json ./
# 配置淘宝 NPM 镜像
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:20-bookworm-slim AS backend-builder
WORKDIR /app

# 替换 Debian 镜像源为腾讯云并安装编译工具
RUN sed -i 's/deb.debian.org/mirrors.cloud.tencent.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./

# 配置淘宝 NPM 和 node-gyp 头文件镜像
ENV npm_config_registry=https://registry.npmmirror.com
ENV npm_config_disturl=https://npmmirror.com/mirrors/node
RUN npm install

COPY backend/ ./
RUN npm run build
RUN npm rebuild better-sqlite3 --build-from-source
RUN npm prune --production

# --- Stage 3: Runtime ---
FROM node:20-bookworm-slim
WORKDIR /app

# 复制生产环境依赖和产物
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/client/dist ./client/dist
COPY backend/package*.json ./

# 创建数据和上传目录
RUN mkdir -p data uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
