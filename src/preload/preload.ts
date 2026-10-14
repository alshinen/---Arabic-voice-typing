import { contextBridge, ipcRenderer } from 'electron';
import { IMAGE_SCHEME, IPC_METHODS } from '../shared/ipc';

/** يبني window.api تلقائيًا من قائمة القنوات: كل دالة تستدعي «مجموعة:دالة» في العملية الرئيسية. */
const api: Record<string, Record<string, unknown>> = {};
for (const [group, methods] of Object.entries(IPC_METHODS)) {
  api[group] = {};
  for (const method of methods) {
    api[group][method] = (...args: unknown[]) => ipcRenderer.invoke(`${group}:${method}`, ...args);
  }
}
api.trainee!.imageUrl = (id: string) => `${IMAGE_SCHEME}://image/${encodeURIComponent(id)}`;

contextBridge.exposeInMainWorld('api', api);
