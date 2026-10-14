// يبني native/bin/rawmouse.exe (قارئ الفئران المنفصلة لوضع المقعدين في ويندوز).
// يجرّب المترجمات المتوفرة بالترتيب. إن لم يوجد مترجم يُكمل البناء دون وضع المقعدين.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'native', 'rawmouse', 'rawmouse.c');
const outDir = path.join(__dirname, '..', 'native', 'bin');
const out = path.join(outDir, 'rawmouse.exe');
fs.mkdirSync(outDir, { recursive: true });

const candidates = [
  `x86_64-w64-mingw32-gcc -O2 -Wall -o "${out}" "${src}" -luser32`,
  process.platform === 'win32' ? `gcc -O2 -Wall -o "${out}" "${src}" -luser32` : null,
  process.platform === 'win32' ? `cl /nologo /O2 /Fe:"${out}" "${src}" user32.lib` : null,
].filter(Boolean);

for (const cmd of candidates) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`rawmouse.exe: ${cmd.split(' ')[0]}`);
    process.exit(0);
  } catch {
    /* جرّب المترجم التالي */
  }
}
console.warn('تحذير: لم يُعثر على مترجم C، فلن يعمل وضع المقعدين (ماوسان) في هذا البناء.');
