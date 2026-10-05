import { parseGPX, parseKML } from '../src/utils/parser';
import * as fs from 'fs';
import * as path from 'path';

const tempDir = path.join(__dirname, 'temp');

beforeAll(() => {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
});

afterAll(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('RouteParserService', () => {
  it('should parse GPX correctly', async () => {
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Test">
      <trk>
        <name>Test Track</name>
        <trkseg>
          <trkpt lat="40.0" lon="-105.0"><ele>1000</ele></trkpt>
          <trkpt lat="40.1" lon="-105.1"><ele>1100</ele></trkpt>
          <trkpt lat="40.2" lon="-105.2"><ele>1050</ele></trkpt>
        </trkseg>
      </trk>
      <wpt lat="40.0" lon="-105.0">
        <name>Start</name>
      </wpt>
    </gpx>`;

    const filePath = path.join(tempDir, 'test.gpx');
    fs.writeFileSync(filePath, gpxContent);

    const result = await parseGPX(filePath);

    expect(result.geojson.type).toBe('FeatureCollection');
    expect(result.geojson.features.length).toBe(2); // 1 track + 1 wpt

    const lineStringFeature = result.geojson.features.find((f: any) => f.geometry.type === 'LineString');
    expect(lineStringFeature).toBeDefined();
    expect((lineStringFeature?.geometry as any).coordinates.length).toBe(3);

    expect(result.metadata.total_ascent).toBe(100);
    expect(result.metadata.total_descent).toBe(50);
    expect(result.metadata.total_distance).toBeGreaterThan(0);
    expect(result.metadata.bbox).toHaveLength(4);
  });

  it('should parse KML correctly', async () => {
    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>Test KML</name>
        <Placemark>
          <name>Track</name>
          <LineString>
            <coordinates>
              -105.0,40.0,1000
              -105.1,40.1,1100
              -105.2,40.2,1050
            </coordinates>
          </LineString>
        </Placemark>
      </Document>
    </kml>`;

    const filePath = path.join(tempDir, 'test.kml');
    fs.writeFileSync(filePath, kmlContent);

    const result = await parseKML(filePath);

    expect(result.metadata.name).toBe('Test KML');
    expect(result.geojson.type).toBe('FeatureCollection');
    expect(result.geojson.features.length).toBe(1);

    const lineStringFeature = result.geojson.features[0];
    expect(lineStringFeature.geometry.type).toBe('LineString');
    expect((lineStringFeature.geometry as any).coordinates.length).toBe(3);

    expect(result.metadata.total_ascent).toBe(100);
    expect(result.metadata.total_descent).toBe(50);
    expect(result.metadata.total_distance).toBeGreaterThan(0);
    expect(result.metadata.bbox).toHaveLength(4);
  });
});
