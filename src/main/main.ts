import { app, BrowserWindow, Menu, dialog } from 'electron';
import path from 'node:path';
import { AppDatabase } from './db/database';
import { registerHandlers } from './ipc/handlers';
import { AuthService } from './services/auth';
import { BankService } from './services/banks';

/** مسار ملف sql-wasm.wasm، داخل التطبيق المثبّت أو أثناء التطوير. */
function wasmPath(): string {
  return require.resolve('sql.js/dist/sql-wasm.wasm').replace('app.asar', 'app.asar.unpacked');
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'برنامج الاختبارات',
    backgroundColor: '#f6f7f9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  // منع فتح أي روابط أو نوافذ خارجية من داخل البرنامج.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  void win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  const dataDir = app.getPath('userData');
  try {
    const db = await AppDatabase.open(path.join(dataDir, 'data.sqlite'), wasmPath());
    registerHandlers({ auth: new AuthService(db), banks: new BankService(db), dataDir });
  } catch (err) {
    dialog.showErrorBox('تعذّر فتح قاعدة البيانات', err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on('window-all-closed', () => app.quit());
void bootstrap();
