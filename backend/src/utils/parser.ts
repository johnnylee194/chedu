import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import * as turf from '@turf/turf';

export interface ParsedRouteData {
  geojson: import("geojson").FeatureCollection;
  metadata: {
    name: string;
    description: string;
    total_distance: number; // km
    total_ascent: number; // m
    total_descent: number; // m
    bbox: [number, number, number, number] | null;
  };
}

const parseCoordinates = (coordString: string): Array<[number, number, number]> => {
  return coordString.trim().split(/\s+/).map(coord => {
    const parts = coord.split(',').map(Number);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0] as [number, number, number];
  }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
};

const calculateMetrics = (features: import("geojson").Feature<any>[]) => {
  let totalDistance = 0;
  let totalAscent = 0;
  let totalDescent = 0;

  for (const feature of features) {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      for (let i = 1; i < coords.length; i++) {
        const p1 = coords[i - 1];
        const p2 = coords[i];

        // Calculate distance
        totalDistance += turf.distance(turf.point(p1), turf.point(p2), { units: 'kilometers' });

        // Calculate elevation change
        if (p1.length > 2 && p2.length > 2) {
          const eleDiff = p2[2] - p1[2];
          if (eleDiff > 0) {
            totalAscent += eleDiff;
          } else {
            totalDescent += Math.abs(eleDiff);
          }
        }
      }
    }
  }

  return { totalDistance, totalAscent, totalDescent };
};

export const parseKML = async (filePath: string): Promise<ParsedRouteData> => {
  let kmlContent = '';
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.kmz' || ext === '.ovkml') {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const kmlFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
    if (!kmlFile) throw new Error('No KML file found in KMZ/OVKML archive');
    kmlContent = await zip.files[kmlFile].async('string');
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

  const features: import("geojson").Feature[] = [];
  const originalFileName = path.basename(filePath, path.extname(filePath));
  // attempt utf8 decode just in case
  let decodedName = originalFileName;
  try {
     decodedName = decodeURIComponent(escape(originalFileName));
  } catch (e) {}

  const metadata = { name: decodedName || 'Unnamed Route', description: '', total_distance: 0, total_ascent: 0, total_descent: 0, bbox: null as any };

  try {
    const xml = parser.parse(kmlContent);
    const kml = xml.kml;

    // Look for name anywhere near the top
    const docName = kml?.Document?.name || kml?.Folder?.name || kml?.Placemark?.name;
    if (docName && typeof docName === 'string') {
        metadata.name = docName;
    }

    if (kml?.Document?.description) metadata.description = kml.Document.description;

    const processPlacemark = (placemark: any, color: string = '#00FF00') => {
      if (placemark.Point) {
        const coords = parseCoordinates(placemark.Point.coordinates || '');
        if (coords.length > 0) {
          features.push(turf.point(coords[0], {
            name: placemark.name || 'Unnamed Waypoint',
            description: placemark.description || '',
            type: 'waypoint'
          }));
        }
      }

      if (placemark.LineString || placemark.MultiGeometry?.LineString) {
        const lineStrings = placemark.MultiGeometry?.LineString 
          ? (Array.isArray(placemark.MultiGeometry.LineString) ? placemark.MultiGeometry.LineString : [placemark.MultiGeometry.LineString])
          : (placemark.LineString ? [placemark.LineString] : []);

        lineStrings.forEach((ls: any) => {
          const coords = parseCoordinates(ls.coordinates || '');
          if (coords.length > 1) {
            features.push(turf.lineString(coords, {
              name: placemark.name || 'Unnamed Track',
              color: color
            }));
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
  } catch (error) {
    console.error('Error parsing KML', error);
  }

  const featureCollection = turf.featureCollection(features);
  const metrics = calculateMetrics(features);

  metadata.total_distance = Math.round(metrics.totalDistance * 10) / 10;
  metadata.total_ascent = Math.round(metrics.totalAscent);
  metadata.total_descent = Math.round(metrics.totalDescent);

  if (features.length > 0) {
     metadata.bbox = turf.bbox(featureCollection) as [number, number, number, number];
  }

  return { geojson: featureCollection, metadata };
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

  const features: import("geojson").Feature[] = [];
  const metadata = { name: 'Unnamed Route', description: '', total_distance: 0, total_ascent: 0, total_descent: 0, bbox: null as any };

  try {
    const xml = parser.parse(gpxContent);
    const gpx = xml.gpx;

    if (gpx?.metadata?.name) metadata.name = gpx.metadata.name;
    if (gpx?.metadata?.desc) metadata.description = gpx.metadata.desc;

    if (gpx?.trk) {
      const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
      
      tracks.forEach((trk: any) => {
        if (trk.trkseg) {
          const segments = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];
          
          segments.forEach((seg: any) => {
            if (seg.trkpt) {
              const points = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
              const coordinates: Array<[number, number, number]> = points.map((pt: any) => [
                parseFloat(pt['@lon']) || 0,
                parseFloat(pt['@lat']) || 0,
                parseFloat(pt.ele || '0') || 0
              ] as [number, number, number]);

              if (coordinates.length > 1) {
                features.push(turf.lineString(coordinates, {
                   name: trk.name || 'Unnamed Track',
                   color: '#00FF00'
                }));
              }
            }
          });
        }
      });
    }

    if (gpx?.wpt) {
      const waypoints = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
      
      waypoints.forEach((wpt: any) => {
        features.push(turf.point([
            parseFloat(wpt['@lon']) || 0,
            parseFloat(wpt['@lat']) || 0,
            parseFloat(wpt.ele || '0') || 0
        ], {
            name: wpt.name || 'Unnamed Waypoint',
            description: wpt.desc || '',
            type: wpt.type || 'waypoint'
        }));
      });
    }

    if (gpx?.rte) {
      const routes = Array.isArray(gpx.rte) ? gpx.rte : [gpx.rte];
      
      routes.forEach((rte: any) => {
        if (rte.rtept) {
          const points = Array.isArray(rte.rtept) ? rte.rtept : [rte.rtept];
          const coordinates: Array<[number, number, number]> = points.map((pt: any) => [
            parseFloat(pt['@lon']) || 0,
            parseFloat(pt['@lat']) || 0,
            parseFloat(pt.ele || '0') || 0
          ] as [number, number, number]);

          if (coordinates.length > 1) {
             features.push(turf.lineString(coordinates, {
                name: rte.name || 'Unnamed Route',
                color: '#00FF00'
             }));
          }
        }
      });
    }
  } catch (error) {
    console.error('Error parsing GPX:', error);
  }

  const featureCollection = turf.featureCollection(features);
  const metrics = calculateMetrics(features);

  metadata.total_distance = Math.round(metrics.totalDistance * 10) / 10;
  metadata.total_ascent = Math.round(metrics.totalAscent);
  metadata.total_descent = Math.round(metrics.totalDescent);

  if (features.length > 0) {
      metadata.bbox = turf.bbox(featureCollection) as [number, number, number, number];
  }

  return { geojson: featureCollection, metadata };
};
