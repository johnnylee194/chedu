import { File, Directory, Paths } from 'expo-file-system';

const DEFAULT_SERVER_URL = 'https://chedu.januslab.cn';

export interface RouteInfo {
  id: number;
  name: string;
  distance?: number;
  distance_km?: number;
  mbtiles_ready: number;
  created_at: string;
}

export interface RouteDetail extends RouteInfo {
  geojson: any;
  bbox?: [number, number, number, number];
}

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
    const settings = { serverUrl: url };
    file.write(JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

// 2. Fetching with Timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000) => {
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
const computeBBox = (geojson: any): [number, number, number, number] | undefined => {
  if (!geojson || geojson.type !== 'FeatureCollection' || !geojson.features) return undefined;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
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
const parseGeojson = (rawGeojson: any): any => {
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

// 3. Sync Logic
export const syncRoutes = async (): Promise<RouteDetail[]> => {
  const serverUrl = await getServerUrl();
  const routesUrl = `${serverUrl}/api/routes`;
  const routesDir = new Directory(Paths.document, 'routes');

  try {
    const listResponse = await fetchWithTimeout(routesUrl);
    if (!listResponse.ok) throw new Error(`HTTP error! status: ${listResponse.status}`);
    const routesList: RouteInfo[] = await listResponse.json();

    // Ensure route directory exists
    if (!routesDir.exists) {
      routesDir.create();
    }

    const fullRoutes: RouteDetail[] = [];

    for (const route of routesList) {
      const detailUrl = `${serverUrl}/api/routes/${route.id}`;
      const detailResponse = await fetchWithTimeout(detailUrl);
      if (detailResponse.ok) {
        const detailData = await detailResponse.json();

        const parsedGeojson = parseGeojson(detailData.geojson);
        const bbox = detailData.bbox || computeBBox(parsedGeojson);

        const routeDetail: RouteDetail = {
          ...route,
          name: detailData.name || route.name,
          distance_km: detailData.distance_km || route.distance_km,
          geojson: parsedGeojson,
          bbox,
        };

        fullRoutes.push(routeDetail);

        // Save to local cache
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

// 4. Local Cache Logic
export const getCachedRoutes = async (): Promise<RouteDetail[]> => {
  try {
    const routesDir = new Directory(Paths.document, 'routes');
    if (!routesDir.exists) {
      return [];
    }

    const files = routesDir.list();
    const cachedRoutes: RouteDetail[] = [];

    for (const file of files) {
      if (file.name.endsWith('.json') && file instanceof File) {
        const content = file.textSync();
        try {
          const route: RouteDetail = JSON.parse(content);
          cachedRoutes.push(route);
        } catch (e) {
          console.error(`Failed to parse cached route ${file.name}`, e);
        }
      }
    }

    // Sort by id descending
    cachedRoutes.sort((a, b) => b.id - a.id);
    return cachedRoutes;
  } catch (error) {
    console.error('Error reading cached routes:', error);
    return [];
  }
};
