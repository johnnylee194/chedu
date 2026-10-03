import * as FileSystem from 'expo-file-system';
import { FeatureCollection, LineString } from 'geojson';
import bbox from '@turf/bbox';

export interface RouteIndexEntry {
  id: string;
  name: string;
  createdAt: number;
  bbox?: number[];
}

export class RouteStorageService {
  private static readonly ROUTES_DIR = `${FileSystem.documentDirectory}routes/`;
  private static readonly INDEX_FILE = `${FileSystem.documentDirectory}routes-index.json`;

  static async init(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(RouteStorageService.ROUTES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(RouteStorageService.ROUTES_DIR, { intermediates: true });
    }
    const indexInfo = await FileSystem.getInfoAsync(RouteStorageService.INDEX_FILE);
    if (!indexInfo.exists) {
      await FileSystem.writeAsStringAsync(RouteStorageService.INDEX_FILE, JSON.stringify([]));
    }
  }

  static async getIndex(): Promise<RouteIndexEntry[]> {
    try {
      await RouteStorageService.init();
      const content = await FileSystem.readAsStringAsync(RouteStorageService.INDEX_FILE);
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read routes index', error);
      return [];
    }
  }

  static async saveIndex(index: RouteIndexEntry[]): Promise<void> {
    await FileSystem.writeAsStringAsync(RouteStorageService.INDEX_FILE, JSON.stringify(index));
  }

  static async saveRoute(featureCollection: FeatureCollection<LineString>, name: string = 'Unnamed Route'): Promise<RouteIndexEntry> {
    await RouteStorageService.init();

    const id = Date.now().toString();
    const filePath = `${RouteStorageService.ROUTES_DIR}${id}.geojson`;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(featureCollection));

    let routeBbox: number[] | undefined;
    try {
       routeBbox = bbox(featureCollection as any);
    } catch (e) {
       console.warn('Failed to calculate bbox for route', e);
    }

    const entry: RouteIndexEntry = {
      id,
      name,
      createdAt: Date.now(),
      bbox: routeBbox
    };

    const index = await RouteStorageService.getIndex();
    index.push(entry);
    await RouteStorageService.saveIndex(index);

    return entry;
  }

  static async loadRoute(id: string): Promise<FeatureCollection<LineString> | null> {
    const filePath = `${RouteStorageService.ROUTES_DIR}${id}.geojson`;
    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load route ${id}`, error);
      return null;
    }
  }

  static async deleteRoute(id: string): Promise<void> {
    const filePath = `${RouteStorageService.ROUTES_DIR}${id}.geojson`;
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      const index = await RouteStorageService.getIndex();
      const newIndex = index.filter(entry => entry.id !== id);
      await RouteStorageService.saveIndex(newIndex);
    } catch (error) {
      console.error(`Failed to delete route ${id}`, error);
    }
  }
}
