/**
 * Geographic helpers shared by every client: distances, ETA and the Web
 * Mercator maths needed to draw a map out of plain tiles (no map SDK).
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. Mirrors the backend's haversine. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Average speed assumed when no routing service gave a real duration. */
export const FALLBACK_SPEED_KMH = 25;

/**
 * Whole minutes to cover `km`, never less than 1 while there is still distance
 * to cover. Used only when the routing service did not provide a duration.
 */
export function etaMinutes(km: number, speedKmh = FALLBACK_SPEED_KMH): number {
  if (km <= 0.05) return 0;
  return Math.max(1, Math.round((km / speedKmh) * 60));
}

// ---- Web Mercator / slippy-map tiles ----------------------------------------

export const TILE_SIZE = 256;
const MAX_LAT = 85.0511287798;

/** World pixel position of a coordinate at a zoom level. */
export function project(p: LatLng, zoom: number): { x: number; y: number } {
  const size = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.latitude));
  const sin = Math.sin(toRad(lat));
  return {
    x: ((p.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export interface Viewport {
  zoom: number;
  /** World pixel of the viewport's top-left corner. */
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * The highest zoom (up to maxZoom) at which every point fits inside
 * width x height with `padding` pixels to spare, centred on their bounding box.
 * A single point (or points that coincide) gets maxZoom.
 */
export function fitViewport(
  points: LatLng[],
  width: number,
  height: number,
  padding = 40,
  maxZoom = 17,
  minZoom = 3
): Viewport {
  const usableW = Math.max(1, width - padding * 2);
  const usableH = Math.max(1, height - padding * 2);

  for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
    const px = points.map((p) => project(p, zoom));
    const minX = Math.min(...px.map((p) => p.x));
    const maxX = Math.max(...px.map((p) => p.x));
    const minY = Math.min(...px.map((p) => p.y));
    const maxY = Math.max(...px.map((p) => p.y));
    if (maxX - minX <= usableW && maxY - minY <= usableH) {
      return viewportAt(zoom, (minX + maxX) / 2, (minY + maxY) / 2, width, height);
    }
  }
  const px = points.map((p) => project(p, minZoom));
  const cx = px.reduce((s, p) => s + p.x, 0) / px.length;
  const cy = px.reduce((s, p) => s + p.y, 0) / px.length;
  return viewportAt(minZoom, cx, cy, width, height);
}

function viewportAt(zoom: number, cx: number, cy: number, width: number, height: number): Viewport {
  return { zoom, originX: cx - width / 2, originY: cy - height / 2, width, height };
}

/** Where a coordinate lands on screen inside a viewport. */
export function toScreen(p: LatLng, v: Viewport): { x: number; y: number } {
  const w = project(p, v.zoom);
  return { x: w.x - v.originX, y: w.y - v.originY };
}

export interface TilePlacement {
  /** Tile coordinates, with x wrapped around the antimeridian. */
  x: number;
  y: number;
  z: number;
  /** Where to draw its top-left corner on screen. */
  left: number;
  top: number;
}

/** Every tile needed to cover the viewport. */
export function tilesFor(v: Viewport): TilePlacement[] {
  const tiles = 2 ** v.zoom;
  const firstX = Math.floor(v.originX / TILE_SIZE);
  const lastX = Math.floor((v.originX + v.width) / TILE_SIZE);
  const firstY = Math.floor(v.originY / TILE_SIZE);
  const lastY = Math.floor((v.originY + v.height) / TILE_SIZE);

  const out: TilePlacement[] = [];
  for (let ty = firstY; ty <= lastY; ty++) {
    if (ty < 0 || ty >= tiles) continue;
    for (let tx = firstX; tx <= lastX; tx++) {
      out.push({
        x: ((tx % tiles) + tiles) % tiles,
        y: ty,
        z: v.zoom,
        left: tx * TILE_SIZE - v.originX,
        top: ty * TILE_SIZE - v.originY,
      });
    }
  }
  return out;
}

/** Fills an XYZ template such as https://tile.example/{z}/{x}/{y}.png. */
export function tileUrl(template: string, t: Pick<TilePlacement, 'x' | 'y' | 'z'>): string {
  return template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y));
}

/** Keeps at most `max` evenly spaced points, always including the first and last. */
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max || max < 2) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)] as T);
  return out;
}
