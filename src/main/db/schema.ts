/**
 * مخطط قاعدة البيانات (design.md القسم 5).
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
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE lesson (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES course(id),
    lesson_number INTEGER,
    title TEXT NOT NULL,
    date TEXT
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
    default_points REAL NOT NULL CHECK (default_points >= 0),
    tags TEXT NOT NULL DEFAULT '[]',
    level TEXT CHECK (level IN ('beginner','intermediate','advanced')),
    max_tries INTEGER NOT NULL DEFAULT 1 CHECK (max_tries >= 1),
    late_try_scoring TEXT NOT NULL DEFAULT 'decreasing'
      CHECK (late_try_scoring IN ('decreasing','full','first_only')),
    tf_correct INTEGER,
    list_ordered INTEGER,
    list_shared_options INTEGER,
    scoring_mode TEXT CHECK (scoring_mode IN ('partial','all_or_nothing','per_item')),
    shuffle_options INTEGER NOT NULL DEFAULT 1,
    tested_at TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (type <> 'HOTSPOT' OR image_id IS NOT NULL)
  );

  -- قوائم الخيارات: مرتبطة بسؤال، أو «قائمة جاهزة» يعاد استخدامها (question_id فارغ).
  CREATE TABLE option_list (
    id TEXT PRIMARY KEY,
    question_id TEXT REFERENCES question(id) ON DELETE CASCADE,
    name TEXT
  );

  CREATE TABLE option_item (
    id TEXT PRIMARY KEY,
    option_list_id TEXT NOT NULL REFERENCES option_list(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE slot (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    label TEXT,
    option_list_id TEXT REFERENCES option_list(id),
    item_points REAL
  );

  -- slot_id فارغ = ضمن مجموعة «دون ترتيب».
  CREATE TABLE correct_answer (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    slot_id TEXT REFERENCES slot(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL REFERENCES option_item(id) ON DELETE CASCADE
  );

  -- الإحداثيات نسب من 0 إلى 1 من أبعاد الصورة الأصلية.
  CREATE TABLE hotspot (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    shape TEXT NOT NULL CHECK (shape IN ('rect','ellipse','polygon')),
    coords TEXT NOT NULL,
    tolerance REAL
  );

  CREATE TABLE exam (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('course','promotion','quick','surprise')),
    course_id TEXT REFERENCES course(id),
    grade_id TEXT REFERENCES grade(id),
    lesson_id TEXT REFERENCES lesson(id),
    question_mode TEXT NOT NULL CHECK (question_mode IN ('random_draw','fixed')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    is_open INTEGER NOT NULL DEFAULT 0,
    identify_mode TEXT NOT NULL DEFAULT 'pick_list'
      CHECK (identify_mode IN ('name','number_lookup','number_and_name','pick_list')),
    settings TEXT NOT NULL DEFAULT '{}',
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
    count INTEGER NOT NULL CHECK (count >= 0)
  );

  CREATE TABLE attempt (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exam(id),
    trainee_id TEXT REFERENCES trainee(id),
    entered_name TEXT,
    entered_number TEXT,
    exam_snapshot TEXT NOT NULL,
    device_name TEXT,
    seat TEXT,
    started_at TEXT NOT NULL,
    submitted_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('in_progress','submitted','timed_out')),
    score REAL,
    max_score REAL,
    percent REAL,
    passed INTEGER
  );

  CREATE TABLE attempt_question (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempt(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES question(id),
    position INTEGER NOT NULL,
    points REAL NOT NULL,
    option_order TEXT NOT NULL DEFAULT '{}',
    UNIQUE (attempt_id, question_id)
  );

  CREATE TABLE attempt_answer (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempt(id) ON DELETE CASCADE,
    attempt_question_id TEXT NOT NULL REFERENCES attempt_question(id) ON DELETE CASCADE,
    try_number INTEGER NOT NULL,
    response TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    correct_items INTEGER,
    total_items INTEGER,
    answered_at TEXT NOT NULL
  );

  CREATE TABLE hotspot_click (
    id TEXT PRIMARY KEY,
    attempt_answer_id TEXT NOT NULL REFERENCES attempt_answer(id) ON DELETE CASCADE,
    nx REAL NOT NULL,
    ny REAL NOT NULL,
    hit INTEGER NOT NULL,
    hotspot_id TEXT,
    clicked_at TEXT NOT NULL
  );

  CREATE INDEX idx_question_bank ON question(bank_id, type);
  CREATE INDEX idx_attempt_exam ON attempt(exam_id);
  CREATE INDEX idx_attempt_trainee ON attempt(trainee_id);

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
