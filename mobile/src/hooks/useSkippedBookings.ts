// mobile/src/hooks/useSkippedBookings.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { skippedBookingsStorage } from '@/services/storage/skippedBookingsStorage';

/** Clients laissés de côté par le conducteur sur ce trajet (voir driverJourney.ts), conservés sur le téléphone. */
export function useSkippedBookings(tripId: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    skippedBookingsStorage.get(tripId).then((stored) => {
      if (!cancelled) setIds(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const update = useCallback(
    (change: (current: string[]) => string[]) => {
      setIds((current) => {
        const next = change(current);
        void skippedBookingsStorage.set(tripId, next);
        return next;
      });
    },
    [tripId],
  );

  const skip = useCallback((bookingId: string) => update((current) => (current.includes(bookingId) ? current : [...current, bookingId])), [update]);
  const unskipAll = useCallback(() => update(() => []), [update]);
  const skipped = useMemo(() => new Set(ids), [ids]);

  return { skipped, skip, unskipAll };
}
