import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { api } from '@/api/client';

/** Never send more often than this, however fast the device reports. */
const MIN_INTERVAL_MS = 4000;

/**
 * While `enabled`, watches the device position and reports it to the task so
 * the other person can follow along. Runs only while the service screen is open
 * (foreground): reliable background tracking needs a native background task,
 * which is out of scope for now.
 *
 * Returns whether the person refused the permission, so the screen can say so.
 */
export function useShareLocation(taskId: string, enabled: boolean): { denied: boolean } {
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let lastSent = 0;

    const report = (latitude: number, longitude: number) => {
      const now = Date.now();
      if (now - lastSent < MIN_INTERVAL_MS) return;
      lastSent = now;
      // A dropped update is harmless: the next one replaces it.
      api.post(`/tasks/${taskId}/location`, { latitude, longitude }).catch(() => undefined);
    };

    // Web: use the browser API directly. expo-location's web subscription throws
    // when removed (its event emitter lost `removeSubscription`), which would
    // crash the screen at the exact moment the service ends.
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setDenied(true);
        return;
      }
      setDenied(false);
      const watchId = navigator.geolocation.watchPosition(
        (p) => report(p.coords.latitude, p.coords.longitude),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) setDenied(true);
        },
        { enableHighAccuracy: false, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permission.status !== 'granted') {
        setDenied(true);
        return;
      }
      setDenied(false);
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (position) => report(position.coords.latitude, position.coords.longitude)
      );
      if (cancelled) sub.remove();
      else subscription = sub;
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [taskId, enabled]);

  return { denied };
}
