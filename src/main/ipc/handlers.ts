import { app, ipcMain } from 'electron';
import { z } from 'zod';
import { IPC } from '../../shared/ipc';
import type { ApiResult } from '../../shared/types/api';
import type { AuthService } from '../services/auth';
import type { BankService } from '../services/banks';

interface Services {
  auth: AuthService;
  banks: BankService;
  dataDir: string;
}

const passwordSchema = z.string().min(1).max(200);

/** يغلّف كل معالج: يتحقق من المدخلات ويحوّل الأخطاء إلى رسالة عربية بدل انهيار البرنامج. */
function handle<T>(channel: string, fn: (...args: unknown[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<ApiResult<T>> => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  });
}

export function registerHandlers({ auth, banks, dataDir }: Services): void {
  let loggedIn = false;
  const requireTrainer = () => {
    if (!loggedIn) throw new Error('يجب دخول المدرب أولًا');
  };

  handle(IPC.authStatus, () => ({ hasPassword: auth.hasPassword(), loggedIn }));
  handle(IPC.authSetup, (password) => {
    if (auth.hasPassword()) throw new Error('كلمة المرور موجودة مسبقًا');
    auth.setPassword(passwordSchema.parse(password));
    loggedIn = true;
    return null;
  });
  handle(IPC.authLogin, (password) => {
    if (!auth.verify(passwordSchema.parse(password))) throw new Error('كلمة المرور غير صحيحة');
    loggedIn = true;
    return null;
  });
  handle(IPC.authLogout, () => {
    loggedIn = false;
    return null;
  });
  handle(IPC.banksList, () => {
    requireTrainer();
    return banks.list();
  });
  handle(IPC.appInfo, () => ({ version: app.getVersion(), dataDir }));
}
