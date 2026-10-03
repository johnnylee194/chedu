import { XMLParser } from 'fast-xml-parser';
import { FeatureCollection, LineString } from 'geojson';

export class RouteParserService {
  private static parseCoordinatesString(coordsStr: string): number[][] {
    return coordsStr
      .trim()
      .split(/\s+/)
      .map((coord) => {
        const [lon, lat, ele] = coord.split(',').map(Number);
        if (!isNaN(lon) && !isNaN(lat)) {
          return [lon, lat, isNaN(ele) ? 0 : ele];
        }
        return null;
      })
      .filter((coord) => coord !== null) as number[][];
  }

  static parseKML(kmlContent: string): FeatureCollection<LineString> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const parsed = parser.parse(kmlContent);
    const features: any[] = [];

    const processPlacemark = (placemark: any) => {
      let coordsStr = '';
      if (placemark.LineString?.coordinates) {
        coordsStr = placemark.LineString.coordinates;
      } else if (placemark.MultiGeometry?.LineString) {
        const ls = Array.isArray(placemark.MultiGeometry.LineString)
          ? placemark.MultiGeometry.LineString[0]
          : placemark.MultiGeometry.LineString;
        if (ls?.coordinates) coordsStr = ls.coordinates;
      }

      if (coordsStr) {
        const coordinates = RouteParserService.parseCoordinatesString(coordsStr);
        if (coordinates.length > 0) {
          features.push({
            type: 'Feature',
            properties: {
              name: placemark.name || 'Unnamed Route',
            },
            geometry: {
              type: 'LineString',
              coordinates,
            },
          });
        }
      }
    };

    const processFolder = (folder: any) => {
      if (folder.Placemark) {
        const placemarks = Array.isArray(folder.Placemark)
          ? folder.Placemark
          : [folder.Placemark];
        placemarks.forEach(processPlacemark);
      }
      if (folder.Folder) {
        const folders = Array.isArray(folder.Folder) ? folder.Folder : [folder.Folder];
        folders.forEach(processFolder);
      }
    };

    const kml = parsed.kml;
    if (kml?.Document?.Folder) {
      const folders = Array.isArray(kml.Document.Folder)
        ? kml.Document.Folder
        : [kml.Document.Folder];
      folders.forEach(processFolder);
    }
    if (kml?.Document?.Placemark) {
      const placemarks = Array.isArray(kml.Document.Placemark)
        ? kml.Document.Placemark
        : [kml.Document.Placemark];
      placemarks.forEach(processPlacemark);
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  static parseGPX(gpxContent: string): FeatureCollection<LineString> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const parsed = parser.parse(gpxContent);
    const features: any[] = [];
    const gpx = parsed.gpx;

    if (gpx?.trk) {
      const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
      tracks.forEach((trk: any) => {
        if (trk.trkseg) {
          const segments = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];
          segments.forEach((seg: any) => {
            if (seg.trkpt) {
              const points = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
              const coordinates = points.map((pt: any) => [
                Number(pt['@_lon'] || 0),
                Number(pt['@_lat'] || 0),
                Number(pt.ele || 0),
              ]);

              if (coordinates.length > 0) {
                features.push({
                  type: 'Feature',
                  properties: {
                    name: trk.name || 'Unnamed Route',
                  },
                  geometry: {
                    type: 'LineString',
                    coordinates,
                  },
                });
              }
            }
          });
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  static parseContent(content: string, fileName: string): FeatureCollection<LineString> | null {
    try {
      if (fileName.toLowerCase().endsWith('.gpx')) {
        return RouteParserService.parseGPX(content);
      } else if (fileName.toLowerCase().endsWith('.kml')) {
        return RouteParserService.parseKML(content);
      }
      return null;
    } catch (error) {
      console.error('Error parsing route file:', error);
      return null;
    }
  }
}
