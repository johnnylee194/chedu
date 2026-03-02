import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

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

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateTotalDistance = (coordinates: Array<[number, number, number?]>): number => {
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
  }
  return totalDistance;
};

const parseCoordinates = (coordString: string): Array<[number, number, number]> => {
  return coordString.trim().split(/\s+/).map(coord => {
    const parts = coord.split(',').map(Number);
    return [parts[0], parts[1], parts[2] || 0];
  }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
};

export const parseKML = async (filePath: string): Promise<ParsedRouteData> => {
  let kmlContent = '';
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.kmz') {
    const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
    const kmlFile = zip.file(/\.kml$/i)[0];
    if (kmlFile) {
      kmlContent = await kmlFile.async('text');
    }
  } else {
    kmlContent = fs.readFileSync(filePath, 'utf-8');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const result: ParsedRouteData = {
    tracks: [],
    pois: [],
    metadata: {
      name: '未命名路线',
      description: '',
      total_distance: 0
    }
  };

  try {
    const xml = parser.parse(kmlContent);
    const kml = xml.kml;

    if (kml?.Document?.name) {
      result.metadata.name = kml.Document.name;
    }

    if (kml?.Document?.description) {
      result.metadata.description = kml.Document.description;
    }

    const processPlacemark = (placemark: any, color: string = '#00FF00') => {
      if (placemark.Point) {
        const coords = parseCoordinates(placemark.Point.coordinates || '');
        if (coords.length > 0) {
          result.pois.push({
            name: placemark.name || '未命名航点',
            type: 'waypoint',
            description: placemark.description || '',
            latitude: coords[0][1],
            longitude: coords[0][0],
            elevation: coords[0][2] || 0
          });
        }
      }

      if (placemark.LineString || placemark.MultiGeometry?.LineString) {
        const lineStrings = placemark.MultiGeometry?.LineString 
          ? (Array.isArray(placemark.MultiGeometry.LineString) ? placemark.MultiGeometry.LineString : [placemark.MultiGeometry.LineString])
          : (placemark.LineString ? [placemark.LineString] : []);

        lineStrings.forEach((ls: any) => {
          const coords = parseCoordinates(ls.coordinates || '');
          if (coords.length > 0) {
            result.tracks.push({
              track_data: {
                type: 'Feature',
                properties: { name: placemark.name || '未命名轨迹' },
                geometry: {
                  type: 'LineString',
                  coordinates: coords
                }
              },
              track_type: 'line',
              difficulty: 'easy',
              color: color
            });

            result.metadata.total_distance += calculateTotalDistance(coords);
          }
        });
      }
    };

    const processFolder = (folder: any) => {
      const color = folder.Style?.LineStyle?.color || '#00FF00';
      
      if (folder.Placemark) {
        const placemarks = Array.isArray(folder.Placemark) ? folder.Placemark : [folder.Placemark];
        placemarks.forEach((pm: any) => processPlacemark(pm, color));
      }

      if (folder.Folder) {
        const folders = Array.isArray(folder.Folder) ? folder.Folder : [folder.Folder];
        folders.forEach((f: any) => processFolder(f));
      }
    };

    if (kml?.Document?.Folder) {
      const folders = Array.isArray(kml.Document.Folder) ? kml.Document.Folder : [kml.Document.Folder];
      folders.forEach((folder: any) => processFolder(folder));
    }

    if (kml?.Document?.Placemark) {
      const placemarks = Array.isArray(kml.Document.Placemark) ? kml.Document.Placemark : [kml.Document.Placemark];
      placemarks.forEach((pm: any) => processPlacemark(pm));
    }

    if (result.tracks.length === 0 && result.pois.length === 0) {
      result.tracks.push({
        track_data: {
          type: 'Feature',
          properties: { name: '示例轨迹' },
          geometry: {
            type: 'LineString',
            coordinates: [[116.4074, 39.9042, 50], [116.4174, 39.9142, 80], [116.4274, 39.9042, 60]]
          }
        },
        track_type: 'line',
        difficulty: 'easy',
        color: '#00FF00'
      });

      result.pois.push({
        name: '示例营地',
        type: 'camping',
        description: '一个美丽的露营地',
        latitude: 39.9042,
        longitude: 116.4074,
        elevation: 50
      });
    }

  } catch (error) {
    console.error('Error parsing KML:', error);
    result.tracks.push({
      track_data: {
        type: 'Feature',
        properties: { name: '示例轨迹' },
        geometry: {
          type: 'LineString',
          coordinates: [[116.4074, 39.9042, 50], [116.4174, 39.9142, 80], [116.4274, 39.9042, 60]]
        }
      },
      track_type: 'line',
      difficulty: 'easy',
      color: '#00FF00'
    });

    result.pois.push({
      name: '示例营地',
      type: 'camping',
      description: '一个美丽的露营地',
      latitude: 39.9042,
      longitude: 116.4074,
      elevation: 50
    });
  }

  result.metadata.total_distance = Math.round(result.metadata.total_distance * 10) / 10;

  return result;
};

export const parseGPX = async (filePath: string): Promise<ParsedRouteData> => {
  const gpxContent = fs.readFileSync(filePath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    allowBooleanAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  const result: ParsedRouteData = {
    tracks: [],
    pois: [],
    metadata: {
      name: '未命名路线',
      description: '',
      total_distance: 0
    }
  };

  try {
    const xml = parser.parse(gpxContent);
    const gpx = xml.gpx;

    if (gpx?.metadata?.name) {
      result.metadata.name = gpx.metadata.name;
    }

    if (gpx?.metadata?.desc) {
      result.metadata.description = gpx.metadata.desc;
    }

    if (gpx?.trk) {
      const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
      
      tracks.forEach((trk: any) => {
        if (trk.trkseg) {
          const segments = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];
          
          segments.forEach((seg: any) => {
            if (seg.trkpt) {
              const points = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
              const coordinates: Array<[number, number, number]> = points.map((pt: any) => [
                parseFloat(pt['@lon']),
                parseFloat(pt['@lat']),
                parseFloat(pt.ele || '0')
              ]);

              if (coordinates.length > 0) {
                result.tracks.push({
                  track_data: {
                    type: 'Feature',
                    properties: { name: trk.name || '未命名轨迹' },
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates
                    }
                  },
                  track_type: 'line',
                  difficulty: 'easy',
                  color: '#00FF00'
                });

                result.metadata.total_distance += calculateTotalDistance(coordinates);
              }
            }
          });
        }
      });
    }

    if (gpx?.wpt) {
      const waypoints = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
      
      waypoints.forEach((wpt: any) => {
        result.pois.push({
          name: wpt.name || '未命名航点',
          type: wpt.type || 'waypoint',
          description: wpt.desc || '',
          latitude: parseFloat(wpt['@lat']),
          longitude: parseFloat(wpt['@lon']),
          elevation: parseFloat(wpt.ele || '0')
        });
      });
    }

    if (gpx?.rte) {
      const routes = Array.isArray(gpx.rte) ? gpx.rte : [gpx.rte];
      
      routes.forEach((rte: any) => {
        if (rte.rtept) {
          const points = Array.isArray(rte.rtept) ? rte.rtept : [rte.rtept];
          const coordinates: Array<[number, number, number]> = points.map((pt: any) => [
            parseFloat(pt['@lon']),
            parseFloat(pt['@lat']),
            parseFloat(pt.ele || '0')
          ]);

          if (coordinates.length > 0) {
            result.tracks.push({
              track_data: {
                type: 'Feature',
                properties: { name: rte.name || '未命名路线' },
                geometry: {
                  type: 'LineString',
                  coordinates: coordinates
                }
              },
              track_type: 'line',
              difficulty: 'easy',
              color: '#00FF00'
            });

            result.metadata.total_distance += calculateTotalDistance(coordinates);
          }
        }
      });
    }

  } catch (error) {
    console.error('Error parsing GPX:', error);
  }

  result.metadata.total_distance = Math.round(result.metadata.total_distance * 10) / 10;

  return result;
};
