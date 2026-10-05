# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

# 替换 Alpine 镜像源为腾讯云
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories

COPY frontend/package*.json ./
# 配置淘宝 NPM 镜像
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:20-alpine AS backend-builder
WORKDIR /app

# 替换 Alpine 镜像源为腾讯云
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories

# Install build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./

# 配置淘宝 NPM 镜像
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

COPY backend/ ./
RUN npm run build

# --- Stage 3: Runtime ---
FROM node:20-alpine
WORKDIR /app

# 替换 Alpine 镜像源为腾讯云
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories

# Install build tools for better-sqlite3 native bindings in production
RUN apk add --no-cache python3 make g++

# 复制 package.json
COPY backend/package*.json ./

# 配置淘宝 NPM 镜像
RUN npm config set registry https://registry.npmmirror.com

# 安装所有生产依赖
RUN npm install --only=production

# 复制构建产物
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/client/dist ./client/dist

# 创建数据和上传目录
RUN mkdir -p data uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
