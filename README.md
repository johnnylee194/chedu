# Chedu - 越野路线图应用

专业的越野自驾路线图应用，支持 Web 和 PWA，完美复现奥维互动地图浏览器的路线数据。

## 技术栈

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- Tailwind CSS (样式)
- React Router (路由)
- Leaflet + React-Leaflet (地图)
- Recharts (图表)
- Zustand (状态管理)
- Axios (HTTP 客户端)
- IDB (IndexedDB 封装)

### 后端
- Node.js + Express
- TypeScript
- SQLite (better-sqlite3)
- JWT 认证
- Multer (文件上传)

### 部署
- Docker (多阶段构建)
- Nginx (反向代理)
- Docker Compose

## 核心功能

### MVP 阶段

1. **交互式越野地图引擎**
   - 多图层切换（卫星图、地形图、街道图）
   - 轨迹渲染（支持不同颜色表示路况难度）
   - 关键航点（POI）展示
   - 自身定位功能

2. **沉浸式路书详情**
   - 路线元数据（里程、耗时、爬升、海拔等）
   - 图文混排展示
   - 海拔剖面图

3. **PWA 离线能力**
   - App Shell 缓存
   - 数据缓存（IndexedDB）
   - 地图瓦片缓存

4. **奥维数据导入**
   - KML/KMZ 文件解析
   - GPX 文件解析
   - 自动转换为 GeoJSON 格式

## 快速开始

### 开发环境

#### 前端开发

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 启动

#### 后端开发

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

后端将在 http://localhost:3001 启动

### 生产部署

使用 Docker Compose：

```bash
docker-compose up -d
```

应用将在 http://localhost 启动

## 项目结构

```
chedu/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # React 组件
│   │   │   ├── Layout.tsx
│   │   │   ├── MapEngine.tsx
│   │   │   └── ElevationProfile.tsx
│   │   ├── pages/          # 页面组件
│   │   │   ├── HomePage.tsx
│   │   │   ├── RouteDetailPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── AdminPage.tsx
│   │   ├── lib/            # 工具库
│   │   │   ├── api.ts
│   │   │   ├── utils.ts
│   │   │   └── offline.ts
│   │   ├── store/          # 状态管理
│   │   │   ├── auth.ts
│   │   │   └── routes.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/                 # 后端应用
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   │   ├── auth.ts
│   │   │   ├── routes.ts
│   │   │   └── upload.ts
│   │   ├── middleware/     # 中间件
│   │   │   └── auth.ts
│   │   ├── utils/          # 工具函数
│   │   │   └── parser.ts
│   │   ├── database.ts     # 数据库配置
│   │   └── server.ts       # 服务器入口
│   ├── package.json
│   └── tsconfig.json
├── docker/                  # Docker 配置
│   └── nginx.conf
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## API 文档

### 认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 路线

- `GET /api/routes` - 获取所有路线
- `GET /api/routes/:id` - 获取路线详情
- `POST /api/routes` - 创建路线（需要认证）
- `PUT /api/routes/:id` - 更新路线（需要认证）
- `DELETE /api/routes/:id` - 删除路线（需要认证）

### 文件上传

- `POST /api/upload/kml` - 解析 KML/GPX 文件（需要认证）

## 环境变量

### 后端 (.env)

```
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
DATABASE_PATH=./data/routes.db
UPLOAD_DIR=./uploads
CORS_ORIGIN=http://localhost:5173
```

## 开发说明

### 添加新路线

1. 登录管理后台
2. 点击"创建新路线"
3. 上传奥维导出的 KML/GPX 文件
4. 系统自动解析轨迹和航点
5. 完善路线信息（标题、描述、难度等）
6. 保存路线

### 离线使用

1. 在有网络的环境下，点击路线详情页的"离线下载"按钮
2. 路线数据将缓存到本地 IndexedDB
3. 无网络环境下仍可查看已缓存的路线

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
