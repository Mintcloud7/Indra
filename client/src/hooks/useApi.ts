import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface UseApiOptions<T> {
  immediate?: boolean;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: () => Promise<void>;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const { immediate = true, initialData = null, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [fetcher, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, execute };
}

export function usePaginatedApi<T>(
  path: string,
  params: Record<string, string> = {},
  options: UseApiOptions<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> = {}
) {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const queryString = new URLSearchParams({ ...params, page: String(page), limit: String(limit) }).toString();

  const result = useApi(
    useCallback(() => api.get<{ data: T[]; total: number; page: number; limit: number; totalPages: number }>(`/${path}?${queryString}`), [path, queryString]),
    { immediate: true, ...options }
  );

  return {
    ...result,
    page,
    setPage,
  };
}
