/**
 * أسماء قنوات الاتصال بين الواجهة والعملية الرئيسية.
 * كل قناة اسمها «مجموعة:دالة» مطابق لمسار الدالة في TrainerApi.
 */
export const IPC_METHODS = {
  auth: ['status', 'setup', 'login', 'logout', 'change'],
  banks: ['list'],
  questions: ['list', 'get', 'save', 'copy', 'archive', 'gradePreview'],
  readyLists: ['list', 'save', 'remove'],
  images: ['list', 'add', 'rename', 'remove'],
  courses: ['list', 'saveCourse', 'archiveCourse', 'saveLesson', 'removeLesson'],
  trainees: ['list', 'save', 'remove', 'importCsv'],
  exams: ['list', 'get', 'save', 'setStatus', 'setOpen', 'remove', 'problems', 'availability', 'bankQuestions', 'previewStart', 'previewDiscard'],
  results: ['list', 'detail', 'exportCsv', 'grantExtra'],
  data: ['info', 'backup', 'restore', 'exportResults', 'importResults', 'openFolder', 'seatsInfo', 'seatsOpen', 'seatsSpeed'],
  lan: ['status', 'start', 'stop'],
  trainee: ['exams', 'pickList', 'lookup', 'start', 'state', 'submitTry', 'acceptBest', 'finish'],
} as const;

/** دوال المتدرب المتاحة عبر الشبكة المحلية (لا شيء من دوال المدرب). */
export const TRAINEE_METHODS = IPC_METHODS.trainee;

export const IMAGE_SCHEME = 'exam-img';
