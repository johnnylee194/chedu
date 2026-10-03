import { RouteParserService } from '../src/services/RouteParserService';

describe('RouteParserService', () => {
  const mockGpx = `
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Mock">
      <trk>
        <name>Test Route GPX</name>
        <trkseg>
          <trkpt lat="40.7128" lon="-74.0060">
            <ele>10</ele>
          </trkpt>
          <trkpt lat="40.7129" lon="-74.0061">
            <ele>12</ele>
          </trkpt>
        </trkseg>
      </trk>
    </gpx>
  `;

  const mockKml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <Placemark>
          <name>Test Route KML</name>
          <LineString>
            <coordinates>
              -74.0060,40.7128,10
              -74.0061,40.7129,12
            </coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>
  `;

  it('should parse GPX correctly', () => {
    const result = RouteParserService.parseContent(mockGpx, 'test.gpx');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.type).toBe('FeatureCollection');
      expect(result.features.length).toBe(1);

      const feature = result.features[0];
      expect(feature.properties?.name).toBe('Test Route GPX');
      expect(feature.geometry.type).toBe('LineString');
      expect(feature.geometry.coordinates).toEqual([
        [-74.0060, 40.7128, 10],
        [-74.0061, 40.7129, 12]
      ]);
    }
  });

  it('should parse KML correctly', () => {
    const result = RouteParserService.parseContent(mockKml, 'test.kml');
    expect(result).not.toBeNull();
    if (result) {
      expect(result.type).toBe('FeatureCollection');
      expect(result.features.length).toBe(1);

      const feature = result.features[0];
      expect(feature.properties?.name).toBe('Test Route KML');
      expect(feature.geometry.type).toBe('LineString');
      expect(feature.geometry.coordinates).toEqual([
        [-74.0060, 40.7128, 10],
        [-74.0061, 40.7129, 12]
      ]);
    }
  });

  it('should return null for unknown file extension', () => {
    const result = RouteParserService.parseContent(mockGpx, 'test.txt');
    expect(result).toBeNull();
  });
});
