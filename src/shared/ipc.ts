/** أسماء قنوات الاتصال بين الواجهة والعملية الرئيسية. */
export const IPC = {
  authStatus: 'auth:status',
  authSetup: 'auth:setup',
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  banksList: 'banks:list',
  appInfo: 'app:info',
} as const;
