// @ts-ignore
import { createDownloadResumable } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { File, Directory, Paths } from 'expo-file-system';
import { getToken } from './authService';

const getMBTilesDir = (): Directory => {
  return new Directory(Paths.document, 'mbtiles');
};

// Ensure directory exists
export const initOfflineManager = async () => {
  const dir = getMBTilesDir();
  if (!dir.exists) {
    dir.create();
  }
};

export const getMBTilesPath = (routeId: number): string => {
  const dir = getMBTilesDir();
  const file = new File(dir, `route_${routeId}.mbtiles`);
  return file.uri;
};

// Converts the local file URI to the native mbtiles:// protocol format
export const getMBTilesUri = (routeId: number): string => {
  const localPath = getMBTilesPath(routeId);
  return localPath.replace('file://', 'mbtiles://');
};

export const isMBTilesDownloaded = async (routeId: number): Promise<boolean> => {
  try {
    const dir = getMBTilesDir();
    const file = new File(dir, `route_${routeId}.mbtiles`);
    return file.exists;
  } catch (error) {
    console.error('Error checking MBTiles status', error);
    return false;
  }
};

export const downloadMBTiles = async (
  serverUrl: string,
  routeId: number,
  onProgress: (progress: number) => void
): Promise<boolean> => {
  await initOfflineManager();
  let downloadUrl = `${serverUrl}/api/routes/${routeId}/mbtiles`;

  const token = await getToken();
  if (token) {
    // Append token query param for download authorization
    downloadUrl += `?token=${token}`;
  }

  const file = new File(getMBTilesDir(), `route_${routeId}.mbtiles`);

  try {
    const downloadResumable = createDownloadResumable(
      downloadUrl,
      file.uri,
      {},
      (downloadProgress: any) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress(Math.max(0, Math.min(progress, 1))); // safely clamp
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result && result.status === 200) {
      onProgress(1);
      try {
        const fileInfo = await FileSystem.getInfoAsync(file.uri);
        if (fileInfo.exists) {
          console.log(`[Offline Package] Download Complete. Path: ${file.uri}, Size: ${fileInfo.size} bytes`);
        }
      } catch (e) {
        console.error('[Offline Package] File check failed', e);
      }
      return true;
    } else {
      throw new Error(`Download failed with status ${result?.status}`);
    }
  } catch (error) {
    console.error(`Error downloading MBTiles for route ${routeId}`, error);
    await deleteMBTiles(routeId);
    return false;
  }
};

export const deleteMBTiles = async (routeId: number): Promise<boolean> => {
  try {
    const dir = getMBTilesDir();
    const file = new File(dir, `route_${routeId}.mbtiles`);
    if (file.exists) {
      file.delete();
    }
    return true;
  } catch (error) {
    console.error(`Error deleting MBTiles for route ${routeId}`, error);
    return false;
  }
};
