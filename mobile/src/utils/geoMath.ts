// Lightweight Geometry Math for off-route deviation calculating

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

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate the shortest distance (in meters) from a point to a line segment,
 * and return the projected snapping point [lng, lat].
 * Uses a local flat-plane approximation (equirectangular projection).
 */
export function getPointToLineDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): { distance: number; snappedCoord: [number, number] } {
  const [px, py] = point;    // lng, lat
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  // Flatten the coordinates locally based on latitude to approximate meters.
  // The latitude scale remains 1, but longitude needs to shrink by cos(latitude).
  const avgLat = (py + y1 + y2) / 3;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);

  const dx = (x2 - x1) * cosLat;
  const dy = y2 - y1;

  const segmentLengthSquared = dx * dx + dy * dy;

  let t = 0;
  if (segmentLengthSquared > 0) {
    // Project point onto the line segment to find the closest point
    const pxLocal = (px - x1) * cosLat;
    const pyLocal = py - y1;

    // Dot product to find projection scalar
    t = (pxLocal * dx + pyLocal * dy) / segmentLengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment
  }

  const snappedX = x1 + t * (x2 - x1);
  const snappedY = y1 + t * (y2 - y1);
  const snappedCoord: [number, number] = [snappedX, snappedY];

  const distance = getDistance(point, snappedCoord);

  return { distance, snappedCoord };
}

/**
 * Given a FeatureCollection of LineStrings, iterate through the segments to find
 * the absolute minimum distance (off-route deviation in meters) and the nearest
 * snapped coordinate.
 */
export function calculateRouteMetrics(
  currentCoord: [number, number],
  geojson: any // GeoJSON.FeatureCollection
): { distance: number; snappedCoord: [number, number] } | null {
  if (!geojson || !geojson.features || !Array.isArray(geojson.features)) return null;

  let minDistance = Infinity;
  let bestSnappedCoord: [number, number] | null = null;

  for (const feature of geojson.features) {
    if (feature.geometry && feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) continue;

      for (let i = 0; i < coords.length - 1; i++) {
        const start = coords[i] as [number, number];
        const end = coords[i + 1] as [number, number];

        const { distance, snappedCoord } = getPointToLineDistance(currentCoord, start, end);

        if (distance < minDistance) {
          minDistance = distance;
          bestSnappedCoord = snappedCoord;
        }
      }
    }
  }

  if (bestSnappedCoord) {
    return { distance: minDistance, snappedCoord: bestSnappedCoord };
  }

  return null;
}
