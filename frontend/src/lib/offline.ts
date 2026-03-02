import { openDB } from 'idb';

const DB_NAME = 'chedu-offline';
const DB_VERSION = 1;

export interface OfflineRoute {
  id: number;
  data: any;
  cachedAt: number;
}

export interface OfflineTile {
  url: string;
  data: Blob;
  cachedAt: number;
}

export const offlineDB = {
  async open() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('routes')) {
          db.createObjectStore('routes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tiles')) {
          db.createObjectStore('tiles', { keyPath: 'url' });
        }
      },
    });
  },

  async saveRoute(route: OfflineRoute) {
    const db = await this.open();
    await db.put('routes', route);
  },

  async getRoute(id: number): Promise<OfflineRoute | undefined> {
    const db = await this.open();
    return db.get('routes', id);
  },

  async getAllRoutes(): Promise<OfflineRoute[]> {
    const db = await this.open();
    return db.getAll('routes');
  },

  async saveTile(tile: OfflineTile) {
    const db = await this.open();
    await db.put('tiles', tile);
  },

  async getTile(url: string): Promise<OfflineTile | undefined> {
    const db = await this.open();
    return db.get('tiles', url);
  },

  async clearOldRoutes(maxAge: number = 7 * 24 * 60 * 60 * 1000) {
    const db = await this.open();
    const routes = await db.getAll('routes');
    const now = Date.now();

    for (const route of routes) {
      if (now - route.cachedAt > maxAge) {
        await db.delete('routes', route.id);
      }
    }
  },

  async clearOldTiles(maxAge: number = 30 * 24 * 60 * 60 * 1000) {
    const db = await this.open();
    const tiles = await db.getAll('tiles');
    const now = Date.now();

    for (const tile of tiles) {
      if (now - tile.cachedAt > maxAge) {
        await db.delete('tiles', tile.url);
      }
    }
  },
};
