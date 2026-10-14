/*
 * rawmouse: يقرأ حركة كل ماوس موصول بالكمبيوتر منفصلًا عبر Raw Input في ويندوز،
 * ويكتب الأحداث سطرًا سطرًا إلى المخرج القياسي (stdout) ليقرأها البرنامج.
 *
 * ويندوز يدمج كل الفئران في سهم واحد، لكن Raw Input يعطي لكل حدث معرّف جهازه،
 * فيستطيع البرنامج أن يرسم سهمًا مستقلًا لكل متدرب (docs/design.md القسم 7.2).
 *
 * صيغة الأسطر:
 *   N <id> <devicePath>                       أول ظهور لجهاز ماوس، مع مساره الثابت
 *   M <id> <dx> <dy> <buttonFlags> <wheel>    حركة نسبية وأزرار وعجلة
 *   A <id> <x> <y> <buttonFlags> <wheel>      حركة مطلقة (لوحات اللمس وبعض الأجهزة) 0..65535
 *
 * البناء: npm run build:native (يجرّب x86_64-w64-mingw32-gcc ثم gcc ثم cl).
 * برنامج طرفية (console) يُشغَّل مخفيًا (windowsHide) حتى تصل مخرجاته عبر الأنبوب.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <stdint.h>

#define MAX_KNOWN 64
static HANDLE known[MAX_KNOWN];
static int known_count = 0;

static void announce(HANDLE dev) {
  for (int i = 0; i < known_count; i++)
    if (known[i] == dev) return;
  if (known_count < MAX_KNOWN) known[known_count++] = dev;
  char name[512] = "";
  UINT size = sizeof(name);
  if (GetRawInputDeviceInfoA(dev, RIDI_DEVICENAME, name, &size) == (UINT)-1) name[0] = '\0';
  for (char *p = name; *p; p++)
    if (*p == ' ' || *p == '\n' || *p == '\r') *p = '_';
  printf("N %llu %s\n", (unsigned long long)(uintptr_t)dev, name[0] ? name : "unknown");
}

static LRESULT CALLBACK proc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  if (msg == WM_INPUT) {
    RAWINPUT raw;
    UINT size = sizeof(raw);
    if (GetRawInputData((HRAWINPUT)lp, RID_INPUT, &raw, &size, sizeof(RAWINPUTHEADER)) != (UINT)-1 &&
        raw.header.dwType == RIM_TYPEMOUSE && raw.header.hDevice != NULL) {
      RAWMOUSE *m = &raw.data.mouse;
      int wheel = (m->usButtonFlags & RI_MOUSE_WHEEL) ? (SHORT)m->usButtonData : 0;
      announce(raw.header.hDevice);
      printf("%c %llu %ld %ld %u %d\n", (m->usFlags & MOUSE_MOVE_ABSOLUTE) ? 'A' : 'M',
             (unsigned long long)(uintptr_t)raw.header.hDevice, m->lLastX, m->lLastY,
             (unsigned)m->usButtonFlags, wheel);
      fflush(stdout);
    }
    return DefWindowProcA(hwnd, msg, wp, lp);
  }
  if (msg == WM_DESTROY) {
    PostQuitMessage(0);
    return 0;
  }
  return DefWindowProcA(hwnd, msg, wp, lp);
}

int main(void) {
  HINSTANCE inst = GetModuleHandleA(NULL);
  WNDCLASSA wc = {0};
  wc.lpfnWndProc = proc;
  wc.hInstance = inst;
  wc.lpszClassName = "ArabicExamsRawMouse";
  if (!RegisterClassA(&wc)) return 1;
  /* نافذة مخفية لا تظهر أبدًا. RIDEV_INPUTSINK يستقبل الأحداث حتى والنافذة غير نشطة. */
  HWND hwnd = CreateWindowExA(0, wc.lpszClassName, "rawmouse", WS_OVERLAPPED, 0, 0, 0, 0, NULL, NULL, inst, NULL);
  if (!hwnd) return 2;
  RAWINPUTDEVICE rid;
  rid.usUsagePage = 0x01; /* Generic Desktop */
  rid.usUsage = 0x02;     /* Mouse */
  rid.dwFlags = RIDEV_INPUTSINK;
  rid.hwndTarget = hwnd;
  if (!RegisterRawInputDevices(&rid, 1, sizeof(rid))) return 3;
  printf("READY\n");
  fflush(stdout);
  MSG msg;
  while (GetMessageA(&msg, NULL, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageA(&msg);
  }
  return 0;
}
