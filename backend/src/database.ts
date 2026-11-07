import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/routes.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db: Database.Database | null = null;

export const initDatabase = async () => {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      total_distance REAL,
      estimated_duration INTEGER,
      total_ascent REAL,
      max_elevation REAL,
      difficulty INTEGER DEFAULT 1,
      vehicle_type TEXT,
      geojson TEXT,
      tile_status TEXT DEFAULT 'idle',
      total_tiles INTEGER DEFAULT 0,
      downloaded_tiles INTEGER DEFAULT 0,
      file_size_mb REAL DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      track_data TEXT NOT NULL,
      track_type TEXT DEFAULT 'line',
      difficulty TEXT DEFAULT 'easy',
      color TEXT DEFAULT '#00FF00'
    );

    CREATE TABLE IF NOT EXISTS pois (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS route_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      order_index INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_route_tracks_route_id ON route_tracks(route_id);
    CREATE INDEX IF NOT EXISTS idx_pois_route_id ON pois(route_id);
    CREATE INDEX IF NOT EXISTS idx_route_images_route_id ON route_images(route_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate routes columns if needed
  const columns = db.pragma('table_info(routes)') as Array<{ name: string }>;
  const columnNames = new Set(columns.map(c => c.name));

  if (!columnNames.has('redeem_code')) {
    db.exec("ALTER TABLE routes ADD COLUMN redeem_code TEXT");
  }
  if (!columnNames.has('max_zoom')) {
    db.exec("ALTER TABLE routes ADD COLUMN max_zoom INTEGER DEFAULT 15");
  }

  // Backfill redeem_code for existing routes
  const existingRoutes = db.prepare("SELECT id, redeem_code FROM routes").all() as Array<{ id: number; redeem_code: string | null }>;
  const updateRedeem = db.prepare("UPDATE routes SET redeem_code = ? WHERE id = ?");
  for (const r of existingRoutes) {
    if (!r.redeem_code || r.redeem_code.trim() === '') {
      updateRedeem.run(`CHEDU-${String(r.id).padStart(4, '0')}`, r.id);
    }
  }

  // Auto-seed demo BBS post content, waypoints, and roadbook images for Route 1 (阿北线) & Route 2 (紫竹郡)
  try {
    const r1 = db.prepare("SELECT id, description, geojson FROM routes WHERE id = 1").get() as any;
    if (r1 && (!r1.description || r1.description.trim() === '')) {
      const abeiDesc = `【勘路总览】
阿北线全长 203.8 公里，累计爬升 5673 米，全线海拔在 2141m 至 4596m 之间剧烈起伏。路线从河谷下道口切入高山草甸与碎石防火道，翻越海拔 4596 米的最高达坂垭口后沿峡谷发卡弯出山。全程约 75% 路段处于手机信号盲区，是检验四驱系统与纯离线雷达循迹的经典硬派穿越路线。

【分段路况与驾驶提示】
1. 河谷下道集结段（0 - 50km，海拔 2558m → 4283m）：进山前务必加满 95# 汽油，下道后建议将冷胎胎压降至 1.9 Bar，关闭车身 ESP 限制并切换高速四驱（4H）。
2. 4596m 达坂冲顶段（50 - 110km，最高海拔 4596m）：连续碎石陡坡与交叉轴车辙，高海拔动力衰减明显，建议锁止低速四驱（4L）稳住油门通过；垭口常年强风低温，切勿长时间停留。
3. 云端牧场与峡谷出山段（110 - 203.8km，海拔 3600m → 2169m）：后半程为近 1500 米落差的连续长下坡，请挂入低速挡利用发动机制动，严禁长时间踩刹车导致热衰减。

【随车装备与离线包说明】
必备 AT/MT 全地形轮胎、车载电台（438.500MHz）、8吨拖车绳与便携充气泵。本帖已生成 37.3MB 高清卫星离线包，请复制下方口令 CHEDU-0001 前往「离线工具箱」核销提取。`;

      let g1 = r1.geojson ? JSON.parse(r1.geojson) : null;
      if (g1 && Array.isArray(g1.features) && g1.features.length === 1) {
        g1.features.push(
          {
            type: 'Feature',
            properties: { name: '进山河谷集结点 (2558m)', description: '最后一个移动基站信号点，建议在此放气至 1.9 Bar 并确认离线卫星包已点亮', type: 'waypoint' },
            geometry: { type: 'Point', coordinates: [101.585715, 31.795845, 2558] }
          },
          {
            type: 'Feature',
            properties: { name: '高山草甸交叉轴段 (4283m)', description: '深车辙与炮弹坑密集区，注意控制油门节奏，切勿碾压原生草甸', type: 'waypoint' },
            geometry: { type: 'Point', coordinates: [101.459538, 31.454972, 4283] }
          },
          {
            type: 'Feature',
            properties: { name: '阿北线最高达坂垭口 (4596m)', description: '全线最高海拔点（4596m），横风剧烈，注意高反与变速箱油温', type: 'waypoint' },
            geometry: { type: 'Point', coordinates: [101.541616, 31.429935, 4596] }
          },
          {
            type: 'Feature',
            properties: { name: '云端牧场宿营补给点 (3600m)', description: '地势开阔背风，适合车队中途休整路餐与无人机航拍', type: 'waypoint' },
            geometry: { type: 'Point', coordinates: [101.668855, 31.542221, 3600] }
          }
        );
      }

      db.prepare(`
        UPDATE routes
        SET description = ?, max_elevation = 4596, difficulty = 4, vehicle_type = '硬派四驱 + AT/MT全地形胎', redeem_code = 'CHEDU-0001', geojson = ?
        WHERE id = 1
      `).run(abeiDesc, g1 ? JSON.stringify(g1) : r1.geojson);

      const imgCount1 = (db.prepare("SELECT COUNT(*) as c FROM route_images WHERE route_id = 1").get() as any).c;
      if (imgCount1 === 0) {
        const insImg = db.prepare("INSERT INTO route_images (route_id, image_url, caption, order_index) VALUES (?, ?, ?, ?)");
        insImg.run(1, '/uploads/abei_3_sunset.png', '图1：阿北线海拔 4200m 高山草甸山脊线黄昏实拍', 0);
        insImg.run(1, '/uploads/abei_1_elevation.png', '图2：阿北线 203.8km 全程高程剖面图（最高达坂 4596m，累计爬升 5673m）', 1);
        insImg.run(1, '/uploads/abei_2_track.png', '图3：阿北线全段轨迹拓扑与 4 处核心战术航点标定图', 2);
      }
    }

    const r2 = db.prepare("SELECT id, description FROM routes WHERE id = 2").get() as any;
    if (r2 && (!r2.description || r2.description.trim() === '')) {
      const zzjDesc = `【勘路总览】
紫竹郡测试环线位于成都市新都区石板滩街道香岸中路周边，全长 2.3 公里，包含保利狮子湖紫竹郡集结起点、分岔路口及两处连续急弯航点。本路线专为出发前设备联调、车载 HUD 仪表测试及 60 米偏航震动预警演练打造。

【现场演示与测试指南】
1. 航点巡检测试：进入战术轨迹雷达后，可点击顶部航点胶囊快速切换查看「保利狮子湖紫竹郡」「分岔口」「拐弯点」等航点坐标与路况说明。
2. 离线卫星包点亮与切换：点击雷达页右上角「卫星点亮 / 雷达网格」按钮，体验零在线请求下的深色战术网格与局部卫星底图无缝切换。
3. 60米偏航预警演练：开启「战术循迹导航」或使用「模拟巡航 / 模拟偏航」演练开关，当车辆偏离主轨迹满 60 米时，HUD 仪表盘立即变红报警、触发脉冲震动，并在地图上实时绘制黄色最短回归引导虚线。`;

      db.prepare(`
        UPDATE routes
        SET description = ?, total_ascent = 45, max_elevation = 518, difficulty = 2, vehicle_type = '城市四驱 SUV / 轻越野均可', redeem_code = 'CHEDU-0002'
        WHERE id = 2
      `).run(zzjDesc);

      const imgCount2 = (db.prepare("SELECT COUNT(*) as c FROM route_images WHERE route_id = 2").get() as any).c;
      if (imgCount2 === 0) {
        db.prepare("INSERT INTO route_images (route_id, image_url, caption, order_index) VALUES (?, ?, ?, ?)").run(
          2,
          '/uploads/zizhujun_1_track.png',
          '图1：紫竹郡 2.3km 轻越野测试环线轨迹拓扑与 4 处战术航点标定图',
          0
        );
      }
    }
  } catch (seedErr) {
    console.error('Demo seed warning:', seedErr);
  }

  // Reset any downloading jobs to failed on startup
  db.prepare("UPDATE routes SET tile_status = 'failed', error_message = 'Interrupted by server restart' WHERE tile_status = 'downloading'").run();
};

export const query = <T = any>(sql: string, params: any[] = []): T[] => {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(sql).all(...params) as T[];
};

export const queryOne = <T = any>(sql: string, params: any[] = []): T | undefined => {
  if (!db) throw new Error('Database not initialized');
  return db.prepare(sql).get(...params) as T | undefined;
}

export const run = (sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } => {
  if (!db) throw new Error('Database not initialized');
  const info = db.prepare(sql).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
};

export default () => {
  if (!db) throw new Error('Database not initialized');
  return db;
};
