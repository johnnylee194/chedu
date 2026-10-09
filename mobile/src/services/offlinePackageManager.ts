import { File, Directory, Paths } from 'expo-file-system';

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

  const downloadUrl = `${serverUrl}/api/routes/${routeId}/mbtiles`;
  const file = new File(getMBTilesDir(), `route_${routeId}.mbtiles`);

  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : -1;
    let receivedBytes = 0;

    if (response.body) {
      const reader = response.body.getReader();
      const writer = file.writableStream().getWriter();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          await writer.write(value);
          receivedBytes += value.length;
          if (totalBytes !== -1) {
             onProgress(Math.max(0, Math.min(receivedBytes / totalBytes, 1)));
          }
        }
      }

      await writer.close();

      if (totalBytes === -1) {
         onProgress(1);
      }
    } else {
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      file.write(new Uint8Array(buffer));
      onProgress(1);
    }

    return true;
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
