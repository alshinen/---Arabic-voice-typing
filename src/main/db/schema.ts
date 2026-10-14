/**
 * مخطط قاعدة البيانات (design.md القسم 5، مع التبسيط المسجل في docs/decisions-log.md):
 * محتوى السؤال الخاص بنوعه (البدائل، المواضع، الإجابات الصحيحة، المناطق) يُحفظ JSON في question.data.
 * كل ترحيل يُطبَّق مرة واحدة بالترتيب، ورقم الإصدار يُحفظ في جدول schema_version.
 */
export const MIGRATIONS: readonly string[] = [
  /* sql */ `
  CREATE TABLE grade (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL
  );

  CREATE TABLE course (
    id TEXT PRIMARY KEY,
    course_number TEXT NOT NULL,
    course_name TEXT NOT NULL,
    start_date TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE lesson (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES course(id) ON DELETE SET NULL,
    lesson_number INTEGER,
    title TEXT NOT NULL,
    date TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE trainee (
    id TEXT PRIMARY KEY,
    number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    current_level INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE image (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    width_px INTEGER NOT NULL,
    height_px INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  -- 3 بنوك ترفيع + بنك عام واحد. لا يوجد بنك لكل دورة.
  CREATE TABLE question_bank (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('promotion','general')),
    grade_id TEXT REFERENCES grade(id),
    name TEXT NOT NULL,
    CHECK ((kind = 'promotion') = (grade_id IS NOT NULL))
  );

  CREATE TABLE question (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES question_bank(id),
    type TEXT NOT NULL CHECK (type IN ('TF','MCQ','LIST','SKILL','HOTSPOT')),
    text TEXT NOT NULL,
    image_id TEXT REFERENCES image(id),
    points REAL NOT NULL CHECK (points >= 0),
    level TEXT CHECK (level IN ('beginner','intermediate','advanced')),
    max_tries INTEGER NOT NULL DEFAULT 1 CHECK (max_tries >= 1),
    late_try_scoring TEXT NOT NULL DEFAULT 'decreasing'
      CHECK (late_try_scoring IN ('decreasing','full','first_only')),
    shuffle_options INTEGER NOT NULL DEFAULT 1,
    data TEXT NOT NULL,
    tested_at TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (type <> 'HOTSPOT' OR image_id IS NOT NULL)
  );

  -- «القوائم الجاهزة» لأسئلة «اذكر» والمهارات.
  CREATE TABLE ready_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    items TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE exam (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('course','promotion','quick','surprise')),
    course_id TEXT REFERENCES course(id) ON DELETE SET NULL,
    grade_id TEXT REFERENCES grade(id),
    lesson_id TEXT REFERENCES lesson(id) ON DELETE SET NULL,
    question_mode TEXT NOT NULL CHECK (question_mode IN ('random_draw','fixed')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    is_open INTEGER NOT NULL DEFAULT 0,
    identify_mode TEXT NOT NULL DEFAULT 'pick_list'
      CHECK (identify_mode IN ('name','number_lookup','number_and_name','pick_list')),
    settings TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (exam_type <> 'promotion' OR grade_id IS NOT NULL)
  );

  CREATE TABLE exam_question (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES question(id),
    sort_order INTEGER NOT NULL,
    points REAL NOT NULL CHECK (points >= 0),
    UNIQUE (exam_id, question_id)
  );

  CREATE TABLE exam_draw_rule (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL,
    points REAL NOT NULL CHECK (points >= 0),
    count INTEGER NOT NULL CHECK (count >= 0),
    sort_order INTEGER NOT NULL
  );

  -- status = 'preview' لتجربة المدرب: تُحذف عند الانتهاء ولا تظهر في النتائج.
  CREATE TABLE attempt (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exam(id),
    trainee_id TEXT REFERENCES trainee(id) ON DELETE SET NULL,
    entered_name TEXT,
    entered_number TEXT,
    exam_snapshot TEXT NOT NULL,
    device_name TEXT,
    seat TEXT,
    started_at TEXT NOT NULL,
    deadline_at TEXT,
    submitted_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('in_progress','submitted','timed_out','preview')),
    score REAL,
    max_score REAL,
    percent REAL,
    passed INTEGER
  );

  -- الأسئلة التي سُحبت لهذا المتدرب بترتيبها، مع نسخة ثابتة كاملة من السؤال.
  CREATE TABLE attempt_question (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempt(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    points REAL NOT NULL,
    snapshot TEXT NOT NULL,
    option_order TEXT NOT NULL DEFAULT '{}',
    done INTEGER NOT NULL DEFAULT 0,
    earned REAL,
    UNIQUE (attempt_id, question_id)
  );

  -- كل محاولة إجابة على سؤال (try).
  CREATE TABLE attempt_answer (
    id TEXT PRIMARY KEY,
    attempt_question_id TEXT NOT NULL REFERENCES attempt_question(id) ON DELETE CASCADE,
    try_number INTEGER NOT NULL,
    response TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    items TEXT,
    answered_at TEXT NOT NULL,
    UNIQUE (attempt_question_id, try_number)
  );

  CREATE INDEX idx_question_bank ON question(bank_id, type);
  CREATE INDEX idx_attempt_exam ON attempt(exam_id);
  CREATE INDEX idx_attempt_trainee ON attempt(trainee_id);
  CREATE INDEX idx_aq_attempt ON attempt_question(attempt_id);

  INSERT INTO grade (id, code, name_ar, from_level, to_level) VALUES
    ('grade-4to3', '4to3', 'من الدرجة الرابعة إلى الثالثة', 4, 3),
    ('grade-3to2', '3to2', 'من الدرجة الثالثة إلى الثانية', 3, 2),
    ('grade-2to1', '2to1', 'من الدرجة الثانية إلى الأولى', 2, 1);

  INSERT INTO question_bank (id, kind, grade_id, name) VALUES
    ('bank-4to3', 'promotion', 'grade-4to3', 'بنك الترفيع من الرابعة إلى الثالثة'),
    ('bank-3to2', 'promotion', 'grade-3to2', 'بنك الترفيع من الثالثة إلى الثانية'),
    ('bank-2to1', 'promotion', 'grade-2to1', 'بنك الترفيع من الثانية إلى الأولى'),
    ('bank-general', 'general', NULL, 'البنك العام');
  `,
];
