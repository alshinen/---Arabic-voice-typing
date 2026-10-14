import { useCallback, useEffect, useState } from 'react';
import type { ApiResult } from '../shared/types/api';

/** يستدعي دالة من window.api ويعرض حالة التحميل والخطأ. */
export function useApi<T>(call: () => Promise<ApiResult<T>>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await call();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
