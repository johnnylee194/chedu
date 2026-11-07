import { File, Directory, Paths } from 'expo-file-system';

const DEFAULT_SERVER_URL = 'https://chedu.januslab.cn';

export interface RouteImage {
  id?: number;
  image_url: string;
  caption?: string;
  order_index?: number;
}

export interface RouteInfo {
  id: number;
  title: string;
  description?: string;
  total_distance: number;
  total_ascent?: number;
  max_elevation?: number;
  difficulty?: number;
  vehicle_type?: string;
  tile_status: string;
  file_size_mb?: number;
  created_at: string;
  redeem_code: string;
  max_zoom?: number;
  images?: RouteImage[];
}

export interface RouteDetail extends RouteInfo {
  geojson: any;
  bbox?: [number, number, number, number];
}

// Generate deterministic CDK code from route ID
export const formatRedeemCode = (routeId: number): string => {
  return `CHEDU-${String(routeId).padStart(4, '0')}`;
};

// In-memory clipboard bridge for seamless Roadbook -> Toolbox CDK transfer
let lastCopiedCode: string | null = null;
export const setCopiedRedeemCode = (code: string | null) => {
  lastCopiedCode = code ? code.trim().toUpperCase() : null;
};
export const getCopiedRedeemCode = (): string | null => {
  return lastCopiedCode;
};

const ABEI_DESCRIPTION = `【勘路总览】
阿北线全长 203.8 公里，累计爬升 5673 米，全线海拔在 2141m 至 4596m 之间剧烈起伏。路线从河谷下道口切入高山草甸与碎石防火道，翻越海拔 4596 米的最高达坂垭口后沿峡谷发卡弯出山。全程约 75% 路段处于手机信号盲区，是检验四驱系统与纯离线雷达循迹的经典硬派穿越路线。

【分段路况与驾驶提示】
1. 河谷下道集结段（0 - 50km，海拔 2558m → 4283m）：进山前务必加满 95# 汽油，下道后建议将冷胎胎压降至 1.9 Bar，关闭车身 ESP 限制并切换高速四驱（4H）。
2. 4596m 达坂冲顶段（50 - 110km，最高海拔 4596m）：连续碎石陡坡与交叉轴车辙，高海拔动力衰减明显，建议锁止低速四驱（4L）稳住油门通过；垭口常年强风低温，切勿长时间停留。
3. 云端牧场与峡谷出山段（110 - 203.8km，海拔 3600m → 2169m）：后半程为近 1500 米落差的连续长下坡，请挂入低速挡利用发动机制动，严禁长时间踩刹车导致热衰减。

【随车装备与离线包说明】
必备 AT/MT 全地形轮胎、车载电台（438.500MHz）、8吨拖车绳与便携充气泵。本帖已生成 37.3MB 高清卫星离线包，请复制下方口令 CHEDU-0001 前往「离线工具箱」核销提取。`;

const ABEI_IMAGES: RouteImage[] = [
  {
    image_url: '/uploads/abei_3_sunset.png',
    caption: '图1：阿北线海拔 4200m 高山草甸山脊线黄昏实拍',
    order_index: 0,
  },
  {
    image_url: '/uploads/abei_1_elevation.png',
    caption: '图2：阿北线 203.8km 全程高程剖面图（最高达坂 4596m，累计爬升 5673m）',
    order_index: 1,
  },
  {
    image_url: '/uploads/abei_2_track.png',
    caption: '图3：阿北线全段轨迹拓扑与 4 处核心战术航点标定图',
    order_index: 2,
  },
];

const ABEI_WAYPOINTS = [
  {
    type: 'Feature',
    properties: {
      name: '进山河谷集结点 (2558m)',
      description: '最后一个移动基站信号点，建议在此放气至 1.9 Bar 并确认离线卫星包已点亮',
      type: 'waypoint',
    },
    geometry: { type: 'Point', coordinates: [101.585715, 31.795845, 2558] },
  },
  {
    type: 'Feature',
    properties: {
      name: '高山草甸交叉轴段 (4283m)',
      description: '深车辙与炮弹坑密集区，注意控制油门节奏，切勿碾压原生草甸',
      type: 'waypoint',
    },
    geometry: { type: 'Point', coordinates: [101.459538, 31.454972, 4283] },
  },
  {
    type: 'Feature',
    properties: {
      name: '阿北线最高达坂垭口 (4596m)',
      description: '全线最高海拔点（4596m），横风剧烈，注意高反与变速箱油温',
      type: 'waypoint',
    },
    geometry: { type: 'Point', coordinates: [101.541616, 31.429935, 4596] },
  },
  {
    type: 'Feature',
    properties: {
      name: '云端牧场宿营补给点 (3600m)',
      description: '地势开阔背风，适合车队中途休整路餐与无人机航拍',
      type: 'waypoint',
    },
    geometry: { type: 'Point', coordinates: [101.668855, 31.542221, 3600] },
  },
];

const ZIZHUJUN_DESCRIPTION = `【勘路总览】
紫竹郡测试环线位于成都市新都区石板滩街道香岸中路周边，全长 2.3 公里，包含保利狮子湖紫竹郡集结起点、分岔路口及两处连续急弯航点。本路线专为出发前设备联调、车载 HUD 仪表测试及 60 米偏航震动预警演练打造。

【现场演示与测试指南】
1. 航点巡检测试：进入战术轨迹雷达后，可点击顶部航点胶囊快速切换查看「保利狮子湖紫竹郡」「分岔口」「拐弯点」等航点坐标与路况说明。
2. 离线卫星包点亮与切换：点击雷达页右上角「卫星点亮 / 雷达网格」按钮，体验零在线请求下的深色战术网格与局部卫星底图无缝切换。
3. 60米偏航预警演练：开启「战术循迹导航」或使用「模拟巡航 / 模拟偏航」演练开关，当车辆偏离主轨迹满 60 米时，HUD 仪表盘立即变红报警、触发脉冲震动，并在地图上实时绘制黄色最短回归引导虚线。`;

const ZIZHUJUN_IMAGES: RouteImage[] = [
  {
    image_url: '/uploads/zizhujun_1_track.png',
    caption: '图1：紫竹郡 2.3km 轻越野测试环线轨迹拓扑与 4 处战术航点标定图',
    order_index: 0,
  },
];

// Built-in offline fallback for the 2 database routes (Route 1: 阿北线 & Route 2: 紫竹郡)
const BUILTIN_FALLBACK_ROUTES: RouteDetail[] = [
  {
    id: 1,
    title: '阿北线',
    description: ABEI_DESCRIPTION,
    total_distance: 203.8,
    total_ascent: 5673,
    max_elevation: 4596,
    difficulty: 4,
    vehicle_type: '硬派四驱 + AT/MT全地形胎',
    tile_status: 'completed',
    file_size_mb: 37.3,
    created_at: '2026-10-14T15:42:00Z',
    redeem_code: 'CHEDU-0001',
    max_zoom: 15,
    images: ABEI_IMAGES,
    bbox: [101.44, 31.41, 102.07, 31.81],
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '阿北线', color: '#FF5722' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [101.585715, 31.795845, 2558],
              [101.54211, 31.68214, 3120],
              [101.49124, 31.56421, 3760],
              [101.459538, 31.454972, 4283],
              [101.541616, 31.429935, 4596],
              [101.668855, 31.542221, 3600],
              [101.818042, 31.476461, 3442],
              [101.94512, 31.47512, 2780],
              [102.062753, 31.47679, 2169],
            ],
          },
        },
        ...ABEI_WAYPOINTS,
      ],
    },
  },
  {
    id: 2,
    title: '紫竹郡',
    description: ZIZHUJUN_DESCRIPTION,
    total_distance: 2.3,
    total_ascent: 45,
    max_elevation: 518,
    difficulty: 2,
    vehicle_type: '城市四驱 SUV / 轻越野均可',
    tile_status: 'completed',
    file_size_mb: 1.2,
    created_at: '2026-11-04T11:04:00Z',
    redeem_code: 'CHEDU-0002',
    max_zoom: 15,
    images: ZIZHUJUN_IMAGES,
    bbox: [104.162, 30.741, 104.171, 30.746],
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '紫竹郡测试线', color: '#FF5722' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [104.16311, 30.744657, 512],
              [104.164808, 30.741709, 515],
              [104.167238, 30.743645, 518],
              [104.168426, 30.742537, 516],
              [104.170376, 30.745531, 514],
              [104.163136, 30.744911, 512],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: '保利狮子湖紫竹郡',
            description: '四川省成都市新都区石板滩街道香岸中路201号（设备联调集结起点）',
            type: 'waypoint',
          },
          geometry: { type: 'Point', coordinates: [104.16313648, 30.74471269, 512] },
        },
        {
          type: 'Feature',
          properties: {
            name: '分岔口',
            description: '前方道路分岔，严格沿雷达高亮橙色主轨迹通行',
            type: 'waypoint',
          },
          geometry: { type: 'Point', coordinates: [104.1648075, 30.74170893, 515] },
        },
        {
          type: 'Feature',
          properties: {
            name: '一号拐弯观察点',
            description: '90度直角弯道视野盲区，注意观察车载 HUD 航向角变化',
            type: 'waypoint',
          },
          geometry: { type: 'Point', coordinates: [104.16723758, 30.74364536, 518] },
        },
        {
          type: 'Feature',
          properties: {
            name: '二号拐弯折返点',
            description: '60m 偏航预警演练点：在此偏离主路即可触发红色偏航报警与回归虚线',
            type: 'waypoint',
          },
          geometry: { type: 'Point', coordinates: [104.1684258, 30.74253653, 516] },
        },
      ],
    },
  },
];

/**
 * Automatically enriches Route 1 (阿北线) & Route 2 (紫竹郡) with demo BBS post content,
 * waypoints, and roadbook images if the remote server returned empty fields before restart.
 */
export const enrichDemoRoute = (route: RouteDetail): RouteDetail => {
  const enriched = { ...route };
  if (enriched.id === 1 || enriched.title?.includes('阿北')) {
    if (!enriched.description || enriched.description.trim() === '') {
      enriched.description = ABEI_DESCRIPTION;
    }
    if (!enriched.images || enriched.images.length === 0) {
      enriched.images = ABEI_IMAGES;
    }
    if (!enriched.max_elevation) {
      enriched.max_elevation = 4596;
    }
    if (!enriched.redeem_code) {
      enriched.redeem_code = 'CHEDU-0001';
    }
    if (
      enriched.geojson &&
      Array.isArray(enriched.geojson.features) &&
      !enriched.geojson.features.some((f: any) => f?.geometry?.type === 'Point')
    ) {
      enriched.geojson = {
        ...enriched.geojson,
        features: [...enriched.geojson.features, ...ABEI_WAYPOINTS],
      };
    }
  } else if (enriched.id === 2 || enriched.title?.includes('紫竹')) {
    if (!enriched.description || enriched.description.trim() === '') {
      enriched.description = ZIZHUJUN_DESCRIPTION;
    }
    if (!enriched.images || enriched.images.length === 0) {
      enriched.images = ZIZHUJUN_IMAGES;
    }
    if (!enriched.total_ascent || enriched.total_ascent === 0) {
      enriched.total_ascent = 45;
    }
    if (!enriched.max_elevation) {
      enriched.max_elevation = 518;
    }
    if (!enriched.redeem_code) {
      enriched.redeem_code = 'CHEDU-0002';
    }
  }
  return enriched;
};

// 1. Settings Management
export const getServerUrl = async (): Promise<string> => {
  try {
    const file = new File(Paths.document, 'settings.json');
    if (file.exists) {
      const content = file.textSync();
      const settings = JSON.parse(content);
      return settings.serverUrl || DEFAULT_SERVER_URL;
    }
  } catch (error) {
    console.error('Error reading settings:', error);
  }
  return DEFAULT_SERVER_URL;
};

export const saveServerUrl = async (url: string): Promise<void> => {
  try {
    const file = new File(Paths.document, 'settings.json');
    const cleaned = url.trim().replace(/\/+$/, '');
    const settings = { serverUrl: cleaned || DEFAULT_SERVER_URL };
    file.write(JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

// 2. Redeemed Routes Persistence (CDK Redemption State)
export const getRedeemedRouteIds = async (): Promise<number[]> => {
  try {
    const file = new File(Paths.document, 'redeemed_routes.json');
    if (file.exists) {
      const content = file.textSync();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.ids)) {
        return parsed.ids.filter((id: any) => typeof id === 'number');
      }
    }
  } catch (error) {
    console.error('Error reading redeemed routes:', error);
  }
  return [];
};

export const saveRedeemedRouteIds = async (ids: number[]): Promise<void> => {
  try {
    const uniqueIds = Array.from(new Set(ids));
    const file = new File(Paths.document, 'redeemed_routes.json');
    file.write(JSON.stringify({ ids: uniqueIds, updatedAt: new Date().toISOString() }));
  } catch (error) {
    console.error('Error saving redeemed routes:', error);
  }
};

export const removeRedeemedRoute = async (routeId: number): Promise<number[]> => {
  const current = await getRedeemedRouteIds();
  const next = current.filter((id) => id !== routeId);
  await saveRedeemedRouteIds(next);
  return next;
};

export const clearAllRedeemedRoutes = async (): Promise<void> => {
  await saveRedeemedRouteIds([]);
};

// 3. Fetching with Timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 6000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal as any });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Compute Bounding Box manually without Turf
export const computeBBox = (geojson: any): [number, number, number, number] | undefined => {
  if (!geojson || geojson.type !== 'FeatureCollection' || !geojson.features) return undefined;

  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  let hasCoords = false;

  for (const feature of geojson.features) {
    if (feature.geometry && feature.geometry.type === 'LineString' && feature.geometry.coordinates) {
      for (const coord of feature.geometry.coordinates) {
        if (coord.length >= 2) {
          const [lng, lat] = coord;
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
          hasCoords = true;
        }
      }
    }
  }

  return hasCoords ? [minLng, minLat, maxLng, maxLat] : undefined;
};

// Parse GeoJSON safely
export const parseGeojson = (rawGeojson: any): any => {
  if (typeof rawGeojson === 'string') {
    try {
      return JSON.parse(rawGeojson);
    } catch (e) {
      console.error('Failed to parse geojson string', e);
      return null;
    }
  }
  return rawGeojson;
};

// 4. Sync Logic (Fetches available BBS catalog from server and caches locally)
export const syncRoutes = async (): Promise<RouteDetail[]> => {
  const serverUrl = await getServerUrl();
  const routesUrl = `${serverUrl}/api/routes`;
  const routesDir = new Directory(Paths.document, 'routes');

  try {
    const listResponse = await fetchWithTimeout(routesUrl);
    if (!listResponse.ok) throw new Error(`HTTP error! status: ${listResponse.status}`);
    const routesList: any[] = await listResponse.json();

    if (!routesDir.exists) {
      routesDir.create();
    }

    // Remove legacy 901 demo file if present
    const legacyFile = new File(routesDir, '901.json');
    if (legacyFile.exists) {
      try {
        legacyFile.delete();
      } catch {}
    }

    const fullRoutes: RouteDetail[] = [];

    for (const route of routesList) {
      const detailUrl = `${serverUrl}/api/routes/${route.id}`;
      const detailResponse = await fetchWithTimeout(detailUrl);
      if (detailResponse.ok) {
        const detailData = await detailResponse.json();

        const parsedGeojson = parseGeojson(detailData.geojson);
        const bbox = detailData.bbox || computeBBox(parsedGeojson);

        const rawDetail: RouteDetail = {
          id: route.id,
          title: detailData.title ?? route.title ?? '未命名越野路线',
          description: detailData.description ?? route.description ?? '',
          total_distance: Number(detailData.total_distance ?? route.total_distance ?? 0),
          total_ascent: Number(detailData.total_ascent ?? route.total_ascent ?? 0),
          max_elevation: detailData.max_elevation ?? route.max_elevation ?? undefined,
          difficulty: detailData.difficulty ?? route.difficulty ?? undefined,
          vehicle_type: detailData.vehicle_type ?? route.vehicle_type ?? undefined,
          tile_status: detailData.tile_status ?? route.tile_status ?? 'idle',
          file_size_mb: Number(detailData.file_size_mb ?? route.file_size_mb ?? 0),
          created_at: detailData.created_at ?? route.created_at ?? new Date().toISOString(),
          redeem_code: detailData.redeem_code || formatRedeemCode(route.id),
          max_zoom: detailData.max_zoom || 15,
          images: detailData.images || route.images || [],
          geojson: parsedGeojson,
          bbox,
        };

        const routeDetail = enrichDemoRoute(rawDetail);
        fullRoutes.push(routeDetail);

        const cacheFile = new File(routesDir, `${route.id}.json`);
        cacheFile.write(JSON.stringify(routeDetail));
      }
    }

    return fullRoutes;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
};

// 5. Local Cache Logic
export const getCachedRoutes = async (): Promise<RouteDetail[]> => {
  try {
    const routesDir = new Directory(Paths.document, 'routes');
    const cachedRoutes: RouteDetail[] = [];

    if (routesDir.exists) {
      const files = routesDir.list();
      for (const file of files) {
        if (file.name === '901.json' && file instanceof File) {
          try {
            file.delete();
          } catch {}
          continue;
        }
        if (file.name.endsWith('.json') && file instanceof File) {
          const content = file.textSync();
          try {
            const raw: any = JSON.parse(content);
            const route: RouteDetail = enrichDemoRoute({
              ...raw,
              redeem_code: raw.redeem_code || formatRedeemCode(raw.id),
              max_zoom: raw.max_zoom || 15,
              images: raw.images || [],
              bbox: raw.bbox || computeBBox(raw.geojson),
            });
            cachedRoutes.push(route);
          } catch (e) {
            console.error(`Failed to parse cached route ${file.name}`, e);
          }
        }
      }
    }

    // Ensure the 2 database routes (Route 1 & Route 2) are always available even offline
    for (const builtin of BUILTIN_FALLBACK_ROUTES) {
      if (!cachedRoutes.some((r) => r.id === builtin.id)) {
        cachedRoutes.push(builtin);
      }
    }

    cachedRoutes.sort((a, b) => a.id - b.id);
    return cachedRoutes;
  } catch (error) {
    console.error('Error reading cached routes:', error);
    return BUILTIN_FALLBACK_ROUTES;
  }
};

// 6. Redeem Route with Server POST /api/routes/redeem + Local Fallback
export const redeemRouteByCode = async (
  rawInput: string
): Promise<{ success: boolean; message: string; route?: RouteDetail; alreadyRedeemed?: boolean }> => {
  const cleanCode = rawInput.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: '请输入路书文末附带的兑换码（如 CHEDU-0001）' };
  }

  const serverUrl = await getServerUrl();
  let matched: RouteDetail | undefined;

  // 1. Try server verification first
  try {
    const redeemRes = await fetchWithTimeout(`${serverUrl}/api/routes/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode }),
    });

    if (redeemRes.ok) {
      const data = await redeemRes.json();
      const parsedGeojson = parseGeojson(data.geojson);
      const bbox = data.bbox || computeBBox(parsedGeojson);

      matched = enrichDemoRoute({
        id: data.id,
        title: data.title || '未命名越野路线',
        description: data.description || '',
        total_distance: Number(data.total_distance || 0),
        total_ascent: Number(data.total_ascent || 0),
        max_elevation: data.max_elevation ?? undefined,
        difficulty: data.difficulty ?? undefined,
        vehicle_type: data.vehicle_type ?? undefined,
        tile_status: data.tile_status || 'idle',
        file_size_mb: Number(data.file_size_mb || 0),
        created_at: data.created_at || new Date().toISOString(),
        redeem_code: data.redeem_code || formatRedeemCode(data.id),
        max_zoom: data.max_zoom || 15,
        images: data.images || [],
        geojson: parsedGeojson,
        bbox,
      });

      // Cache directly to local storage
      const routesDir = new Directory(Paths.document, 'routes');
      if (!routesDir.exists) routesDir.create();
      const cacheFile = new File(routesDir, `${matched.id}.json`);
      cacheFile.write(JSON.stringify(matched));
    }
  } catch (e) {
    console.log('[Redeem] Remote redeem check failed, falling back to local cache', e);
  }

  // 2. Fallback to local cache & built-ins if offline or if remote server hasn't restarted yet
  if (!matched) {
    const allRoutes = await getCachedRoutes();
    matched = allRoutes.find((r) => {
      const standardCode = (r.redeem_code || formatRedeemCode(r.id)).toUpperCase();
      const compactStandard = standardCode.replace(/[^A-Z0-9]/g, '');
      const compactInput = cleanCode.replace(/[^A-Z0-9]/g, '');
      const paddedId = String(r.id).padStart(4, '0');

      return (
        cleanCode === standardCode ||
        compactInput === compactStandard ||
        cleanCode === paddedId ||
        cleanCode === `CHEDU-${r.id}`
      );
    });
  }

  if (!matched) {
    return {
      success: false,
      message: `未找到与口令「${cleanCode}」匹配的路线包，请输入 CHEDU-0001 或 CHEDU-0002`,
    };
  }

  const currentIds = await getRedeemedRouteIds();
  const alreadyRedeemed = currentIds.includes(matched.id);

  if (!alreadyRedeemed) {
    await saveRedeemedRouteIds([...currentIds, matched.id]);
  }

  if (lastCopiedCode === cleanCode) {
    lastCopiedCode = null;
  }

  return {
    success: true,
    alreadyRedeemed,
    route: matched,
    message: alreadyRedeemed
      ? `「${matched.title}」已在您的离线工具箱中`
      : `核销成功！已解锁「${matched.title}」离线轨迹数据`,
  };
};
