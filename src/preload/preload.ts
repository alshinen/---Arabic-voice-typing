import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { TrainerApi } from '../shared/types/api';

const api: TrainerApi = {
  auth: {
    status: () => ipcRenderer.invoke(IPC.authStatus),
    setup: (password) => ipcRenderer.invoke(IPC.authSetup, password),
    login: (password) => ipcRenderer.invoke(IPC.authLogin, password),
    logout: () => ipcRenderer.invoke(IPC.authLogout),
  },
  banks: {
    list: () => ipcRenderer.invoke(IPC.banksList),
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
  },
};

contextBridge.exposeInMainWorld('api', api);
