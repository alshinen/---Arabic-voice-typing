import { app, BrowserWindow, dialog, Menu, net, protocol } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IMAGE_SCHEME } from '../shared/ipc';
import { AppDatabase } from './db/database';
import { registerHandlers } from './ipc/handlers';
import { LanServer } from './server/lan';
import { AttemptService } from './services/attempts';
import { AuthService } from './services/auth';
import { BankService } from './services/banks';
import { CourseService } from './services/courses';
import { ExamService } from './services/exams';
import { ImageService } from './services/images';
import { QuestionService } from './services/questions';
import { ReadyListService } from './services/readyLists';
import { ResultService } from './services/results';
import { TraineeService } from './services/trainees';
import { TransferService } from './services/transfer';

/**
 * مكان حفظ البيانات. يعمل البرنامج من الفلاش: البيانات في مجلد ExamsData بجانب البرنامج،
 * فتنتقل معه إلى أي كمبيوتر بالإعدادات والأسئلة نفسها. إن تعذّرت الكتابة هناك تُحفظ في مجلد المستخدم.
 */
function resolveDataDir(): { dir: string; portable: boolean } {
  const base =
    process.env.PORTABLE_EXECUTABLE_DIR ?? (app.isPackaged ? path.dirname(process.execPath) : null);
  if (base) {
    const dir = path.join(base, 'ExamsData');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return { dir, portable: true };
    } catch {
      /* مجلد للقراءة فقط: نكمل إلى مجلد المستخدم */
    }
  }
  return { dir: path.join(app.getPath('userData'), 'ExamsData'), portable: false };
}

/** مسار ملف sql-wasm.wasm، داخل البرنامج المغلّف أو أثناء التطوير. */
function wasmPath(): string {
  return require.resolve('sql.js/dist/sql-wasm.wasm').replace('app.asar', 'app.asar.unpacked');
}

const rendererDir = path.join(__dirname, '..', '..', 'renderer');

protocol.registerSchemesAsPrivileged([
  { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
// ملفات المتصفح المؤقتة لا تُكتب على الفلاش.
app.setPath('sessionData', path.join(os.tmpdir(), 'arabic-exams-session'));

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
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  void win.loadFile(path.join(rendererDir, 'index.html'));
}

async function bootstrap(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });
  await app.whenReady();
  Menu.setApplicationMenu(null);
  const { dir: dataDir, portable } = resolveDataDir();
  try {
    const dbFile = path.join(dataDir, 'data.sqlite');
    const imagesDir = path.join(dataDir, 'images');
    const db = await AppDatabase.open(dbFile, wasmPath());
    const questions = new QuestionService(db);
    const exams = new ExamService(db);
    const trainees = new TraineeService(db);
    const images = new ImageService(db, imagesDir);
    const attempts = new AttemptService({ db, questions, exams, trainees });
    attempts.cleanupPreviews();

    protocol.handle(IMAGE_SCHEME, (req) => {
      const id = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ''));
      const file = images.filePath(id);
      return file ? net.fetch(pathToFileURL(file).toString()) : new Response('', { status: 404 });
    });

    const lan = new LanServer(rendererDir, attempts, images);
    registerHandlers({
      auth: new AuthService(db),
      banks: new BankService(db),
      questions,
      readyLists: new ReadyListService(db),
      images,
      courses: new CourseService(db),
      trainees,
      exams,
      attempts,
      results: new ResultService(db),
      transfer: new TransferService(db, dbFile, imagesDir),
      lan,
      dataDir,
      portable,
    });
    app.on('before-quit', () => void lan.stop());
  } catch (err) {
    dialog.showErrorBox('تعذّر فتح بيانات البرنامج', err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }
  createWindow();
}

app.on('window-all-closed', () => app.quit());
void bootstrap();
