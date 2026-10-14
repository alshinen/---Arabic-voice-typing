import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { TRAINEE_METHODS } from '../../shared/ipc';
import type { ApiResult, LanStatus } from '../../shared/types/api';
import type { AttemptService } from '../services/attempts';
import type { ImageService } from '../services/images';
import { callTrainee } from '../ipc/trainee';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

const MAX_BODY = 1024 * 1024;

/**
 * خادم الشبكة المحلية (design.md القسم 7، الطريقة أ): يقدّم واجهة المتدرب فقط
 * لأجهزة الشبكة، ولا يكشف أي دالة من دوال المدرب.
 */
export class LanServer {
  private server: http.Server | null = null;
  private port = 8080;

  constructor(
    private readonly rendererDir: string,
    private readonly attempts: AttemptService,
    private readonly images: ImageService,
  ) {}

  status(): LanStatus {
    return { running: this.server !== null, port: this.port, urls: this.server ? localUrls(this.port) : [] };
  }

  async start(port: number): Promise<LanStatus> {
    if (this.server) return this.status();
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('رقم المنفذ غير صالح');
    const server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      server.once('error', (err: NodeJS.ErrnoException) =>
        reject(new Error(err.code === 'EADDRINUSE' ? `المنفذ ${port} مستخدم، جرّب منفذًا آخر` : err.message)),
      );
      server.listen(port, '0.0.0.0', () => resolve());
    });
    this.server = server;
    this.port = port;
    return this.status();
  }

  async stop(): Promise<LanStatus> {
    const s = this.server;
    this.server = null;
    if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
    return this.status();
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://local');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.method === 'POST' && url.pathname.startsWith('/api/trainee/')) {
        const method = url.pathname.slice('/api/trainee/'.length);
        if (!(TRAINEE_METHODS as readonly string[]).includes(method)) return send(res, 404, { ok: false, error: 'غير موجود' });
        const args = JSON.parse((await readBody(req)) || '[]') as unknown[];
        if (!Array.isArray(args)) return send(res, 400, { ok: false, error: 'طلب غير صالح' });
        const device = `شبكة ${req.socket.remoteAddress ?? ''}`.trim();
        return send(res, 200, callTrainee(this.attempts, method, args, device));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
        const file = this.images.filePath(decodeURIComponent(url.pathname.slice(5)));
        return file ? sendFile(res, file) : send(res, 404, { ok: false, error: 'الصورة غير موجودة' });
      }
      if (req.method === 'GET') {
        const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
        const file = path.resolve(this.rendererDir, rel);
        if (!file.startsWith(path.resolve(this.rendererDir) + path.sep) || !fs.existsSync(file)) {
          return send(res, 404, { ok: false, error: 'غير موجود' });
        }
        return sendFile(res, file);
      }
      send(res, 405, { ok: false, error: 'طلب غير مسموح' });
    } catch (err) {
      send(res, 400, { ok: false, error: err instanceof Error ? err.message : 'طلب غير صالح' });
    }
  }
}

function send(res: http.ServerResponse, status: number, body: ApiResult<unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendFile(res: http.ServerResponse, file: string): void {
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('الطلب كبير جدًا'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** عناوين هذا الجهاز في الشبكة المحلية، ليكتبها المتدرب في المتصفح. */
export function localUrls(port: number): string[] {
  const urls: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === 'IPv4' && !i.internal) urls.push(`http://${i.address}:${port}`);
    }
  }
  return urls;
}
