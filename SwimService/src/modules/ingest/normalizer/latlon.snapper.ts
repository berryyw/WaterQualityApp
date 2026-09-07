export interface SnappedLatLon {
  snappedLatitude: number;
  snappedLongitude: number;
}

export function snapLatLon(
  latitude: number | string,
  longitude: number | string,
  precision = 4,
): SnappedLatLon {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lon = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(
      `[LatLonSnapper] Invalid coordinate: latitude=${latitude}, longitude=${longitude}`,
    );
  }
  const pow = 10 ** precision;
  return {
    snappedLatitude: Math.round((lat + Number.EPSILON) * pow) / pow,
    snappedLongitude: Math.round((lon + Number.EPSILON) * pow) / pow,
  };
}
