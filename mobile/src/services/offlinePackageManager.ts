import * as FileSystem from 'expo-file-system/legacy';

const MBTILES_DIR = `${FileSystem.documentDirectory}mbtiles/`;

// Ensure directory exists
export const initOfflineManager = async () => {
  const dirInfo = await FileSystem.getInfoAsync(MBTILES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MBTILES_DIR, { intermediates: true });
  }
};

export const getMBTilesPath = (routeId: number): string => {
  return `${MBTILES_DIR}route_${routeId}.mbtiles`;
};

// Converts the local file URI to the native mbtiles:// protocol format
export const getMBTilesUri = (routeId: number): string => {
  const localPath = getMBTilesPath(routeId);
  return localPath.replace('file://', 'mbtiles://');
};

export const isMBTilesDownloaded = async (routeId: number): Promise<boolean> => {
  try {
    const path = getMBTilesPath(routeId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
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

  const downloadUrl = `${serverUrl}/api/routes/${routeId}/mbtiles`;
  const fileUri = getMBTilesPath(routeId);

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesExpectedToWrite !== -1 // Ensure we know total bytes
            ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
            : 0; // if unknown, can't calc percentage
        onProgress(Math.max(0, Math.min(progress, 1))); // clamp 0-1
      }
    );

    const result = await downloadResumable.downloadAsync();

    // Check if result exists and status is 200 (OK)
    if (result && result.status === 200) {
      return true;
    } else {
       // Cleanup failed download
       await deleteMBTiles(routeId);
       return false;
    }

  } catch (error) {
    console.error(`Error downloading MBTiles for route ${routeId}`, error);
    return false;
  }
};

export const deleteMBTiles = async (routeId: number): Promise<boolean> => {
  try {
    const path = getMBTilesPath(routeId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path);
    }
    return true;
  } catch (error) {
    console.error(`Error deleting MBTiles for route ${routeId}`, error);
    return false;
  }
};
