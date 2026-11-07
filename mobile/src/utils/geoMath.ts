// Lightweight Geometry & Tactical Radar Math Utilities

export interface RouteMetricsResult {
  distance: number; // Deviation distance in meters
  snappedCoord: [number, number];
  remainingDistanceKm: number;
  progressPercent: number;
}

export interface RouteWaypoint {
  id: string;
  name: string;
  description?: string;
  coord: [number, number];
  elevation?: number;
  kind: 'start' | 'end' | 'waypoint';
}

export interface ExtractedRouteMeta {
  waypoints: RouteWaypoint[];
  elevationProfile: number[];
  minElevation: number;
  maxElevation: number;
  computedAscent: number;
  normalizedPreviewPath: Array<[number, number]>; // Normalized [0..1, 0..1] for thumbnail drawing
}

/**
 * Returns distance in meters between two [lng, lat] points using the Haversine formula.
 */
export function getDistance(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371e3; // Earth radius in meters
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate the shortest distance (in meters) from a point to a line segment,
 * and return the projected snapping point [lng, lat] and interpolation factor t [0..1].
 */
export function getPointToLineDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): { distance: number; snappedCoord: [number, number]; t: number } {
  const [px, py] = point; // lng, lat
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const avgLat = (py + y1 + y2) / 3;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);

  const dx = (x2 - x1) * cosLat;
  const dy = y2 - y1;

  const segmentLengthSquared = dx * dx + dy * dy;

  let t = 0;
  if (segmentLengthSquared > 0) {
    const pxLocal = (px - x1) * cosLat;
    const pyLocal = py - y1;

    t = (pxLocal * dx + pyLocal * dy) / segmentLengthSquared;
    t = Math.max(0, Math.min(1, t));
  }

  const snappedX = x1 + t * (x2 - x1);
  const snappedY = y1 + t * (y2 - y1);
  const snappedCoord: [number, number] = [snappedX, snappedY];

  const distance = getDistance(point, snappedCoord);

  return { distance, snappedCoord, t };
}

/**
 * Given a FeatureCollection of LineStrings, iterate through the segments to find
 * the minimum off-route deviation in meters, the nearest snapped coordinate,
 * and the remaining distance along the track to the finish.
 */
export function calculateRouteMetrics(
  currentCoord: [number, number],
  geojson: any
): RouteMetricsResult | null {
  if (!geojson || !geojson.features || !Array.isArray(geojson.features)) return null;

  // Flatten all LineString coordinates into an ordered list of segments
  const allCoords: [number, number][] = [];
  for (const feature of geojson.features) {
    if (feature.geometry && feature.geometry.type === 'LineString' && Array.isArray(feature.geometry.coordinates)) {
      for (const c of feature.geometry.coordinates) {
        if (Array.isArray(c) && c.length >= 2) {
          allCoords.push([c[0], c[1]]);
        }
      }
    }
  }

  if (allCoords.length < 2) return null;

  let minDistance = Infinity;
  let bestSnappedCoord: [number, number] | null = null;
  let bestSegmentIndex = 0;

  const segmentLengths: number[] = [];
  let totalLengthMeters = 0;

  for (let i = 0; i < allCoords.length - 1; i++) {
    const start = allCoords[i];
    const end = allCoords[i + 1];
    const segLen = getDistance(start, end);
    segmentLengths.push(segLen);
    totalLengthMeters += segLen;

    const { distance, snappedCoord } = getPointToLineDistance(currentCoord, start, end);

    if (distance < minDistance) {
      minDistance = distance;
      bestSnappedCoord = snappedCoord;
      bestSegmentIndex = i;
    }
  }

  if (!bestSnappedCoord) return null;

  // Calculate remaining distance from bestSnappedCoord to the end of the route
  let remainingMeters = getDistance(bestSnappedCoord, allCoords[bestSegmentIndex + 1]);
  for (let j = bestSegmentIndex + 1; j < segmentLengths.length; j++) {
    remainingMeters += segmentLengths[j];
  }

  const remainingDistanceKm = Math.max(0, remainingMeters / 1000);
  const progressPercent =
    totalLengthMeters > 0
      ? Math.max(0, Math.min(100, ((totalLengthMeters - remainingMeters) / totalLengthMeters) * 100))
      : 0;

  return {
    distance: minDistance,
    snappedCoord: bestSnappedCoord,
    remainingDistanceKm,
    progressPercent,
  };
}

/**
 * Extracts start/end points, waypoints, elevation profile, and normalized 2D path from GeoJSON.
 */
export function extractRouteMeta(geojson: any): ExtractedRouteMeta {
  const waypoints: RouteWaypoint[] = [];
  const rawElevations: number[] = [];
  const linePoints: [number, number][] = [];
  let firstCoord: number[] | null = null;
  let lastCoord: number[] | null = null;

  if (geojson && Array.isArray(geojson.features)) {
    let wpIndex = 1;
    for (const feature of geojson.features) {
      if (!feature?.geometry) continue;

      if (feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
        const c = feature.geometry.coordinates;
        if (c.length >= 2) {
          waypoints.push({
            id: `wp-${wpIndex++}`,
            name: feature.properties?.name || `航点 #${wpIndex - 1}`,
            description: feature.properties?.description || '',
            coord: [c[0], c[1]],
            elevation: typeof c[2] === 'number' && c[2] !== 0 ? Math.round(c[2]) : undefined,
            kind: 'waypoint',
          });
        }
      } else if (feature.geometry.type === 'LineString' && Array.isArray(feature.geometry.coordinates)) {
        for (const c of feature.geometry.coordinates) {
          if (Array.isArray(c) && c.length >= 2) {
            if (!firstCoord) firstCoord = c;
            lastCoord = c;
            linePoints.push([c[0], c[1]]);
            if (typeof c[2] === 'number' && !isNaN(c[2]) && c[2] !== 0) {
              rawElevations.push(c[2]);
            }
          }
        }
      }
    }
  }

  if (firstCoord) {
    waypoints.unshift({
      id: 'wp-start',
      name: '路线起点 (START)',
      description: '建议在此检查胎压、油量及卫星离线包点亮状态',
      coord: [firstCoord[0], firstCoord[1]],
      elevation: typeof firstCoord[2] === 'number' && firstCoord[2] !== 0 ? Math.round(firstCoord[2]) : undefined,
      kind: 'start',
    });
  }

  if (lastCoord && (lastCoord[0] !== firstCoord?.[0] || lastCoord[1] !== firstCoord?.[1])) {
    waypoints.push({
      id: 'wp-end',
      name: '路线终点 (FINISH)',
      description: '穿越路段结束，恢复铺装路面行驶设置',
      coord: [lastCoord[0], lastCoord[1]],
      elevation: typeof lastCoord[2] === 'number' && lastCoord[2] !== 0 ? Math.round(lastCoord[2]) : undefined,
      kind: 'end',
    });
  }

  // Downsample elevation profile to ~36 bars
  const targetSamples = 36;
  const elevationProfile: number[] = [];
  if (rawElevations.length > 0) {
    for (let i = 0; i < targetSamples; i++) {
      const idx = Math.min(
        rawElevations.length - 1,
        Math.floor((i / targetSamples) * rawElevations.length)
      );
      elevationProfile.push(Math.round(rawElevations[idx]));
    }
  } else {
    // Fallback synthetic terrain profile when GPX/KML lacked Z values
    for (let i = 0; i < targetSamples; i++) {
      const wave =
        1200 +
        Math.sin((i / targetSamples) * Math.PI) * 950 +
        Math.cos((i / targetSamples) * Math.PI * 3.5) * 220;
      elevationProfile.push(Math.round(wave));
    }
  }

  let minElevation = Infinity;
  let maxElevation = -Infinity;
  for (const e of elevationProfile) {
    if (e < minElevation) minElevation = e;
    if (e > maxElevation) maxElevation = e;
  }
  if (!isFinite(minElevation)) minElevation = 0;
  if (!isFinite(maxElevation)) maxElevation = 0;

  let computedAscent = 0;
  for (let i = 1; i < rawElevations.length; i++) {
    const diff = rawElevations[i] - rawElevations[i - 1];
    if (diff > 0) computedAscent += diff;
  }

  // Downsample 2D path to at most 48 points normalized to [0..1, 0..1]
  const normalizedPreviewPath: Array<[number, number]> = [];
  if (linePoints.length >= 2) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of linePoints) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const spanX = Math.max(maxX - minX, 0.0001);
    const spanY = Math.max(maxY - minY, 0.0001);
    const maxPoints = Math.min(48, linePoints.length);
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.min(linePoints.length - 1, Math.floor((i / (maxPoints - 1)) * (linePoints.length - 1)));
      const [x, y] = linePoints[idx];
      normalizedPreviewPath.push([(x - minX) / spanX, 1 - (y - minY) / spanY]);
    }
  }

  return {
    waypoints,
    elevationProfile,
    minElevation,
    maxElevation,
    computedAscent: Math.round(computedAscent),
    normalizedPreviewPath,
  };
}

/**
 * Generates a pure-offline tactical radar coordinate grid GeoJSON around a route bbox.
 * Ensures zero online tile requests while delivering a high-precision military/off-road radar feel.
 */
export function generateRadarGridGeoJSON(bbox?: [number, number, number, number]) {
  const defaultBBox: [number, number, number, number] = [110, 35, 118, 42];
  const [minLng, minLat, maxLng, maxLat] = bbox || defaultBBox;

  const span = Math.max(maxLng - minLng, maxLat - minLat, 0.05);
  // Choose grid step cleanly based on route span
  let majorStep = 0.1;
  if (span > 2) majorStep = 0.5;
  else if (span > 0.6) majorStep = 0.1;
  else if (span > 0.15) majorStep = 0.02;
  else majorStep = 0.005;

  const minorStep = majorStep / 4;

  const pad = majorStep * 4;
  const startLng = Math.floor((minLng - pad) / majorStep) * majorStep;
  const endLng = Math.ceil((maxLng + pad) / majorStep) * majorStep;
  const startLat = Math.floor((minLat - pad) / majorStep) * majorStep;
  const endLat = Math.ceil((maxLat + pad) / majorStep) * majorStep;

  const features: any[] = [];

  // Minor grid lines
  for (let lng = startLng; lng <= endLng + 1e-9; lng += minorStep) {
    const isMajor = Math.abs(Math.round(lng / majorStep) * majorStep - lng) < 1e-6;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [Number(lng.toFixed(6)), startLat],
          [Number(lng.toFixed(6)), endLat],
        ],
      },
      properties: {
        gridType: isMajor ? 'major' : 'minor',
        label: isMajor ? `${lng.toFixed(2)}°E` : '',
      },
    });
  }

  for (let lat = startLat; lat <= endLat + 1e-9; lat += minorStep) {
    const isMajor = Math.abs(Math.round(lat / majorStep) * majorStep - lat) < 1e-6;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [startLng, Number(lat.toFixed(6))],
          [endLng, Number(lat.toFixed(6))],
        ],
      },
      properties: {
        gridType: isMajor ? 'major' : 'minor',
        label: isMajor ? `${lat.toFixed(2)}°N` : '',
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Formats compass heading (0-360) into cardinal direction + degrees, e.g. "NW 315°"
 */
export function formatCompassHeading(heading: number | null): { cardinal: string; degreeText: string } {
  if (heading === null || heading === undefined || isNaN(heading) || heading < 0) {
    return { cardinal: '--', degreeText: '---°' };
  }
  const normalized = ((Math.round(heading) % 360) + 360) % 360;
  const dirs = ['N 北', 'NE 东北', 'E 东', 'SE 东南', 'S 南', 'SW 西南', 'W 西', 'NW 西北'];
  const idx = Math.round(normalized / 45) % 8;
  return {
    cardinal: dirs[idx],
    degreeText: `${normalized}°`,
  };
}
