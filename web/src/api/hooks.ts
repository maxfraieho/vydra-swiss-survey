import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './client';

export interface UseResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useResource<T>(endpoint: string | null): UseResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(endpoint));
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<T>(endpoint);
      setData(res);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export interface UsePollingOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export function usePolling<T>(
  endpoint: string | null,
  options: UsePollingOptions = {}
): UseResourceResult<T> {
  const { enabled = true, intervalMs = 3000 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(endpoint));
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!endpoint || !enabled) return;
    if (document.hidden) return; // Pause polling when tab is hidden (§4.5)

    try {
      const res = await apiFetch<T>(endpoint);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled]);

  useEffect(() => {
    if (!enabled || !endpoint) return;

    fetchData();

    const timer = setInterval(() => {
      fetchData();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [endpoint, enabled, intervalMs, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
