import { ar } from '../shared/i18n/ar';
import { TRAINEE_METHODS } from '../shared/ipc';
import type { ApiResult, TraineeApi, TrainerApi } from '../shared/types/api';

/** داخل البرنامج (Electron) توجد window.api. في متصفح جهاز آخر على الشبكة لا توجد. */
export const embedded = typeof window !== 'undefined' && 'api' in window && Boolean(window.api);

export const api: TrainerApi = embedded ? window.api : (null as unknown as TrainerApi);

/** واجهة المتدرب عبر HTTP لأجهزة الشبكة المحلية. */
function httpTraineeApi(): TraineeApi {
  const out: Record<string, unknown> = {};
  for (const method of TRAINEE_METHODS) {
    out[method] = async (...args: unknown[]): Promise<ApiResult<unknown>> => {
      try {
        const res = await fetch(`/api/trainee/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        return (await res.json()) as ApiResult<unknown>;
      } catch {
        return { ok: false, error: ar.trainee.connectionError };
      }
    };
  }
  out.imageUrl = (id: string) => `/img/${encodeURIComponent(id)}`;
  return out as unknown as TraineeApi;
}

export const traineeApi: TraineeApi = embedded ? window.api.trainee : httpTraineeApi();

/** يستخرج البيانات أو يرمي رسالة الخطأ العربية. */
export async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
