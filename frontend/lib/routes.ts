/**
 * Fetch driving routes from Mapbox Directions API.
 * Batches requests to stay within rate limits.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface RouteResult {
  coordinates: [number, number][]; // [lng, lat][]
  durationMinutes: number;
  distanceKm: number;
}

/**
 * Fetch a single driving route between two points.
 * Returns the route geometry as an array of [lng, lat] coordinates.
 */
async function fetchRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): Promise<RouteResult | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    return {
      coordinates: route.geometry.coordinates as [number, number][],
      durationMinutes: Math.round(route.duration / 60),
      distanceKm: Math.round(route.distance / 100) / 10,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch routes for multiple signals in parallel (throttled to 5 concurrent).
 * Returns a Map of signalId → route coordinates.
 */
export async function fetchRoutesForSignals(
  signals: { id: string; startLongitude: number; startLatitude: number }[],
  facilityLng: number,
  facilityLat: number,
): Promise<Map<string, { coordinates: [number, number][]; durationMinutes: number }>> {
  const results = new Map<string, { coordinates: [number, number][]; durationMinutes: number }>();

  // Process in batches of 3 with a small delay between batches to respect rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (signal) => {
      const route = await fetchRoute(
        signal.startLongitude,
        signal.startLatitude,
        facilityLng,
        facilityLat,
      );
      if (route) {
        results.set(signal.id, {
          coordinates: route.coordinates,
          durationMinutes: route.durationMinutes,
        });
      }
    });
    await Promise.all(promises);
    // Small delay between batches to avoid Mapbox rate limiting
    if (i + BATCH_SIZE < signals.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
