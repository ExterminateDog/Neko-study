import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import initSqlJs from "sql.js";

const dataDir = path.resolve("data");
const dbFile = path.join(dataDir, "study.sqlite");
const legacyJsonFile = path.join(dataDir, "study.json");

function now() {
  return new Date().toISOString();
}

function encode(value) {
  return JSON.stringify(value ?? null);
}

function decode(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return JSON.parse(value);
}

function createEmptyState() {
  return {
    users: [],
    question_banks: [],
    questions: [],
    practice_sessions: [],
    memorization_sessions: [],
    practice_records: [],
    wrong_questions: [],
    exam_papers: [],
    exam_answers: [],
    counters: {
      users: 0,
      question_banks: 0,
      questions: 0,
      practice_sessions: 0,
      memorization_sessions: 0,
      practice_records: 0,
      wrong_questions: 0,
      exam_papers: 0,
      exam_answers: 0,
    },
  };
}

function nextStateId(state, collection) {
  if (typeof state.counters[collection] !== "number") {
    state.counters[collection] = 0;
  }

  state.counters[collection] += 1;
  return state.counters[collection];
}

function ensureQuestionBankCounter(state) {
  if (typeof state.counters.question_banks !== "number") {
    state.counters.question_banks = 0;
  }

  if (!Array.isArray(state.question_banks)) {
    state.question_banks = [];
  }
}

function ensureDefaultQuestionBank(state) {
  ensureQuestionBankCounter(state);

  if (state.question_banks.length > 0) {
    return state.question_banks[0];
  }

  const admin = state.users.find((user) => user.username === "admin");
  const bank = {
    id: nextStateId(state, "question_banks"),
    name: "默认题库",
    description: "系统自动创建的默认题库，用于承接历史题目和初始示例题。",
    created_by: admin?.id ?? null,
    created_at: now(),
  };

  state.question_banks.push(bank);
  return bank;
}

function normalizeState(state) {
  const normalized = {
    ...createEmptyState(),
    ...state,
    users: Array.isArray(state?.users) ? state.users : [],
    question_banks: Array.isArray(state?.question_banks) ? state.question_banks : [],
    questions: Array.isArray(state?.questions) ? state.questions : [],
    practice_sessions: Array.isArray(state?.practice_sessions) ? state.practice_sessions : [],
    memorization_sessions: Array.isArray(state?.memorization_sessions)
      ? state.memorization_sessions
      : [],
    practice_records: Array.isArray(state?.practice_records) ? state.practice_records : [],
    wrong_questions: Array.isArray(state?.wrong_questions) ? state.wrong_questions : [],
    exam_papers: Array.isArray(state?.exam_papers) ? state.exam_papers : [],
    exam_answers: Array.isArray(state?.exam_answers) ? state.exam_answers : [],
    counters: {
      ...createEmptyState().counters,
      ...(state?.counters || {}),
    },
  };

  ensureQuestionBankCounter(normalized);
  return normalized;
}

function seedState(inputState) {
  const state = normalizeState(inputState);

  if (state.users.length === 0) {
    state.users.push({
      id: nextStateId(state, "users"),
      username: "neko",
      password_hash: bcrypt.hashSync("neko123", 10),
      role: "admin",
      created_at: now(),
    });
  }

  return state;
}

function createSchema(db) {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_banks (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      bank_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
      stem TEXT NOT NULL,
      options_json TEXT NOT NULL,
      answer_json TEXT NOT NULL,
      analysis TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      bank_id INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('sequential', 'random')),
      selected_types_json TEXT NOT NULL,
      question_ids_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, bank_id)
    );

    CREATE TABLE IF NOT EXISTS memorization_sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      bank_id INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('sequential', 'random')),
      selected_types_json TEXT NOT NULL,
      question_ids_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, bank_id)
    );

    CREATE TABLE IF NOT EXISTS practice_records (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      submitted_answer_json TEXT,
      is_correct INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('sequential', 'random')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wrong_questions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      last_answer_json TEXT,
      wrong_count INTEGER NOT NULL,
      last_wrong_at TEXT NOT NULL,
      UNIQUE(user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS exam_papers (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      selected_types_json TEXT NOT NULL,
      question_ids_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'submitted')),
      score REAL NOT NULL DEFAULT 0,
      total_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      submitted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS exam_answers (
      id INTEGER PRIMARY KEY,
      paper_id INTEGER NOT NULL,
      user_id INTEGER,
      question_id INTEGER NOT NULL,
      submitted_answer_json TEXT,
      is_correct INTEGER NOT NULL,
      score_awarded REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
  `);
}

function readAll(db, sql, mapper) {
  const statement = db.prepare(sql);
  const rows = [];

  try {
    while (statement.step()) {
      rows.push(mapper(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }

  return rows;
}

function columnExists(db, tableName, columnName) {
  const columns = readAll(db, `PRAGMA table_info(${tableName})`, (row) => row.name);
  return columns.includes(columnName);
}

function ensureSchemaCompatibility(db) {
  if (!columnExists(db, "questions", "bank_id")) {
    db.run("ALTER TABLE questions ADD COLUMN bank_id INTEGER");
  }

  createSchema(db);
}

function readState(db) {
  const state = createEmptyState();

  state.users = readAll(db, "SELECT * FROM users ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    username: row.username,
    password_hash: row.password_hash,
    role: row.role,
    created_at: row.created_at,
  }));

  state.question_banks = readAll(db, "SELECT * FROM question_banks ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    name: row.name,
    description: row.description ?? "",
    created_by: row.created_by === null ? null : Number(row.created_by),
    created_at: row.created_at,
  }));

  state.questions = readAll(db, "SELECT * FROM questions ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    bank_id: row.bank_id === null ? null : Number(row.bank_id),
    type: row.type,
    stem: row.stem,
    options: decode(row.options_json, []),
    answer: decode(row.answer_json),
    analysis: row.analysis ?? "",
    created_by: row.created_by === null ? null : Number(row.created_by),
    created_at: row.created_at,
  }));

  state.practice_sessions = readAll(
    db,
    "SELECT * FROM practice_sessions ORDER BY id ASC",
    (row) => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      bank_id: Number(row.bank_id),
      mode: row.mode,
      selected_types: decode(row.selected_types_json, []),
      question_ids: decode(row.question_ids_json, []),
      current_index: Number(row.current_index || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  );

  state.memorization_sessions = readAll(
    db,
    "SELECT * FROM memorization_sessions ORDER BY id ASC",
    (row) => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      bank_id: Number(row.bank_id),
      mode: row.mode,
      selected_types: decode(row.selected_types_json, []),
      question_ids: decode(row.question_ids_json, []),
      current_index: Number(row.current_index || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  );

  state.practice_records = readAll(db, "SELECT * FROM practice_records ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    question_id: Number(row.question_id),
    submitted_answer: decode(row.submitted_answer_json),
    is_correct: Number(row.is_correct),
    mode: row.mode,
    created_at: row.created_at,
  }));

  state.wrong_questions = readAll(db, "SELECT * FROM wrong_questions ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    question_id: Number(row.question_id),
    last_answer: decode(row.last_answer_json),
    wrong_count: Number(row.wrong_count),
    last_wrong_at: row.last_wrong_at,
  }));

  state.exam_papers = readAll(db, "SELECT * FROM exam_papers ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: row.title,
    selected_types: decode(row.selected_types_json, []),
    question_ids: decode(row.question_ids_json, []),
    status: row.status,
    score: Number(row.score),
    total_score: Number(row.total_score),
    created_at: row.created_at,
    submitted_at: row.submitted_at,
  }));

  state.exam_answers = readAll(db, "SELECT * FROM exam_answers ORDER BY id ASC", (row) => ({
    id: Number(row.id),
    paper_id: Number(row.paper_id),
    user_id: row.user_id === null ? null : Number(row.user_id),
    question_id: Number(row.question_id),
    submitted_answer: decode(row.submitted_answer_json),
    is_correct: Number(row.is_correct),
    score_awarded: Number(row.score_awarded),
  }));

  const counters = readAll(db, "SELECT * FROM counters", (row) => ({
    name: row.name,
    value: Number(row.value),
  }));

  for (const item of counters) {
    state.counters[item.name] = item.value;
  }

  for (const collection of Object.keys(state.counters)) {
    const items = Array.isArray(state[collection]) ? state[collection] : [];
    const maxId = Math.max(0, ...items.map((item) => item.id));
    state.counters[collection] = Math.max(state.counters[collection], maxId);
  }

  return state;
}

function writeState(db, inputState) {
  const state = seedState(inputState);
  db.run("BEGIN TRANSACTION");

  try {
    db.run("DELETE FROM exam_answers");
    db.run("DELETE FROM exam_papers");
    db.run("DELETE FROM wrong_questions");
    db.run("DELETE FROM practice_records");
    db.run("DELETE FROM practice_sessions");
    db.run("DELETE FROM memorization_sessions");
    db.run("DELETE FROM questions");
    db.run("DELETE FROM question_banks");
    db.run("DELETE FROM users");
    db.run("DELETE FROM counters");

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of state.users) {
      insertUser.run([item.id, item.username, item.password_hash, item.role, item.created_at]);
    }
    insertUser.free();

    const insertBank = db.prepare(`
      INSERT INTO question_banks (id, name, description, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of state.question_banks) {
      insertBank.run([
        item.id,
        item.name,
        item.description ?? "",
        item.created_by ?? null,
        item.created_at,
      ]);
    }
    insertBank.free();

    const insertQuestion = db.prepare(`
      INSERT INTO questions (id, bank_id, type, stem, options_json, answer_json, analysis, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.questions) {
      insertQuestion.run([
        item.id,
        item.bank_id ?? null,
        item.type,
        item.stem,
        encode(item.options ?? []),
        encode(item.answer),
        item.analysis ?? "",
        item.created_by ?? null,
        item.created_at,
      ]);
    }
    insertQuestion.free();

    const insertPracticeSession = db.prepare(`
      INSERT INTO practice_sessions (
        id, user_id, bank_id, mode, selected_types_json, question_ids_json, current_index, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.practice_sessions) {
      insertPracticeSession.run([
        item.id,
        item.user_id,
        item.bank_id,
        item.mode,
        encode(item.selected_types ?? []),
        encode(item.question_ids ?? []),
        item.current_index ?? 0,
        item.created_at,
        item.updated_at,
      ]);
    }
    insertPracticeSession.free();

    const insertMemorizationSession = db.prepare(`
      INSERT INTO memorization_sessions (
        id, user_id, bank_id, mode, selected_types_json, question_ids_json, current_index, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.memorization_sessions) {
      insertMemorizationSession.run([
        item.id,
        item.user_id,
        item.bank_id,
        item.mode,
        encode(item.selected_types ?? []),
        encode(item.question_ids ?? []),
        item.current_index ?? 0,
        item.created_at,
        item.updated_at,
      ]);
    }
    insertMemorizationSession.free();

    const insertPractice = db.prepare(`
      INSERT INTO practice_records (id, user_id, question_id, submitted_answer_json, is_correct, mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.practice_records) {
      insertPractice.run([
        item.id,
        item.user_id,
        item.question_id,
        encode(item.submitted_answer),
        item.is_correct,
        item.mode,
        item.created_at,
      ]);
    }
    insertPractice.free();

    const insertWrong = db.prepare(`
      INSERT INTO wrong_questions (id, user_id, question_id, last_answer_json, wrong_count, last_wrong_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.wrong_questions) {
      insertWrong.run([
        item.id,
        item.user_id,
        item.question_id,
        encode(item.last_answer),
        item.wrong_count,
        item.last_wrong_at,
      ]);
    }
    insertWrong.free();

    const insertPaper = db.prepare(`
      INSERT INTO exam_papers (
        id, user_id, title, selected_types_json, question_ids_json,
        status, score, total_score, created_at, submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.exam_papers) {
      insertPaper.run([
        item.id,
        item.user_id,
        item.title,
        encode(item.selected_types ?? []),
        encode(item.question_ids ?? []),
        item.status,
        item.score,
        item.total_score,
        item.created_at,
        item.submitted_at ?? null,
      ]);
    }
    insertPaper.free();

    const insertAnswer = db.prepare(`
      INSERT INTO exam_answers (
        id, paper_id, user_id, question_id, submitted_answer_json, is_correct, score_awarded
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of state.exam_answers) {
      insertAnswer.run([
        item.id,
        item.paper_id,
        item.user_id ?? null,
        item.question_id,
        encode(item.submitted_answer),
        item.is_correct,
        item.score_awarded,
      ]);
    }
    insertAnswer.free();

    const insertCounter = db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)");
    for (const [name, value] of Object.entries(state.counters)) {
      insertCounter.run([name, value]);
    }
    insertCounter.free();

    db.run("COMMIT");
    return state;
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

function loadLegacyState() {
  if (!fs.existsSync(legacyJsonFile)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(legacyJsonFile, "utf8"));
}

function persistDatabase(db) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbFile, Buffer.from(db.export()));
}

export async function createStore() {
  fs.mkdirSync(dataDir, { recursive: true });

  const SQL = await initSqlJs();
  const db = fs.existsSync(dbFile)
    ? new SQL.Database(fs.readFileSync(dbFile))
    : new SQL.Database();

  createSchema(db);
  ensureSchemaCompatibility(db);

  let state = readState(db);
  const legacyState = loadLegacyState();

  if (state.users.length === 0 && legacyState) {
    state = normalizeState(legacyState);
  }

  state = writeState(db, state);
  persistDatabase(db);

  return {
    state,
    save() {
      state = writeState(db, state);
      this.state = state;
      persistDatabase(db);
    },
    nextId(collection) {
      return nextStateId(state, collection);
    },
    now,
    dbPath: dbFile,
  };
}
