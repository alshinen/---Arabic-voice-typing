import type { ApiResult } from '../../shared/types/api';
import type { AttemptService } from '../services/attempts';

const str = (v: unknown): string => {
  if (typeof v !== 'string' || !v) throw new Error('طلب غير صالح');
  return v;
};

/**
 * دوال المتدرب، مشتركة بين IPC داخل البرنامج وHTTP عبر الشبكة.
 * لا تكشف أي إجابة صحيحة (invariant 7)، ولا تقبل محاولات المعاينة من الشبكة.
 */
export function callTrainee(attempts: AttemptService, method: string, args: unknown[], device: string | null): ApiResult<unknown> {
  try {
    return { ok: true, data: dispatch(attempts, method, args, device) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function dispatch(attempts: AttemptService, method: string, args: unknown[], device: string | null): unknown {
  switch (method) {
    case 'exams':
      return attempts.availableExams();
    case 'pickList':
      return attempts.pickList(str(args[0]));
    case 'lookup':
      return attempts.lookupNumber(str(args[0]));
    case 'start':
      return attempts.start(str(args[0]), (args[1] ?? {}) as object, { device });
    case 'state':
      return attempts.state(str(args[0]));
    case 'submitTry':
      return attempts.submitTry(str(args[0]), str(args[1]), args[2]);
    case 'acceptBest':
      return attempts.acceptBest(str(args[0]), str(args[1]));
    case 'finish':
      return attempts.finish(str(args[0]));
    default:
      throw new Error('غير موجود');
  }
}
