import { useQuery } from '@tanstack/react-query';
import { downsample, type LatLng } from '@yourtime/shared-utils';

/**
 * Road routing via an OSRM-compatible server. The default is the public demo
 * server, which is fine for development but is NOT meant for production traffic
 * and receives the worker's coordinates and the destination. For production run
 * your own OSRM/Valhalla or use a routing provider, and set EXPO_PUBLIC_ROUTING_URL.
 * If routing fails the map falls back to a straight line, so it never blocks.
 */
const ROUTING_URL = (
  process.env.EXPO_PUBLIC_ROUTING_URL ?? 'https://router.project-osrm.org'
).replace(/\/$/, '');

export interface RouteResult {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
}

interface OsrmResponse {
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
}

export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal
): Promise<RouteResult | null> {
  const url =
    `${ROUTING_URL}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    '?overview=full&geometries=geojson';
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const json = (await response.json()) as OsrmResponse;
    const route = json.routes?.[0];
    if (!route) return null;
    const path = route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    }));
    return {
      // Plenty for a smooth line, and keeps the SVG light.
      path: downsample(path, 250),
      distanceKm: route.distance / 1000,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return null;
  }
}

const round = (n: number, decimals: number) => n.toFixed(decimals);

/**
 * The road route from `from` to `to`, refreshed as `from` moves about 100 m. It
 * resolves to null (not an error) when routing is unavailable.
 */
export function useRoute(
  from: LatLng | null | undefined,
  to: LatLng | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: [
      'route',
      from ? `${round(from.latitude, 3)},${round(from.longitude, 3)}` : null,
      to ? `${round(to.latitude, 5)},${round(to.longitude, 5)}` : null,
    ],
    queryFn: ({ signal }) => fetchRoute(from as LatLng, to as LatLng, signal),
    enabled: enabled && !!from && !!to,
    staleTime: 30_000,
    retry: false,
    // Keep drawing the previous route while the next one loads: no flicker.
    placeholderData: (previous) => previous,
  });
}
