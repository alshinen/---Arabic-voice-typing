import type { BankKind, QuestionType } from './domain';

export interface BankSummary {
  id: string;
  kind: BankKind;
  name: string;
  gradeCode: string | null;
  countsByType: Record<QuestionType, number>;
  total: number;
}

/** نتيجة موحدة لكل استدعاء من الواجهة: نجاح مع بيانات، أو رسالة خطأ بالعربية. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** الواجهة التي يكشفها preload للواجهة الرسومية في window.api. */
export interface TrainerApi {
  auth: {
    status(): Promise<ApiResult<{ hasPassword: boolean; loggedIn: boolean }>>;
    setup(password: string): Promise<ApiResult<null>>;
    login(password: string): Promise<ApiResult<null>>;
    logout(): Promise<ApiResult<null>>;
  };
  banks: {
    list(): Promise<ApiResult<BankSummary[]>>;
  };
  app: {
    info(): Promise<ApiResult<{ version: string; dataDir: string }>>;
  };
}
