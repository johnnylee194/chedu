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

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./

# 配置淘宝 NPM 镜像
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

COPY backend/ ./
RUN npm run build

# --- Stage 3: Runtime ---
FROM node:20-bookworm-slim
WORKDIR /app

# Install build tools for better-sqlite3 native bindings in production
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 复制 package.json
COPY backend/package*.json ./

# 配置淘宝 NPM 镜像
RUN npm config set registry https://registry.npmmirror.com

# 安装所有生产依赖
RUN npm install --only=production
RUN npm rebuild better-sqlite3

# 复制构建产物
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/client/dist ./client/dist

# 创建数据和上传目录
RUN mkdir -p data uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
