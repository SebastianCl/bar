import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { normalizeError, type AppError } from '../lib/errors';

export function useResource<T>(loader: () => Promise<T>, resourceKey = 'default') {
  const load = useEffectEvent(loader);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void load()
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((caught) => {
        if (active) setError(normalizeError(caught));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision, resourceKey]);

  return { data, error, isLoading, reload, setData };
}
