import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createStore } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");
const backupDir = path.resolve(__dirname, "../data/backups");
const JWT_SECRET = "neko-study-secret";
const store = await createStore();
const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT || 3001;
const MAX_BACKUP_FILES = 5;

const QUESTION_TYPES = [
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getUsers() {
  return store.state.users;
}

function getQuestionBanks() {
  return store.state.question_banks;
}

function getQuestions() {
  return store.state.questions;
}

function getPracticeSessions() {
  return store.state.practice_sessions;
}

function getMemorizationSessions() {
  return store.state.memorization_sessions;
}

function getPracticeRecords() {
  return store.state.practice_records;
}

function getWrongQuestions() {
  return store.state.wrong_questions;
}

function getExamPapers() {
  return store.state.exam_papers;
}

function getExamAnswers() {
  return store.state.exam_answers;
}

function createEmptyBackupState() {
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

function cloneBackupState(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBackupState(input) {
  const state = input && typeof input === "object" ? input : {};
  return {
    ...createEmptyBackupState(),
    ...state,
    users: Array.isArray(state.users) ? state.users : [],
    question_banks: Array.isArray(state.question_banks) ? state.question_banks : [],
    questions: Array.isArray(state.questions) ? state.questions : [],
    practice_sessions: Array.isArray(state.practice_sessions) ? state.practice_sessions : [],
    memorization_sessions: Array.isArray(state.memorization_sessions) ? state.memorization_sessions : [],
    practice_records: Array.isArray(state.practice_records) ? state.practice_records : [],
    wrong_questions: Array.isArray(state.wrong_questions) ? state.wrong_questions : [],
    exam_papers: Array.isArray(state.exam_papers) ? state.exam_papers : [],
    exam_answers: Array.isArray(state.exam_answers) ? state.exam_answers : [],
    counters: {
      ...createEmptyBackupState().counters,
      ...(state.counters && typeof state.counters === "object" ? state.counters : {}),
    },
  };
}

function getBackupPayload(type = "manual") {
  return {
    version: 1,
    type,
    createdAt: store.now(),
    source: "neko-study",
    state: cloneBackupState(store.state),
  };
}

function ensureBackupDirectory() {
  fs.mkdirSync(backupDir, { recursive: true });
}

function makeBackupFileName(type = "manual", createdAt = new Date()) {
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getDate()).padStart(2, "0");
  const hour = String(createdAt.getHours()).padStart(2, "0");
  const minute = String(createdAt.getMinutes()).padStart(2, "0");
  const second = String(createdAt.getSeconds()).padStart(2, "0");
  return `backup-${year}${month}${day}-${hour}${minute}${second}-${type}.json`;
}

function listBackupEntries() {
  ensureBackupDirectory();

  return fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const fullPath = path.join(backupDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        type: entry.name.includes("-auto.json") ? "auto" : "manual",
        path: fullPath,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function pruneBackupFiles() {
  const entries = listBackupEntries();

  for (const entry of entries.slice(MAX_BACKUP_FILES)) {
    fs.unlinkSync(entry.path);
  }
}

function writeBackupFile(type = "manual") {
  ensureBackupDirectory();
  const createdAt = new Date();
  const payload = getBackupPayload(type);
  const fileName = makeBackupFileName(type, createdAt);
  const filePath = path.join(backupDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  pruneBackupFiles();

  const stat = fs.statSync(filePath);
  return {
    name: fileName,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
    type,
  };
}

function hasAutoBackupForToday() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return listBackupEntries().some((entry) => entry.type === "auto" && entry.name.includes(today));
}

function ensureDailyAutoBackup() {
  if (hasAutoBackupForToday()) {
    return null;
  }

  return writeBackupFile("auto");
}

function restoreBackupState(payload) {
  const candidate =
    payload && typeof payload === "object" && payload.state && typeof payload.state === "object"
      ? payload.state
      : payload;

  store.state = normalizeBackupState(candidate);
  store.save();
  return store.state;
}

function getBackupEntryByName(fileName) {
  return listBackupEntries().find((entry) => entry.name === fileName) || null;
}

function restoreBackupFileByName(fileName) {
  const backup = getBackupEntryByName(fileName);

  if (!backup) {
    throw new Error("Backup file not found.");
  }

  const payload = JSON.parse(fs.readFileSync(backup.path, "utf8"));
  restoreBackupState(payload);
  return backup;
}

function pickRandom(items, count) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }

  return clone.slice(0, count);
}

function normalizeTypeList(types) {
  const input = Array.isArray(types)
    ? types
    : typeof types === "string"
      ? types.split(",")
      : [];

  return input
    .map((item) => String(item).trim())
    .filter((item) => QUESTION_TYPES.some((type) => type.value === item));
}

function normalizeBankId(value) {
  const bankId = Number(value);
  return Number.isInteger(bankId) && bankId > 0 ? bankId : null;
}

function getQuestionBankById(bankId) {
  return getQuestionBanks().find((bank) => bank.id === bankId) || null;
}

function getQuestionBankType(bank) {
  return String(bank?.type || "未分类").trim() || "未分类";
}

function getQuestionById(questionId) {
  return getQuestions().find((question) => question.id === questionId) || null;
}

function serializeQuestionBank(bank) {
  return {
    id: bank.id,
    name: bank.name,
    type: bank.type ?? "",
    description: bank.description ?? "",
    createdBy: bank.created_by ?? null,
    createdAt: bank.created_at,
    questionCount: getQuestions().filter((question) => question.bank_id === bank.id).length,
  };
}

function serializeQuestionBankForUser(bank, userId) {
  const base = serializeQuestionBank(bank);
  const practiceSession = getPracticeSessions().find(
    (item) => item.user_id === userId && item.bank_id === bank.id
  );
  const memorizationSession = getMemorizationSessions().find(
    (item) => item.user_id === userId && item.bank_id === bank.id
  );

  return {
    ...base,
    practiceProgress: practiceSession
      ? {
          currentIndex: practiceSession.current_index,
          total: practiceSession.question_ids.length,
          mode: practiceSession.mode,
          selectedTypes: practiceSession.selected_types,
          updatedAt: practiceSession.updated_at,
          hasProgress: practiceSession.question_ids.length > 0,
        }
      : null,
    memorizationProgress: memorizationSession
      ? {
          currentIndex: memorizationSession.current_index,
          total: memorizationSession.question_ids.length,
          mode: memorizationSession.mode,
          selectedTypes: memorizationSession.selected_types,
          updatedAt: memorizationSession.updated_at,
          hasProgress: memorizationSession.question_ids.length > 0,
        }
      : null,
  };
}

function getQuestionCountForBank(bankId) {
  return getQuestions().filter((question) => question.bank_id === bankId).length;
}

function getPracticeSession(userId, bankId) {
  return (
    getPracticeSessions().find((item) => item.user_id === userId && item.bank_id === bankId) || null
  );
}

function getMemorizationSession(userId, bankId) {
  return (
    getMemorizationSessions().find((item) => item.user_id === userId && item.bank_id === bankId) ||
    null
  );
}

function cleanupPracticeSession(session) {
  const validQuestionIds = session.question_ids.filter((questionId) => {
    const question = getQuestionById(questionId);
    return question && question.bank_id === session.bank_id;
  });

  session.question_ids = validQuestionIds;
  session.current_index = Math.max(
    0,
    Math.min(session.current_index, Math.max(validQuestionIds.length - 1, 0))
  );

  return session;
}

function cleanupMemorizationSession(session) {
  const validQuestionIds = session.question_ids.filter((questionId) => {
    const question = getQuestionById(questionId);
    return question && question.bank_id === session.bank_id;
  });

  session.question_ids = validQuestionIds;
  session.current_index = Math.max(
    0,
    Math.min(session.current_index, Math.max(validQuestionIds.length - 1, 0))
  );

  return session;
}

function upsertPracticeSession({ userId, bankId, mode, selectedTypes, questionIds, currentIndex }) {
  let session = getPracticeSession(userId, bankId);

  if (!session) {
    session = {
      id: store.nextId("practice_sessions"),
      user_id: userId,
      bank_id: bankId,
      mode,
      selected_types: selectedTypes,
      question_ids: questionIds,
      current_index: currentIndex,
      created_at: store.now(),
      updated_at: store.now(),
    };
    getPracticeSessions().push(session);
    return session;
  }

  session.mode = mode;
  session.selected_types = selectedTypes;
  session.question_ids = questionIds;
  session.current_index = currentIndex;
  session.updated_at = store.now();
  cleanupPracticeSession(session);
  return session;
}

function upsertMemorizationSession({ userId, bankId, mode, selectedTypes, questionIds, currentIndex }) {
  let session = getMemorizationSession(userId, bankId);

  if (!session) {
    session = {
      id: store.nextId("memorization_sessions"),
      user_id: userId,
      bank_id: bankId,
      mode,
      selected_types: selectedTypes,
      question_ids: questionIds,
      current_index: currentIndex,
      created_at: store.now(),
      updated_at: store.now(),
    };
    getMemorizationSessions().push(session);
    return session;
  }

  session.mode = mode;
  session.selected_types = selectedTypes;
  session.question_ids = questionIds;
  session.current_index = currentIndex;
  session.updated_at = store.now();
  cleanupMemorizationSession(session);
  return session;
}

function updatePracticeSessionProgress({ userId, bankId, currentIndex }) {
  const session = getPracticeSession(userId, bankId);

  if (!session) {
    return null;
  }

  cleanupPracticeSession(session);
  session.current_index = Math.max(
    0,
    Math.min(Number(currentIndex) || 0, Math.max(session.question_ids.length - 1, 0))
  );
  session.updated_at = store.now();
  return session;
}

function updateMemorizationSessionProgress({ userId, bankId, currentIndex }) {
  const session = getMemorizationSession(userId, bankId);

  if (!session) {
    return null;
  }

  cleanupMemorizationSession(session);
  session.current_index = Math.max(
    0,
    Math.min(Number(currentIndex) || 0, Math.max(session.question_ids.length - 1, 0))
  );
  session.updated_at = store.now();
  return session;
}

function buildPracticeQuestions({ bankId, mode, types, limit }) {
  let questions = [...getQuestions()].filter((question) => question.bank_id === bankId);
  questions = questions.filter((question) => (types.length > 0 ? types.includes(question.type) : true));

  if (mode === "random") {
    return pickRandom(questions, limit);
  }

  return questions.sort((a, b) => a.id - b.id).slice(0, limit);
}

function serializePracticeSession(session) {
  const bank = getQuestionBankById(session.bank_id);
  const questions = session.question_ids
    .map((questionId) => getQuestionById(questionId))
    .filter(Boolean)
    .map((question) => sanitizeQuestionForStudent(question));

  return {
    bankId: session.bank_id,
    bankName: bank?.name || "",
    mode: session.mode,
    selectedTypes: session.selected_types,
    currentIndex: session.current_index,
    total: questions.length,
    questions,
    updatedAt: session.updated_at,
  };
}

function serializeMemorizationSession(session) {
  const bank = getQuestionBankById(session.bank_id);
  const questions = session.question_ids
    .map((questionId) => getQuestionById(questionId))
    .filter(Boolean)
    .map((question) => sanitizeQuestionForMemorization(question));

  return {
    bankId: session.bank_id,
    bankName: bank?.name || "",
    mode: session.mode,
    selectedTypes: session.selected_types,
    currentIndex: session.current_index,
    total: questions.length,
    questions,
    updatedAt: session.updated_at,
  };
}

function serializeQuestion(question) {
  const bank = getQuestionBankById(question.bank_id);

  return {
    id: question.id,
    bankId: question.bank_id,
    bankName: bank?.name || "未命名题库",
    type: question.type,
    stem: question.stem,
    options: question.options ?? [],
    answer: question.answer,
    analysis: question.analysis ?? "",
    createdBy: question.created_by ?? null,
    createdAt: question.created_at,
  };
}

function sanitizeQuestionForStudent(question) {
  const bank = getQuestionBankById(question.bank_id);

  return {
    id: question.id,
    bankId: question.bank_id,
    bankName: bank?.name || "未命名题库",
    type: question.type,
    stem: question.stem,
    options:
      question.type === "true_false"
        ? [
            { label: "T", text: "Correct" },
            { label: "F", text: "Wrong" },
          ]
        : question.options ?? [],
    analysis: question.analysis ?? "",
  };
}

function sanitizeQuestionForMemorization(question) {
  const base = sanitizeQuestionForStudent(question);

  return {
    ...base,
    answer: question.answer,
    correctAnswer: formatCorrectAnswer(question),
  };
}

function formatCorrectAnswer(question) {
  if (question.type === "single_choice") {
    return question.answer;
  }

  if (question.type === "multiple_choice") {
    return question.answer.join(", ");
  }

  if (question.type === "true_false") {
    return question.answer ? "正确" : "错误";
  }

  return question.answer.reference ?? "";
}

function normalizeSubmittedAnswer(question, submittedAnswer) {
  if (question.type === "single_choice") {
    return String(submittedAnswer ?? "").trim().toUpperCase();
  }

  if (question.type === "multiple_choice") {
    return Array.isArray(submittedAnswer)
      ? [...submittedAnswer]
          .map((item) => String(item).trim().toUpperCase())
          .filter(Boolean)
          .sort()
      : [];
  }

  if (question.type === "true_false") {
    if (typeof submittedAnswer === "boolean") {
      return submittedAnswer;
    }

    if (
      submittedAnswer === "true" ||
      submittedAnswer === "Correct" ||
      submittedAnswer === "T" ||
      submittedAnswer === "正确"
    ) {
      return true;
    }

    if (
      submittedAnswer === "false" ||
      submittedAnswer === "Wrong" ||
      submittedAnswer === "F" ||
      submittedAnswer === "错误"
    ) {
      return false;
    }

    return null;
  }

  return String(submittedAnswer ?? "").trim();
}

function gradeShortAnswer(answerConfig, submitted) {
  const text = String(submitted ?? "").trim().toLowerCase();
  const keywords = Array.isArray(answerConfig?.keywords)
    ? answerConfig.keywords.map((item) => String(item).toLowerCase())
    : [];

  if (!text) {
    return false;
  }

  if (keywords.length === 0) {
    return text === String(answerConfig?.reference ?? "").trim().toLowerCase();
  }

  const hitCount = keywords.filter((keyword) => text.includes(keyword)).length;
  const passCount = Math.max(1, Math.ceil(keywords.length * 0.6));
  return hitCount >= passCount;
}

function gradeQuestion(question, submittedAnswer) {
  const normalized = normalizeSubmittedAnswer(question, submittedAnswer);

  if (question.type === "single_choice") {
    return normalized === question.answer;
  }

  if (question.type === "multiple_choice") {
    const correct = [...question.answer].sort();
    return JSON.stringify(normalized) === JSON.stringify(correct);
  }

  if (question.type === "true_false") {
    return normalized === question.answer;
  }

  return gradeShortAnswer(question.answer, normalized);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Please login first." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUsers().find((item) => item.id === payload.id);

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
    };
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin permission required." });
  }

  next();
}

function extractImportQuestions(body) {
  if (Array.isArray(body)) {
    return body;
  }

  if (Array.isArray(body?.questions)) {
    return body.questions;
  }

  return null;
}

function parseQuestionInput(item) {
  const type = String(item.type || "").trim();
  const stem = String(item.stem || "").trim();
  const analysis = String(item.analysis || "").trim();
  const allowedTypes = QUESTION_TYPES.map((entry) => entry.value);

  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid question type: ${type}`);
  }

  if (!stem) {
    throw new Error("Question stem cannot be empty.");
  }

  let options = [];
  let answer = item.answer;

  if (type === "single_choice" || type === "multiple_choice") {
    if (!Array.isArray(item.options) || item.options.length < 2) {
      throw new Error(`Question "${stem}" needs at least two options.`);
    }

    options = item.options.map((option, index) => {
      if (typeof option === "string") {
        return {
          label: String.fromCharCode(65 + index),
          text: option,
        };
      }

      return {
        label: String(option.label || String.fromCharCode(65 + index)).trim().toUpperCase(),
        text: String(option.text || "").trim(),
      };
    });

    if (type === "single_choice") {
      answer = String(answer || "").trim().toUpperCase();

      if (!options.some((option) => option.label === answer)) {
        throw new Error(`Question "${stem}" has an answer outside the options.`);
      }
    } else {
      answer = Array.isArray(answer)
        ? answer.map((entry) => String(entry).trim().toUpperCase()).sort()
        : [];

      if (
        answer.length === 0 ||
        !answer.every((entry) => options.some((option) => option.label === entry))
      ) {
        throw new Error(`Question "${stem}" has an invalid multiple-choice answer.`);
      }
    }
  }

  if (type === "true_false") {
    if (typeof answer === "string") {
      const normalizedAnswer = answer.trim().toLowerCase();

      if (normalizedAnswer === "true" || normalizedAnswer === "正确") {
        answer = true;
      } else if (normalizedAnswer === "false" || normalizedAnswer === "错误") {
        answer = false;
      }
    }

    if (typeof answer !== "boolean") {
      throw new Error(`Question "${stem}" must use true or false as the answer.`);
    }
  }

  if (type === "short_answer") {
    if (typeof answer === "string") {
      answer = {
        keywords: [],
        reference: answer.trim(),
      };
    }

    answer = {
      keywords: Array.isArray(answer?.keywords)
        ? answer.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
        : [],
      reference: String(answer?.reference || "").trim(),
    };
  }

  return { type, stem, options, answer, analysis };
}

function buildImportError(error, item, index) {
  const stem = String(item?.stem || item?.a || "").trim();

  return {
    message: error.message || "Question import failed.",
    questionNumber: index + 1,
    stem,
  };
}

function ensureQuestionBank(bankId) {
  const bank = getQuestionBankById(bankId);
  return bank || null;
}

function removeQuestionReferences(questionId) {
  for (const session of getPracticeSessions()) {
    if (!session.question_ids.includes(questionId)) {
      continue;
    }

    session.question_ids = session.question_ids.filter((id) => id !== questionId);

    if (session.question_ids.length > 0) {
      session.current_index = Math.max(
        0,
        Math.min(session.current_index, Math.max(session.question_ids.length - 1, 0))
      );
      session.updated_at = store.now();
    }
  }

  for (const session of getMemorizationSessions()) {
    if (!session.question_ids.includes(questionId)) {
      continue;
    }

    session.question_ids = session.question_ids.filter((id) => id !== questionId);

    if (session.question_ids.length > 0) {
      session.current_index = Math.max(
        0,
        Math.min(session.current_index, Math.max(session.question_ids.length - 1, 0))
      );
      session.updated_at = store.now();
    }
  }

  store.state.practice_sessions = getPracticeSessions().filter((session) => session.question_ids.length > 0);
  store.state.memorization_sessions = getMemorizationSessions().filter(
    (session) => session.question_ids.length > 0
  );
  store.state.practice_records = getPracticeRecords().filter(
    (item) => item.question_id !== questionId
  );
  store.state.wrong_questions = getWrongQuestions().filter((item) => item.question_id !== questionId);

  const removedPaperIds = new Set();

  store.state.exam_answers = getExamAnswers().filter((item) => item.question_id !== questionId);

  store.state.exam_papers = getExamPapers().filter((paper) => {
    if (!paper.question_ids.includes(questionId)) {
      return true;
    }

    paper.question_ids = paper.question_ids.filter((id) => id !== questionId);
    paper.total_score = paper.question_ids.length;

    if (paper.question_ids.length === 0) {
      removedPaperIds.add(paper.id);
      return false;
    }

    if (paper.status === "submitted") {
      paper.score = getExamAnswers()
        .filter((item) => item.paper_id === paper.id)
        .reduce((total, item) => total + Number(item.score_awarded || 0), 0);
    }

    return true;
  });

  if (removedPaperIds.size > 0) {
    store.state.exam_answers = getExamAnswers().filter((item) => !removedPaperIds.has(item.paper_id));
  }
}

function removeQuestionBank(bankId) {
  const questionIds = getQuestions()
    .filter((question) => question.bank_id === bankId)
    .map((question) => question.id);

  store.state.practice_sessions = getPracticeSessions().filter((session) => session.bank_id !== bankId);
  store.state.memorization_sessions = getMemorizationSessions().filter(
    (session) => session.bank_id !== bankId
  );
  store.state.questions = getQuestions().filter((question) => question.bank_id !== bankId);

  for (const questionId of questionIds) {
    removeQuestionReferences(questionId);
  }

  store.state.question_banks = getQuestionBanks().filter((bank) => bank.id !== bankId);
}

function recordWrongQuestion(userId, questionId, submittedAnswer) {
  const existing = getWrongQuestions().find(
    (item) => item.user_id === userId && item.question_id === questionId
  );

  if (existing) {
    existing.last_answer = submittedAnswer ?? null;
    existing.wrong_count += 1;
    existing.last_wrong_at = store.now();
    store.save();
    return;
  }

  getWrongQuestions().push({
    id: store.nextId("wrong_questions"),
    user_id: userId,
    question_id: questionId,
    last_answer: submittedAnswer ?? null,
    wrong_count: 1,
    last_wrong_at: store.now(),
  });
  store.save();
}

function getFilteredQuestions({ bankId = null, type = "", search = "" }) {
  return [...getQuestions()]
    .filter((question) => (bankId ? question.bank_id === bankId : true))
    .filter((question) => (type ? question.type === type : true))
    .filter((question) => (search ? question.stem.includes(search) : true))
    .sort((a, b) => b.id - a.id);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/question-types", (_req, res) => {
  res.json(QUESTION_TYPES);
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = getUsers().find((item) => item.username === username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: "Invalid username or password." });
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
  };

  res.json({
    token: signToken(safeUser),
    user: safeUser,
  });
});

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  const confirmPassword = String(req.body?.confirmPassword || "").trim();

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ message: "Username must be 3 to 32 characters long." });
  }

  if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/.test(username)) {
    return res.status(400).json({ message: "Username contains unsupported characters." });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long." });
  }

  if (!confirmPassword) {
    return res.status(400).json({ message: "Please confirm your password." });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "The two passwords do not match." });
  }

  if (getUsers().some((user) => user.username === username)) {
    return res.status(400).json({ message: "Username already exists." });
  }

  const createdUser = {
    id: store.nextId("users"),
    username,
    password_hash: bcrypt.hashSync(password, 10),
    role: "user",
    created_at: store.now(),
  };

  getUsers().push(createdUser);
  store.save();

  const safeUser = {
    id: createdUser.id,
    username: createdUser.username,
    role: createdUser.role,
    created_at: createdUser.created_at,
  };

  res.status(201).json({
    message: "Registration successful.",
    token: signToken(safeUser),
    user: safeUser,
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json(req.user);
});

app.get("/api/summary", requireAuth, (req, res) => {
  const payload = {
    questionTotal: getQuestions().length,
    wrongTotal: getWrongQuestions().filter((item) => item.user_id === req.user.id).length,
    practiceTotal: getPracticeRecords().filter((item) => item.user_id === req.user.id).length,
    examTotal: getExamPapers().filter((item) => item.user_id === req.user.id).length,
  };

  if (req.user.role === "admin") {
    payload.userTotal = getUsers().length;
    payload.questionBankTotal = getQuestionBanks().length;
    payload.pendingPaperTotal = getExamPapers().filter((item) => item.status === "pending").length;
  }

  res.json(payload);
});

app.get("/api/question-banks", requireAuth, (_req, res) => {
  const banks = [...getQuestionBanks()]
    .sort((a, b) => a.id - b.id)
    .map((bank) => serializeQuestionBankForUser(bank, _req.user.id));

  res.json(banks);
});

app.get("/api/admin/question-banks", requireAuth, requireAdmin, (_req, res) => {
  const banks = [...getQuestionBanks()]
    .sort((a, b) => a.id - b.id)
    .map((bank) => serializeQuestionBankForUser(bank, _req.user.id));

  res.json(banks);
});

app.post("/api/admin/question-banks", requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const type = String(req.body?.type || "").trim();
  const description = String(req.body?.description || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Question bank name is required." });
  }

  const bank = {
    id: store.nextId("question_banks"),
    name,
    type,
    description,
    created_by: req.user.id,
    created_at: store.now(),
  };

  getQuestionBanks().push(bank);
  store.save();
  res.status(201).json(serializeQuestionBank(bank));
});

app.put("/api/admin/question-banks/:id", requireAuth, requireAdmin, (req, res) => {
  const bankId = Number(req.params.id);
  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  const name = String(req.body?.name || "").trim();
  const type = String(req.body?.type || "").trim();
  const description = String(req.body?.description || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Question bank name is required." });
  }

  bank.name = name;
  bank.type = type;
  bank.description = description;
  store.save();
  res.json(serializeQuestionBank(bank));
});

app.delete("/api/admin/question-banks/:id", requireAuth, requireAdmin, (req, res) => {
  const bankId = Number(req.params.id);
  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  removeQuestionBank(bankId);
  store.save();
  res.json({ success: true });
});

app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
  const users = [...getUsers()]
    .sort((a, b) => a.id - b.id)
    .map(({ password_hash, ...user }) => user);
  res.json(users);
});

app.post("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();
  const role = req.body?.role === "admin" ? "admin" : "user";

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  if (getUsers().some((user) => user.username === username)) {
    return res.status(400).json({ message: "Username already exists." });
  }

  const createdUser = {
    id: store.nextId("users"),
    username,
    password_hash: bcrypt.hashSync(password, 10),
    role,
    created_at: store.now(),
  };

  getUsers().push(createdUser);
  store.save();

  const { password_hash, ...safeUser } = createdUser;
  res.status(201).json(safeUser);
});

app.put("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const target = getUsers().find((user) => user.id === userId);

  if (!target) {
    return res.status(404).json({ message: "User not found." });
  }

  const nextRole = req.body?.role === "admin" ? "admin" : "user";
  const nextPassword = String(req.body?.password || "").trim();

  if (target.id === req.user.id && nextRole !== "admin") {
    return res.status(400).json({ message: "You cannot remove your own admin role." });
  }

  target.role = nextRole;

  if (nextPassword) {
    target.password_hash = bcrypt.hashSync(nextPassword, 10);
  }

  store.save();
  const { password_hash, ...updated } = target;
  res.json(updated);
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);

  if (userId === req.user.id) {
    return res.status(400).json({ message: "You cannot delete the current account." });
  }

  const index = getUsers().findIndex((user) => user.id === userId);

  if (index === -1) {
    return res.status(404).json({ message: "User not found." });
  }

  getUsers().splice(index, 1);
  store.state.practice_sessions = getPracticeSessions().filter((item) => item.user_id !== userId);
  store.state.memorization_sessions = getMemorizationSessions().filter(
    (item) => item.user_id !== userId
  );
  store.state.practice_records = getPracticeRecords().filter((item) => item.user_id !== userId);
  store.state.wrong_questions = getWrongQuestions().filter((item) => item.user_id !== userId);
  store.state.exam_papers = getExamPapers().filter((item) => item.user_id !== userId);
  store.state.exam_answers = getExamAnswers().filter((item) => item.user_id !== userId);
  store.save();

  res.json({ success: true });
});

app.get("/api/admin/questions", requireAuth, requireAdmin, (req, res) => {
  const bankId = normalizeBankId(req.query.bankId);
  const type = String(req.query.type || "").trim();
  const search = String(req.query.search || "").trim();

  if (bankId && !ensureQuestionBank(bankId)) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  const questions = getFilteredQuestions({ bankId, type, search }).map((question) =>
    serializeQuestion(question)
  );

  res.json(questions);
});

app.post("/api/admin/questions", requireAuth, requireAdmin, (req, res) => {
  const bankId = normalizeBankId(req.body?.bankId);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  try {
    const normalized = parseQuestionInput(req.body || {});
    const question = {
      id: store.nextId("questions"),
      bank_id: bank.id,
      type: normalized.type,
      stem: normalized.stem,
      options: normalized.options,
      answer: normalized.answer,
      analysis: normalized.analysis,
      created_by: req.user.id,
      created_at: store.now(),
    };

    getQuestions().push(question);
    store.save();
    res.status(201).json(serializeQuestion(question));
  } catch (error) {
    res.status(400).json({ message: error.message || "Question creation failed." });
  }
});

app.put("/api/admin/questions/:id", requireAuth, requireAdmin, (req, res) => {
  const questionId = Number(req.params.id);
  const question = getQuestionById(questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found." });
  }

  const bankId = normalizeBankId(req.body?.bankId) || question.bank_id;
  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  try {
    const normalized = parseQuestionInput(req.body || {});
    question.bank_id = bank.id;
    question.type = normalized.type;
    question.stem = normalized.stem;
    question.options = normalized.options;
    question.answer = normalized.answer;
    question.analysis = normalized.analysis;
    store.save();
    res.json(serializeQuestion(question));
  } catch (error) {
    res.status(400).json({ message: error.message || "Question update failed." });
  }
});

app.delete("/api/admin/questions/:id", requireAuth, requireAdmin, (req, res) => {
  const questionId = Number(req.params.id);
  const index = getQuestions().findIndex((item) => item.id === questionId);

  if (index === -1) {
    return res.status(404).json({ message: "Question not found." });
  }

  getQuestions().splice(index, 1);
  removeQuestionReferences(questionId);
  store.save();
  res.json({ success: true });
});

app.post("/api/admin/questions/import", requireAuth, requireAdmin, (req, res) => {
  const bankId = normalizeBankId(req.body?.bankId);
  const questions = extractImportQuestions(req.body);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  if (!questions || questions.length === 0) {
    return res.status(400).json({ message: "Please provide a non-empty question array." });
  }

  try {
    const normalized = [];

    for (let index = 0; index < questions.length; index += 1) {
      try {
        normalized.push(parseQuestionInput(questions[index]));
      } catch (error) {
        return res.status(400).json(buildImportError(error, questions[index], index));
      }
    }

    for (const item of normalized) {
      getQuestions().push({
        id: store.nextId("questions"),
        bank_id: bank.id,
        type: item.type,
        stem: item.stem,
        options: item.options,
        answer: item.answer,
        analysis: item.analysis,
        created_by: req.user.id,
        created_at: store.now(),
      });
    }

    store.save();
    res.status(201).json({
      importedCount: normalized.length,
      message: `Imported ${normalized.length} questions successfully.`,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Question import failed." });
  }
});

app.get("/api/admin/backups", requireAuth, requireAdmin, (_req, res) => {
  const backups = listBackupEntries().map(({ path: _path, ...entry }) => entry);
  res.json({
    backups,
    maxFiles: MAX_BACKUP_FILES,
  });
});

app.get("/api/admin/backups/export", requireAuth, requireAdmin, (_req, res) => {
  const payload = getBackupPayload("manual");
  const suggestedFileName = makeBackupFileName("manual", new Date());
  res.json({
    suggestedFileName,
    backup: payload,
  });
});

app.post("/api/admin/backups/create", requireAuth, requireAdmin, (_req, res) => {
  const backup = writeBackupFile("manual");
  res.status(201).json({
    message: "Backup created successfully.",
    backup,
  });
});

app.post("/api/admin/backups/import", requireAuth, requireAdmin, (req, res) => {
  try {
    restoreBackupState(req.body);
    res.json({
      message: "Backup imported successfully.",
      userCount: getUsers().length,
      questionBankCount: getQuestionBanks().length,
      questionCount: getQuestions().length,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Backup import failed." });
  }
});

app.post("/api/admin/backups/restore/:name", requireAuth, requireAdmin, (req, res) => {
  try {
    const fileName = String(req.params.name || "").trim();

    if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
      return res.status(400).json({ message: "Invalid backup file name." });
    }

    const backup = restoreBackupFileByName(fileName);
    res.json({
      message: "Backup restored successfully.",
      backup: {
        name: backup.name,
        createdAt: backup.createdAt,
        size: backup.size,
        type: backup.type,
      },
      userCount: getUsers().length,
      questionBankCount: getQuestionBanks().length,
      questionCount: getQuestions().length,
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Backup restore failed." });
  }
});

app.post("/api/practice/start", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.body?.bankId);
  const mode = req.body?.mode === "random" ? "random" : "sequential";
  const types = normalizeTypeList(req.body?.types);
  const requestedLimit = Number(req.body?.limit) || 0;

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  const availableCount = getQuestionCountForBank(bank.id);
  const limit =
    requestedLimit > 0
      ? Math.min(Math.max(requestedLimit, 1), Math.max(availableCount, 1))
      : Math.max(availableCount, 1);
  const questions = buildPracticeQuestions({ bankId: bank.id, mode, types, limit });

  if (questions.length === 0) {
    return res.status(400).json({ message: "No questions are available for this filter." });
  }

  const session = upsertPracticeSession({
    userId: req.user.id,
    bankId: bank.id,
    mode,
    selectedTypes: types,
    questionIds: questions.map((question) => question.id),
    currentIndex: 0,
  });

  store.save();
  res.status(201).json(serializePracticeSession(session));
});

app.get("/api/practice/continue/:bankId", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.params.bankId);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const session = getPracticeSession(req.user.id, bankId);

  if (!session) {
    return res.status(404).json({ message: "No saved practice progress was found for this bank." });
  }

  cleanupPracticeSession(session);

  if (session.question_ids.length === 0) {
    store.state.practice_sessions = getPracticeSessions().filter((item) => item.id !== session.id);
    store.save();
    return res.status(404).json({ message: "Saved practice progress is no longer available." });
  }

  session.updated_at = store.now();
  store.save();
  res.json(serializePracticeSession(session));
});

app.post("/api/practice/progress", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.body?.bankId);
  const currentIndex = Number(req.body?.currentIndex);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const session = updatePracticeSessionProgress({
    userId: req.user.id,
    bankId,
    currentIndex,
  });

  if (!session) {
    return res.status(404).json({ message: "Practice session not found." });
  }

  store.save();
  res.json({
    success: true,
    currentIndex: session.current_index,
    total: session.question_ids.length,
  });
});

app.post("/api/memorize/start", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.body?.bankId);
  const mode = req.body?.mode === "random" ? "random" : "sequential";
  const types = normalizeTypeList(req.body?.types);
  const requestedLimit = Number(req.body?.limit) || 0;

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  const availableCount = getQuestionCountForBank(bank.id);
  const limit =
    requestedLimit > 0
      ? Math.min(Math.max(requestedLimit, 1), Math.max(availableCount, 1))
      : Math.max(availableCount, 1);
  const questions = buildPracticeQuestions({ bankId: bank.id, mode, types, limit });

  if (questions.length === 0) {
    return res.status(400).json({ message: "No questions are available for this filter." });
  }

  const session = upsertMemorizationSession({
    userId: req.user.id,
    bankId: bank.id,
    mode,
    selectedTypes: types,
    questionIds: questions.map((question) => question.id),
    currentIndex: 0,
  });

  store.save();
  res.status(201).json(serializeMemorizationSession(session));
});

app.get("/api/memorize/continue/:bankId", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.params.bankId);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const session = getMemorizationSession(req.user.id, bankId);

  if (!session) {
    return res.status(404).json({ message: "No saved memorization progress was found for this bank." });
  }

  cleanupMemorizationSession(session);

  if (session.question_ids.length === 0) {
    store.state.memorization_sessions = getMemorizationSessions().filter(
      (item) => item.id !== session.id
    );
    store.save();
    return res.status(404).json({ message: "Saved memorization progress is no longer available." });
  }

  session.updated_at = store.now();
  store.save();
  res.json(serializeMemorizationSession(session));
});

app.post("/api/memorize/progress", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.body?.bankId);
  const currentIndex = Number(req.body?.currentIndex);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const session = updateMemorizationSessionProgress({
    userId: req.user.id,
    bankId,
    currentIndex,
  });

  if (!session) {
    return res.status(404).json({ message: "Memorization session not found." });
  }

  store.save();
  res.json({
    success: true,
    currentIndex: session.current_index,
    total: session.question_ids.length,
  });
});

app.get("/api/practice/questions", requireAuth, (req, res) => {
  const bankId = normalizeBankId(req.query.bankId);
  const mode = req.query.mode === "random" ? "random" : "sequential";
  const types = normalizeTypeList(req.query.types);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  if (!bankId) {
    return res.status(400).json({ message: "Please choose a question bank first." });
  }

  const bank = ensureQuestionBank(bankId);

  if (!bank) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  let questions = [...getQuestions()].filter((question) => question.bank_id === bank.id);
  questions = questions.filter((question) => (types.length > 0 ? types.includes(question.type) : true));

  questions =
    mode === "random"
      ? pickRandom(questions, limit)
      : questions.sort((a, b) => a.id - b.id).slice(0, limit);

  res.json(questions.map(sanitizeQuestionForStudent));
});

app.post("/api/practice/submit", requireAuth, (req, res) => {
  const questionId = Number(req.body?.questionId);
  const submittedAnswer = req.body?.answer;
  const mode = req.body?.mode === "random" ? "random" : "sequential";
  const question = getQuestionById(questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found." });
  }

  const isCorrect = gradeQuestion(question, submittedAnswer);

  getPracticeRecords().push({
    id: store.nextId("practice_records"),
    user_id: req.user.id,
    question_id: questionId,
    submitted_answer: submittedAnswer ?? null,
    is_correct: isCorrect ? 1 : 0,
    mode,
    created_at: store.now(),
  });
  store.save();

  if (!isCorrect) {
    recordWrongQuestion(req.user.id, questionId, submittedAnswer);
  }

  res.json({
    isCorrect,
    correctAnswer: formatCorrectAnswer(question),
    analysis: question.analysis,
  });
});

app.post("/api/exams/generate", requireAuth, (req, res) => {
  const bankType = String(req.body?.bankType || "").trim();
  const typeCountsInput = req.body?.typeCounts && typeof req.body.typeCounts === "object"
    ? req.body.typeCounts
    : {};
  const title = String(req.body?.title || "Custom Paper").trim();

  if (!bankType) {
    return res.status(400).json({ message: "Please choose a question bank type first." });
  }

  const banks = getQuestionBanks().filter((bank) => getQuestionBankType(bank) === bankType);

  if (banks.length === 0) {
    return res.status(404).json({ message: "Question bank type not found." });
  }

  const bankIds = new Set(banks.map((bank) => bank.id));
  const requestedTypes = QUESTION_TYPES
    .map((type) => type.value)
    .map((type) => ({
      type,
      count: Math.min(Math.max(Number(typeCountsInput[type]) || 0, 0), 100),
    }))
    .filter((item) => item.count > 0);

  if (requestedTypes.length === 0) {
    return res.status(400).json({ message: "Please choose at least one question type and count." });
  }

  const questions = requestedTypes.flatMap((item) => {
    const sourceQuestions = getQuestions().filter(
      (question) => bankIds.has(question.bank_id) && question.type === item.type
    );
    return pickRandom(sourceQuestions, item.count);
  });

  if (questions.length === 0) {
    return res.status(400).json({ message: "No questions are available for this filter." });
  }

  const paperId = store.nextId("exam_papers");

  getExamPapers().push({
    id: paperId,
    user_id: req.user.id,
    title,
    selected_types: requestedTypes.map((item) => item.type),
    question_ids: questions.map((item) => item.id),
    status: "pending",
    score: 0,
    total_score: questions.length,
    created_at: store.now(),
    submitted_at: null,
  });
  store.save();

  res.status(201).json({
    paperId,
    bankType,
    bankName: bankType,
    title,
    total: questions.length,
    typeCounts: Object.fromEntries(requestedTypes.map((item) => [item.type, item.count])),
    questions: questions.map(sanitizeQuestionForStudent),
  });
});

app.post("/api/exams/:id/submit", requireAuth, (req, res) => {
  const paperId = Number(req.params.id);
  const paper = getExamPapers().find(
    (item) => item.id === paperId && item.user_id === req.user.id
  );

  if (!paper) {
    return res.status(404).json({ message: "Paper not found." });
  }

  if (paper.status === "submitted") {
    return res.status(400).json({ message: "This paper was already submitted." });
  }

  const answerMap = Array.isArray(req.body?.answers)
    ? new Map(req.body.answers.map((item) => [Number(item.questionId), item.answer]))
    : new Map();

  const questions = getQuestions().filter((question) => paper.question_ids.includes(question.id));

  let score = 0;
  const details = [];

  for (const question of questions) {
    const submittedAnswer = answerMap.get(question.id);
    const isCorrect = gradeQuestion(question, submittedAnswer);
    const scoreAwarded = isCorrect ? 1 : 0;

    getExamAnswers().push({
      id: store.nextId("exam_answers"),
      paper_id: paperId,
      user_id: req.user.id,
      question_id: question.id,
      submitted_answer: submittedAnswer ?? null,
      is_correct: isCorrect ? 1 : 0,
      score_awarded: scoreAwarded,
    });

    if (!isCorrect) {
      recordWrongQuestion(req.user.id, question.id, submittedAnswer);
    }

    score += scoreAwarded;
    details.push({
      id: question.id,
      bankId: question.bank_id,
      bankName: getQuestionBankById(question.bank_id)?.name || "未命名题库",
      stem: question.stem,
      type: question.type,
      yourAnswer: submittedAnswer ?? "",
      isCorrect,
      correctAnswer: formatCorrectAnswer(question),
      analysis: question.analysis,
    });
  }

  paper.status = "submitted";
  paper.score = score;
  paper.submitted_at = store.now();
  store.save();

  res.json({
    paperId,
    title: paper.title,
    score,
    totalScore: paper.question_ids.length,
    details,
  });
});

app.get("/api/wrong-book", requireAuth, (req, res) => {
  const type = String(req.query.type || "").trim();
  const bankId = normalizeBankId(req.query.bankId);

  if (bankId && !ensureQuestionBank(bankId)) {
    return res.status(404).json({ message: "Question bank not found." });
  }

  const records = [...getWrongQuestions()]
    .filter((item) => item.user_id === req.user.id)
    .map((record) => {
      const question = getQuestionById(record.question_id);

      if (!question) {
        return null;
      }

      const bank = getQuestionBankById(question.bank_id);

      return {
        questionId: record.question_id,
        wrongCount: record.wrong_count,
        lastWrongAt: record.last_wrong_at,
        lastAnswer: record.last_answer,
        question: {
          id: question.id,
          bankId: question.bank_id,
          bankName: bank?.name || "未命名题库",
          type: question.type,
          stem: question.stem,
          options: question.options,
          analysis: question.analysis,
          correctAnswer: formatCorrectAnswer(question),
        },
      };
    })
    .filter(Boolean)
    .filter((item) => (type ? item.question.type === type : true))
    .filter((item) => (bankId ? item.question.bankId === bankId : true))
    .sort((a, b) => new Date(b.lastWrongAt) - new Date(a.lastWrongAt));

  res.json(records);
});

app.post("/api/wrong-book/:questionId/remove", requireAuth, (req, res) => {
  const questionId = Number(req.params.questionId);
  store.state.wrong_questions = getWrongQuestions().filter(
    (item) => !(item.user_id === req.user.id && item.question_id === questionId)
  );
  store.save();
  res.json({ success: true });
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/{*any}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

ensureDailyAutoBackup();
setInterval(() => {
  try {
    ensureDailyAutoBackup();
  } catch (error) {
    console.error("Auto backup failed:", error);
  }
}, 60 * 60 * 1000);

app.listen(PORT, HOST, () => {
  console.log(`Neko Study server running at http://${HOST}:${PORT}`);
});
