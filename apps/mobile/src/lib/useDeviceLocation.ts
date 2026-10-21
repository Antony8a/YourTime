import { useCallback, useState } from 'react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { getCurrentPlace, LocationError, type Place } from './location';

/**
 * Wraps "use my current location" with a loading flag and friendly errors.
 * Returns the place on success and null when it failed (a toast was shown).
 */
export function useDeviceLocation() {
  const { toast } = useFeedback();
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async (): Promise<Place | null> => {
    setLocating(true);
    try {
      return await getCurrentPlace();
    } catch (error) {
      toast(
        error instanceof LocationError ? error.message : 'No pudimos obtener tu ubicación.',
        'error'
      );
      return null;
    } finally {
      setLocating(false);
    }
  }, [toast]);

  return { locate, locating };
}
