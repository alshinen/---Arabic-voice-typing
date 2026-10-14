import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import path from 'node:path';
import { computeSeatLayout, type SeatBinding } from '../../shared/seats';
import type { AppDatabase } from '../db/database';
import { parseJson } from '../services/util';
import { MouseSource } from './mouseSource';

const seatContents = new Set<number>();

/** هل الطلب جاء من نافذة المقعدين؟ (دوال المدرب ممنوعة منها) */
export function isSeatSender(webContentsId: number): boolean {
  return seatContents.has(webContentsId);
}

/** مسار rawmouse.exe داخل البرنامج المغلّف أو أثناء التطوير. */
function rawMousePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'rawmouse.exe')
    : path.join(__dirname, '..', '..', '..', '..', 'native', 'bin', 'rawmouse.exe');
}

/**
 * وضع المقعدين (design.md 7.2): نافذة واحدة تغطي الشاشتين، والنصف الأيمن للمتدرب الأول
 * والأيسر للثاني. كل ماوس يُقرأ منفصلًا ويُرسم له سهم خاص داخل مقعده.
 * الخروج: Ctrl+Shift+Q. إعادة ربط الفأرين: Ctrl+Shift+R.
 */
export class SeatManager {
  private win: BrowserWindow | null = null;
  readonly mice: MouseSource;

  constructor(
    private readonly db: AppDatabase,
    private readonly preload: string,
    private readonly indexHtml: string,
  ) {
    this.mice = new MouseSource(rawMousePath());
    this.mice.on('mouse', (e) => this.win?.webContents.send('seats:mouse', e));
    this.mice.on('devices', (d) => this.win?.webContents.send('seats:devices', d));

    ipcMain.handle('seats:layout', () => ({
      ...computeSeatLayout(screen.getAllDisplays().map((d) => d.bounds)),
      speed: this.speed,
    }));
    ipcMain.handle('seats:devices', () => this.mice.deviceList);
    ipcMain.handle('seats:binding', () => this.binding);
    ipcMain.handle('seats:saveBinding', (_e, b: SeatBinding) => {
      this.db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        'seat_binding',
        JSON.stringify({ A: b?.A ?? null, B: b?.B ?? null }),
      ]);
      return null;
    });
  }

  get supported(): boolean {
    return this.mice.supported;
  }

  get binding(): SeatBinding {
    const row = this.db.get<{ value: string }>("SELECT value FROM setting WHERE key = 'seat_binding'");
    return parseJson<SeatBinding>(row?.value, { A: null, B: null });
  }

  get speed(): number {
    const row = this.db.get<{ value: string }>("SELECT value FROM setting WHERE key = 'seat_speed'");
    const v = Number(row?.value ?? 1);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }

  setSpeed(v: number): void {
    if (!(v >= 0.25 && v <= 4)) throw new Error('السرعة يجب أن تكون بين 0.25 و4');
    this.db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
      'seat_speed',
      String(v),
    ]);
  }

  get running(): boolean {
    return this.win !== null;
  }

  open(): void {
    if (this.win) {
      this.win.focus();
      return;
    }
    this.mice.start();
    const layout = computeSeatLayout(screen.getAllDisplays().map((d) => d.bounds));
    const win = new BrowserWindow({
      ...layout.window,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#f4f6f9',
      title: 'وضع المقعدين',
      show: false,
      webPreferences: { preload: this.preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    this.win = win;
    const id = win.webContents.id;
    seatContents.add(id);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.once('ready-to-show', () => {
      win.setBounds(layout.window);
      win.show();
      win.focus();
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const combo = input.control && input.shift;
      if (combo && input.key.toLowerCase() === 'q') {
        event.preventDefault();
        win.close();
      } else if (combo && input.key.toLowerCase() === 'r') {
        event.preventDefault();
        win.webContents.send('seats:rebind');
      }
    });
    // اختصار عام أيضًا، يعمل حتى لو لم تكن نافذة المقعدين هي النشطة.
    globalShortcut.register('CommandOrControl+Shift+Q', () => this.win?.close());
    globalShortcut.register('CommandOrControl+Shift+R', () => this.win?.webContents.send('seats:rebind'));
    win.on('closed', () => {
      globalShortcut.unregister('CommandOrControl+Shift+Q');
      globalShortcut.unregister('CommandOrControl+Shift+R');
      seatContents.delete(id);
      this.win = null;
      this.mice.stop();
    });
    void win.loadFile(this.indexHtml, { hash: 'seats' });
  }

  close(): void {
    this.win?.close();
  }
}
