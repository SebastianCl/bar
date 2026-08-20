import { useEffect, useRef } from 'react';

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'bar:last-activity-at';
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;

export function useInactivityLogout(enabled: boolean, onTimeout: () => void): void {
  const callbackRef = useRef(onTimeout);
  useEffect(() => {
    callbackRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }

    let hasTimedOut = false;
    let lastWrite = 0;

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWrite = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    };

    const checkInactivity = () => {
      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      const lastActivity = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
      if (!hasTimedOut && Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        hasTimedOut = true;
        callbackRef.current();
      }
    };

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) recordActivity();
    const activityEvents: Array<keyof WindowEventMap> = [
      'keydown',
      'pointerdown',
      'touchstart',
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );
    window.addEventListener('focus', checkInactivity);
    const interval = window.setInterval(checkInactivity, 15_000);

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, recordActivity),
      );
      window.removeEventListener('focus', checkInactivity);
      window.clearInterval(interval);
    };
  }, [enabled]);
}
