import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';
import { fitViewport, tileUrl, tilesFor, toScreen, type LatLng } from '@yourtime/shared-utils';
import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Raster tiles drawn as plain images, so the map needs no native map SDK and no
 * API key, and looks the same on iOS, Android and web. The default is
 * OpenStreetMap's public server: fine for development, but its usage policy does
 * not allow heavy production traffic. Point EXPO_PUBLIC_TILE_URL at your own
 * tile server or a provider ({z}/{x}/{y} template) before launch.
 */
const TILE_TEMPLATE =
  process.env.EXPO_PUBLIC_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.EXPO_PUBLIC_TILE_ATTRIBUTION ?? '© OpenStreetMap';

interface RouteMapProps {
  height: number;
  destination: LatLng;
  /** Where the worker is right now. */
  worker: LatLng | null;
  /** The road route to draw, if one is available. */
  route: LatLng[] | null;
}

const key4 = (p: LatLng) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;

export function RouteMap({ height, destination, worker, route }: RouteMapProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  // Frame the journey once and keep it steady: the worker's marker moves
  // across a fixed map instead of the map lurching on every update.
  const firstWorker = useRef<LatLng | null>(null);
  if (worker && !firstWorker.current) firstWorker.current = worker;

  const framing = useMemo<LatLng[]>(() => {
    if (route && route.length > 1) return route;
    return firstWorker.current ? [firstWorker.current, destination] : [destination];
    // The route's endpoints identify it; its middle never changes the framing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    route && route.length > 1
      ? `${key4(route[0] as LatLng)}|${key4(route[route.length - 1] as LatLng)}`
      : null,
    key4(destination),
    !!worker,
  ]);

  const viewport = useMemo(
    () => (width > 0 ? fitViewport(framing, width, height, 56) : null),
    [framing, width, height]
  );
  const tiles = useMemo(() => (viewport ? tilesFor(viewport) : []), [viewport]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const at = (p: LatLng) => (viewport ? toScreen(p, viewport) : { x: 0, y: 0 });

  const line = (route && route.length > 1 ? route : worker ? [worker, destination] : [])
    .map((p) => at(p))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const hasRoadRoute = !!route && route.length > 1;

  const dest = at(destination);
  const wrk = worker ? at(worker) : null;

  return (
    <View
      onLayout={onLayout}
      style={[styles.map, { height, backgroundColor: colors.surfaceMuted }]}
      accessible
      accessibilityLabel="Mapa del servicio"
    >
      {tiles.map((t) => (
        <Image
          key={`${t.z}/${t.x}/${t.y}/${t.left}`}
          source={{
            uri: tileUrl(TILE_TEMPLATE, t),
            // Native HTTP clients should identify themselves to tile servers.
            ...(Platform.OS === 'web' ? {} : { headers: { 'User-Agent': 'YourTime/0.1' } }),
          }}
          accessibilityIgnoresInvertColors
          style={[styles.tile, { left: t.left, top: t.top }]}
        />
      ))}

      {viewport ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {line ? (
            <>
              {/* A white casing keeps the line readable over any map colour. */}
              <Polyline
                points={line}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={line}
                fill="none"
                stroke={colors.primary}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={hasRoadRoute ? undefined : '2 10'}
              />
            </>
          ) : null}
        </Svg>
      ) : null}

      {viewport ? (
        <>
          <View
            style={[styles.pinWrap, { left: dest.x - 18, top: dest.y - 40 }]}
            pointerEvents="none"
          >
            <View style={[styles.pin, { backgroundColor: colors.danger }]}>
              <Icon name="flag" size={16} color="#FFFFFF" />
            </View>
            <View style={[styles.pinTip, { borderTopColor: colors.danger }]} />
          </View>
          {wrk ? <WorkerMarker x={wrk.x} y={wrk.y} /> : null}
        </>
      ) : null}

      <View
        style={[styles.attribution, { backgroundColor: 'rgba(255,255,255,0.8)' }]}
        pointerEvents="none"
      >
        <Text variant="caption" style={styles.attributionText}>
          {ATTRIBUTION}
        </Text>
      </View>
    </View>
  );
}

/** The person travelling: a solid dot with a soft ring that pulses outward. */
function WorkerMarker({ x, y }: { x: number; y: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
      -1,
      false
    );
  }, [pulse, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.25 : 0.4 * (1 - pulse.value),
    transform: [{ scale: reduceMotion ? 1.6 : 1 + pulse.value * 2.2 }],
  }));

  return (
    <View style={[styles.workerWrap, { left: x - 22, top: y - 22 }]} pointerEvents="none">
      <Animated.View style={[styles.ring, { backgroundColor: colors.primary }, ring]} />
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', overflow: 'hidden' },
  tile: { position: 'absolute', width: 256, height: 256 },
  pinWrap: { position: 'absolute', width: 36, alignItems: 'center' },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pinTip: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  workerWrap: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#FFFFFF' },
  attribution: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  attributionText: { fontSize: 10, lineHeight: 12, color: '#333333' },
});
