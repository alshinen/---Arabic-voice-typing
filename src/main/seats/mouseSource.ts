import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import readline from 'node:readline';
import { parseRawLine, RI_LEFT_DOWN, RI_LEFT_UP, type MouseDevice, type MouseEventMsg } from '../../shared/seats';

const FLUSH_MS = 8;

/**
 * يشغّل rawmouse.exe ويحوّل مخرجاته إلى أحداث: devices و mouse.
 * الحركات تُجمع كل 8 أجزاء من الثانية حتى لا تُغرق الواجهة، والأزرار والعجلة تُرسل فورًا.
 * ARABIC_EXAMS_RAWMOUSE يسمح باستبدال القارئ بأمر آخر (للاختبار على غير ويندوز).
 */
export class MouseSource extends EventEmitter {
  private child: ChildProcess | null = null;
  private readonly devices = new Map<string, MouseDevice>();
  private readonly pending = new Map<string, { dx: number; dy: number }>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly exePath: string) {
    super();
  }

  static command(exePath: string): { cmd: string; args: string[] } | null {
    const override = process.env.ARABIC_EXAMS_RAWMOUSE;
    if (override) {
      const [cmd, ...args] = override.split(' ');
      return { cmd: cmd!, args };
    }
    if (process.platform === 'win32' && fs.existsSync(exePath)) return { cmd: exePath, args: [] };
    return null;
  }

  get supported(): boolean {
    return MouseSource.command(this.exePath) !== null;
  }

  get deviceList(): MouseDevice[] {
    return [...this.devices.values()];
  }

  start(): void {
    if (this.child) return;
    const c = MouseSource.command(this.exePath);
    if (!c) throw new Error('وضع المقعدين يحتاج ويندوز وملف rawmouse.exe');
    const child = spawn(c.cmd, c.args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    this.child = child;
    child.on('exit', () => {
      if (this.child === child) this.child = null;
      this.emit('exit');
    });
    readline.createInterface({ input: child.stdout! }).on('line', (line) => {
      const parsed = parseRawLine(line);
      if (!parsed) return;
      if (parsed.kind === 'device') {
        this.devices.set(parsed.device.id, parsed.device);
        this.emit('devices', this.deviceList);
      } else this.handle(parsed.event);
    });
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
  }

  private handle(e: MouseEventMsg): void {
    if (e.absolute) {
      this.flush(e.id);
      this.emit('mouse', e);
      return;
    }
    const p = this.pending.get(e.id) ?? { dx: 0, dy: 0 };
    p.dx += e.dx;
    p.dy += e.dy;
    this.pending.set(e.id, p);
    if (e.buttons & (RI_LEFT_DOWN | RI_LEFT_UP) || e.wheel) {
      this.flush(e.id);
      this.emit('mouse', { ...e, dx: 0, dy: 0 });
    }
  }

  private flush(only?: string): void {
    for (const [id, p] of this.pending) {
      if (only && id !== only) continue;
      if (p.dx || p.dy) this.emit('mouse', { id, dx: p.dx, dy: p.dy, absolute: false, buttons: 0, wheel: 0 } satisfies MouseEventMsg);
      this.pending.delete(id);
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.child?.kill();
    this.child = null;
    this.pending.clear();
  }
}
