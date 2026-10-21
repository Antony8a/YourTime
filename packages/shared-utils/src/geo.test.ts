import { describe, expect, it } from 'vitest';
import {
  TILE_SIZE,
  distanceKm,
  downsample,
  etaMinutes,
  fitViewport,
  project,
  tileUrl,
  tilesFor,
  toScreen,
} from './geo';

const medellin = { latitude: 6.2442, longitude: -75.5812 };
const bogota = { latitude: 4.711, longitude: -74.0721 };

describe('distanceKm', () => {
  it('is zero for the same point, symmetric, and about right for Medellin-Bogota', () => {
    expect(distanceKm(medellin, medellin)).toBe(0);
    expect(distanceKm(medellin, bogota)).toBeCloseTo(distanceKm(bogota, medellin), 9);
    expect(distanceKm(medellin, bogota)).toBeGreaterThan(230);
    expect(distanceKm(medellin, bogota)).toBeLessThan(250);
  });
});

describe('etaMinutes', () => {
  it('rounds up small trips to one minute and returns 0 once arrived', () => {
    expect(etaMinutes(0)).toBe(0);
    expect(etaMinutes(0.03)).toBe(0);
    expect(etaMinutes(0.2)).toBe(1);
    expect(etaMinutes(5)).toBe(12);
    expect(etaMinutes(25, 50)).toBe(30);
  });
});

describe('project', () => {
  it('puts the equator/prime meridian in the middle of the world', () => {
    const p = project({ latitude: 0, longitude: 0 }, 1);
    expect(p.x).toBeCloseTo(TILE_SIZE, 6);
    expect(p.y).toBeCloseTo(TILE_SIZE, 6);
  });

  it('doubles the world every zoom level', () => {
    const a = project(medellin, 10);
    const b = project(medellin, 11);
    expect(b.x).toBeCloseTo(a.x * 2, 6);
    expect(b.y).toBeCloseTo(a.y * 2, 6);
  });

  it('clamps latitudes the projection cannot represent', () => {
    expect(Number.isFinite(project({ latitude: 90, longitude: 0 }, 4).y)).toBe(true);
  });
});

describe('fitViewport', () => {
  it('fits every point inside the padded view', () => {
    const v = fitViewport([medellin, bogota], 390, 300, 40);
    for (const p of [medellin, bogota]) {
      const s = toScreen(p, v);
      expect(s.x).toBeGreaterThanOrEqual(40 - 1);
      expect(s.x).toBeLessThanOrEqual(390 - 40 + 1);
      expect(s.y).toBeGreaterThanOrEqual(40 - 1);
      expect(s.y).toBeLessThanOrEqual(300 - 40 + 1);
    }
  });

  it('zooms in for nearby points and out for distant ones', () => {
    const near = fitViewport([medellin, { latitude: 6.2452, longitude: -75.5802 }], 390, 300);
    const far = fitViewport([medellin, bogota], 390, 300);
    expect(near.zoom).toBeGreaterThan(far.zoom);
  });

  it('uses the maximum zoom for a single point and centres it', () => {
    const v = fitViewport([medellin], 390, 300);
    expect(v.zoom).toBe(17);
    const s = toScreen(medellin, v);
    expect(s.x).toBeCloseTo(195, 6);
    expect(s.y).toBeCloseTo(150, 6);
  });

  it('never goes below the minimum zoom, even for antipodal points', () => {
    const v = fitViewport(
      [
        { latitude: 0, longitude: -170 },
        { latitude: 0, longitude: 170 },
      ],
      300,
      300
    );
    expect(v.zoom).toBeGreaterThanOrEqual(3);
  });
});

describe('tilesFor', () => {
  it('covers the whole viewport with no gaps', () => {
    const v = fitViewport([medellin, bogota], 390, 300);
    const tiles = tilesFor(v);
    expect(tiles.length).toBeGreaterThan(0);
    // Every screen corner must fall inside some tile.
    for (const [x, y] of [
      [0, 0],
      [389, 0],
      [0, 299],
      [389, 299],
    ] as const) {
      expect(
        tiles.some(
          (t) => x >= t.left && x < t.left + TILE_SIZE && y >= t.top && y < t.top + TILE_SIZE
        )
      ).toBe(true);
    }
  });

  it('keeps tile coordinates inside the world and wraps around the antimeridian', () => {
    const v = fitViewport([{ latitude: 0, longitude: 179.9 }], 600, 300, 10, 6);
    for (const t of tilesFor(v)) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(2 ** t.z);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(2 ** t.z);
    }
  });
});

describe('tileUrl', () => {
  it('fills the XYZ template', () => {
    expect(tileUrl('https://t.example/{z}/{x}/{y}.png', { x: 3, y: 5, z: 7 })).toBe(
      'https://t.example/7/3/5.png'
    );
  });
});

describe('downsample', () => {
  it('keeps first and last and respects the limit', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(pts, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
  });

  it('leaves short lists untouched', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
});
