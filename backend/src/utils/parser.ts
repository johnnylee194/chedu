import fs from 'fs';
import * as toGeoJSON from '@turf/turf';
import { DOMParser } from 'xmldom';

export interface ParsedRouteData {
  tracks: Array<{
    track_data: any;
    track_type: string;
    difficulty: string;
    color: string;
  }>;
  pois: Array<{
    name: string;
    type: string;
    description: string;
    latitude: number;
    longitude: number;
    elevation: number;
  }>;
  metadata: {
    name: string;
    description: string;
    total_distance: number;
  };
}

export const parseKML = async (filePath: string): Promise<ParsedRouteData> => {
  const kmlContent = fs.readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');

  const result: ParsedRouteData = {
    tracks: [],
    pois: [],
    metadata: {
      name: '',
      description: '',
      total_distance: 0
    }
  };

  const document = kmlDoc.getElementsByTagName('Document')[0] || kmlDoc.getElementsByTagName('kml')[0];

  const nameElement = kmlDoc.getElementsByTagName('name')[0];
  if (nameElement) {
    result.metadata.name = nameElement.textContent || '';
  }

  const descElement = kmlDoc.getElementsByTagName('description')[0];
  if (descElement) {
    result.metadata.description = descElement.textContent || '';
  }

  const placemarks = kmlDoc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = placemark.getElementsByTagName('name')[0]?.textContent || '';
    const description = placemark.getElementsByTagName('description')[0]?.textContent || '';

    const lineString = placemark.getElementsByTagName('LineString')[0];
    const point = placemark.getElementsByTagName('Point')[0];

    if (lineString) {
      const coordinates = lineString.getElementsByTagName('coordinates')[0]?.textContent || '';
      const coords = coordinates.trim().split(/\s+/).map(coord => {
        const [lon, lat, alt] = coord.split(',').map(Number);
        return { lat, lon, alt: alt || 0 };
      }).filter(c => !isNaN(c.lat) && !isNaN(c.lon));

      if (coords.length > 0) {
        const geoJSON = {
          type: 'Feature',
          properties: {
            name,
            description
          },
          geometry: {
            type: 'LineString',
            coordinates: coords.map(c => [c.lon, c.lat, c.alt])
          }
        };

        const difficulty = determineDifficulty(name, description);
        const color = getDifficultyColor(difficulty);

        result.tracks.push({
          track_data: geoJSON,
          track_type: 'line',
          difficulty,
          color
        });
      }
    }

    if (point) {
      const coordinates = point.getElementsByTagName('coordinates')[0]?.textContent || '';
      const [lon, lat, alt] = coordinates.trim().split(',').map(Number);

      if (!isNaN(lat) && !isNaN(lon)) {
        const type = determinePOIType(name, description);

        result.pois.push({
          name,
          type,
          description,
          latitude: lat,
          longitude: lon,
          elevation: alt || 0
        });
      }
    }
  }

  if (result.tracks.length > 0) {
    result.metadata.total_distance = calculateTotalDistance(result.tracks);
  }

  return result;
};

export const parseGPX = async (filePath: string): Promise<ParsedRouteData> => {
  const gpxContent = fs.readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');

  const result: ParsedRouteData = {
    tracks: [],
    pois: [],
    metadata: {
      name: '',
      description: '',
      total_distance: 0
    }
  };

  const nameElement = gpxDoc.getElementsByTagName('name')[0];
  if (nameElement) {
    result.metadata.name = nameElement.textContent || '';
  }

  const descElement = gpxDoc.getElementsByTagName('desc')[0];
  if (descElement) {
    result.metadata.description = descElement.textContent || '';
  }

  const trkElements = gpxDoc.getElementsByTagName('trk');

  for (let i = 0; i < trkElements.length; i++) {
    const trk = trkElements[i];
    const name = trk.getElementsByTagName('name')[0]?.textContent || `Track ${i + 1}`;

    const trkSegs = trk.getElementsByTagName('trkseg');

    for (let j = 0; j < trkSegs.length; j++) {
      const trkSeg = trkSegs[j];
      const trkPts = trkSeg.getElementsByTagName('trkpt');

      const coords = [];
      for (let k = 0; k < trkPts.length; k++) {
        const pt = trkPts[k];
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lon = parseFloat(pt.getAttribute('lon') || '0');
        const ele = pt.getElementsByTagName('ele')[0]?.textContent || '0';

        if (!isNaN(lat) && !isNaN(lon)) {
          coords.push([lon, lat, parseFloat(ele)]);
        }
      }

      if (coords.length > 0) {
        const geoJSON = {
          type: 'Feature',
          properties: {
            name
          },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        };

        const difficulty = determineDifficulty(name, '');
        const color = getDifficultyColor(difficulty);

        result.tracks.push({
          track_data: geoJSON,
          track_type: 'line',
          difficulty,
          color
        });
      }
    }
  }

  const wptElements = gpxDoc.getElementsByTagName('wpt');

  for (let i = 0; i < wptElements.length; i++) {
    const wpt = wptElements[i];
    const lat = parseFloat(wpt.getAttribute('lat') || '0');
    const lon = parseFloat(wpt.getAttribute('lon') || '0');
    const name = wpt.getElementsByTagName('name')[0]?.textContent || `Waypoint ${i + 1}`;
    const desc = wpt.getElementsByTagName('desc')[0]?.textContent || '';
    const ele = wpt.getElementsByTagName('ele')[0]?.textContent || '0';

    if (!isNaN(lat) && !isNaN(lon)) {
      const type = determinePOIType(name, desc);

      result.pois.push({
        name,
        type,
        description: desc,
        latitude: lat,
        longitude: lon,
        elevation: parseFloat(ele)
      });
    }
  }

  if (result.tracks.length > 0) {
    result.metadata.total_distance = calculateTotalDistance(result.tracks);
  }

  return result;
};

const determineDifficulty = (name: string, description: string): string => {
  const text = (name + ' ' + description).toLowerCase();

  if (text.includes('困难') || text.includes('危险') || text.includes('hard') || text.includes('difficult')) {
    return 'hard';
  } else if (text.includes('中等') || text.includes('moderate') || text.includes('medium')) {
    return 'medium';
  } else if (text.includes('简单') || text.includes('easy')) {
    return 'easy';
  }

  return 'easy';
};

const getDifficultyColor = (difficulty: string): string => {
  switch (difficulty) {
    case 'hard':
      return '#FF0000';
    case 'medium':
      return '#FFFF00';
    case 'easy':
    default:
      return '#00FF00';
  }
};

const determinePOIType = (name: string, description: string): string => {
  const text = (name + ' ' + description).toLowerCase();

  if (text.includes('露营') || text.includes('camp')) return 'camping';
  if (text.includes('加油') || text.includes('fuel') || text.includes('gas')) return 'fuel';
  if (text.includes('水') || text.includes('water')) return 'water';
  if (text.includes('危险') || text.includes('danger') || text.includes('warning')) return 'danger';
  if (text.includes('风景') || text.includes('view') || text.includes('scenic')) return 'scenic';

  return 'poi';
};

const calculateTotalDistance = (tracks: any[]): number => {
  let totalDistance = 0;

  tracks.forEach(track => {
    const coords = track.track_data.geometry.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const [lon1, lat1] = coords[i - 1];
      const [lon2, lat2] = coords[i];

      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;
    }
  });

  return Math.round(totalDistance * 100) / 100;
};
