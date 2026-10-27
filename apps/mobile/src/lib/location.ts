import * as Location from 'expo-location';

import { t } from '@yourtime/shared-utils';
export interface Place {
  latitude: number;
  longitude: number;
  city?: string;
}

export class LocationError extends Error {
  constructor(
    message: string,
    readonly reason: 'denied' | 'unavailable'
  ) {
    super(message);
    this.name = 'LocationError';
  }
}

/** Asks for permission if needed and returns where the device is right now. */
export async function getCurrentPlace(): Promise<Place> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new LocationError(
      t('Necesitamos permiso para usar tu ubicación. Puedes activarlo en los ajustes.'),
      'denied'
    );
  }

  let position: Location.LocationObject;
  try {
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    throw new LocationError(
      t('No pudimos obtener tu ubicación. Revisa que el GPS esté activo.'),
      'unavailable'
    );
  }

  const { latitude, longitude } = position.coords;
  return { latitude, longitude, city: await reverseCity(latitude, longitude) };
}

async function reverseCity(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const [first] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return first?.city ?? first?.subregion ?? first?.region ?? undefined;
  } catch {
    // Reverse geocoding is unavailable on web and can fail offline; the
    // coordinates are what matter, the city is only a label.
    return undefined;
  }
}
