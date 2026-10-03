export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateTotalDistance = (coordinates: Array<[number, number, number?]>): number => {
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
  }
  return totalDistance;
};

export const parseCoordinates = (coordString: string): Array<[number, number, number]> => {
  return coordString.trim().split(/\s+/).map(coord => {
    const parts = coord.split(',').map(Number);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0] as [number, number, number];
  }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));
};
