import { useEffect, useMemo, useRef, useState } from "react";

const QUESTION_TYPES = [
  { value: "single_choice", label: "单选题" },
  { value: "multiple_choice", label: "多选题" },
  { value: "true_false", label: "判断题" },
  { value: "short_answer", label: "简答题" },
];

function Modal({ title, children, onClose, footer }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function getEmptyAnswer(questionType) {
  if (questionType === "multiple_choice") {
    return [];
  }

  if (questionType === "true_false") {
    return null;
  }

  return "";
}

function formatTypeLabel(type) {
  return QUESTION_TYPES.find((item) => item.value === type)?.label || type;
}

function formatAnswerText(answer) {
  if (Array.isArray(answer)) {
    return answer.join(", ");
  }

  if (typeof answer === "boolean") {
    return answer ? "正确" : "错误";
  }

  if (answer && typeof answer === "object") {
    return answer.reference || JSON.stringify(answer);
  }

  return answer ? String(answer) : "未作答";
}

function getQuestionBankName(banks, bankId) {
  return banks.find((bank) => bank.id === Number(bankId))?.name || "";
}

function AuthCard({ onLogin, onRegister, loading, error }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="logo-wrapper">
          <img src="/logo.png" alt="Neko Study Logo" className="logo-img" />
        </div>

        <div className="auth-switch">
          <button
            className={mode === "login" ? "ghost-btn selected full" : "ghost-btn full"}
            onClick={() => setMode("login")}
            type="button"
          >
            登录
          </button>
          <button
            className={mode === "register" ? "ghost-btn selected full" : "ghost-btn full"}
            onClick={() => setMode("register")}
            type="button"
          >
            注册
          </button>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "register") {
              onRegister({ username, password, confirmPassword });
              return;
            }

            onLogin({ username, password });
          }}
        >
          <label>
            <span>用户名</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {mode === "register" ? (
            <label>
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
          ) : null}
          {error ? <div className="alert error">{error}</div> : null}
          <button className="primary-btn full" disabled={loading} type="submit">
            {loading ? (mode === "register" ? "注册中..." : "登录中...") : mode === "register" ? "注册并进入系统" : "登录系统"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

function TypeSelector({ selectedTypes, onChange }) {
  function toggleType(type) {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((item) => item !== type));
      return;
    }

    onChange([...selectedTypes, type]);
  }

  return (
    <div className="type-grid">
      {QUESTION_TYPES.map((type) => (
        <button
          key={type.value}
          className={selectedTypes.includes(type.value) ? "type-chip active" : "type-chip"}
          onClick={() => toggleType(type.value)}
          type="button"
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

function BankSelector({
  banks,
  value,
  onChange,
  placeholder = "请选择题库",
  allowEmpty = false,
  emptyLabel = "全部题库",
}) {
  return (
    <select onChange={(event) => onChange(event.target.value)} value={value}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {!allowEmpty && banks.length === 0 ? <option value="">{placeholder}</option> : null}
      {banks.map((bank) => (
        <option key={bank.id} value={bank.id}>
          {bank.name}
        </option>
      ))}
    </select>
  );
}

function AnswerInput({ question, value, onChange, disabled = false }) {
  if (!question) {
    return null;
  }

  if (question.type === "single_choice") {
    return (
      <div className="answer-stack">
        {question.options.map((option) => (
          <label className="option-card" key={option.label}>
            <input
              checked={value === option.label}
              disabled={disabled}
              name={`single-${question.id}`}
              onChange={() => onChange(option.label)}
              type="radio"
            />
            <span>
              {option.label}. {option.text}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const current = Array.isArray(value) ? value : [];

    return (
      <div className="answer-stack">
        {question.options.map((option) => (
          <label className="option-card" key={option.label}>
            <input
              checked={current.includes(option.label)}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange([...current, option.label].sort());
                } else {
                  onChange(current.filter((item) => item !== option.label));
                }
              }}
              type="checkbox"
            />
            <span>
              {option.label}. {option.text}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "true_false") {
    return (
      <div className="boolean-actions">
        <button
          className={value === true ? "ghost-btn selected" : "ghost-btn"}
          disabled={disabled}
          onClick={() => onChange(true)}
          type="button"
        >
          正确
        </button>
        <button
          className={value === false ? "ghost-btn selected" : "ghost-btn"}
          disabled={disabled}
          onClick={() => onChange(false)}
          type="button"
        >
          错误
        </button>
      </div>
    );
  }

  return (
    <textarea
      className="essay-input"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="请输入你的简答内容"
      rows={6}
      value={value || ""}
    />
  );
}

function OverviewPanel({ user, summary }) {
  const cards = [
    { title: "题目总量", value: summary?.questionTotal ?? 0, hint: "系统内可用题目总数" },
    { title: "练习记录", value: summary?.practiceTotal ?? 0, hint: "累计提交的练习次数" },
    { title: "考试次数", value: summary?.examTotal ?? 0, hint: "已生成的试卷数量" },
    { title: "错题本", value: summary?.wrongTotal ?? 0, hint: "当前沉淀的错题数量" },
  ];

  if (user.role === "admin") {
    cards.unshift({
      title: "用户数量",
      value: summary?.userTotal ?? 0,
      hint: "系统中的账户总数",
    });
    cards.push({
      title: "题库",
      value: summary?.questionBankTotal ?? 0,
      hint: "当前可用的题库数量",
    });
    cards.push({
      title: "未交卷试卷",
      value: summary?.pendingPaperTotal ?? 0,
      hint: "已生成但尚未提交的试卷数量",
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{user.role === "admin" ? "管理员总览" : "学习总览"}</h2>
          <p className="muted">
            当前登录用户：{user.username}，身份为{user.role === "admin" ? "管理员" : "普通用户"}。
          </p>
        </div>
      </div>
      <div className="stats-grid">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

function PracticePanel({ api, banks, onRefreshSummary, showMessage }) {
  const [phase, setPhase] = useState("selecting"); // selecting, configuring, practicing
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(QUESTION_TYPES.map((item) => item.value));
  const [mode, setMode] = useState("sequential");
  const [limit, setLimit] = useState(0); // 0 means all
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState({}); // questionId -> result

  const currentQuestion = questions[currentIndex];
  const selectedBank = banks.find((b) => String(b.id) === String(selectedBankId));
  const currentResult = currentQuestion ? results[currentQuestion.id] : null;

  useEffect(() => {
    if (currentQuestion) {
      const savedResult = results[currentQuestion.id];
      if (savedResult) {
        setAnswer(savedResult.userAnswer);
      } else {
        setAnswer(getEmptyAnswer(currentQuestion.type));
      }
    }
  }, [currentIndex, currentQuestion?.id, results]);

  async function startPractice() {
    if (!selectedBankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setLoading(true);
    try {
      const queryLimit = limit > 0 ? limit : 9999;
      const data = await api(
        `/api/practice/questions?bankId=${selectedBankId}&mode=${mode}&types=${selectedTypes.join(",")}&limit=${queryLimit}`
      );
      
      if (data.length === 0) {
        showMessage("所选范围内没有题目", "error");
        return;
      }

      setQuestions(data);
      setCurrentIndex(0);
      setResults({});
      setPhase("practicing");
      showMessage(`已加载 ${data.length} 道练习题`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(overrideAnswer) {
    if (!currentQuestion || results[currentQuestion.id]) {
      return;
    }

    const finalAnswer = overrideAnswer !== undefined ? overrideAnswer : answer;

    try {
      const data = await api("/api/practice/submit", {
        method: "POST",
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: finalAnswer,
          mode,
        }),
      });

      const resultData = { 
        ...data,
        userAnswer: finalAnswer
      };
      if (currentQuestion.type === "short_answer") {
        resultData.isViewOnly = true;
      }

      setResults((prev) => ({
        ...prev,
        [currentQuestion.id]: resultData
      }));
      onRefreshSummary();

      // Auto-advance for single choice and true/false if correct
      if (data.isCorrect && (currentQuestion.type === "single_choice" || currentQuestion.type === "true_false")) {
        setTimeout(() => {
          handleNext();
        }, 1000);
      }
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function handleExit() {
    setPhase("selecting");
    setSelectedBankId("");
    setQuestions([]);
    setResults({});
  }

  function handleAnswerChange(val) {
    setAnswer(val);
    // Immediate submission for single choice and true/false
    if (currentQuestion && (currentQuestion.type === "single_choice" || currentQuestion.type === "true_false")) {
      submitAnswer(val);
    }
  }

  if (phase === "selecting") {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>选择题库</h2>
            <p className="muted">请先从下方选择一个题库开始练习。</p>
          </div>
        </div>
        <div className="bank-grid">
          {banks.map((bank) => (
            <div
              className="bank-card"
              key={bank.id}
              onClick={() => {
                setSelectedBankId(String(bank.id));
                setPhase("configuring");
              }}
            >
              <div className="bank-meta">
                <span className="bank-badge">{bank.questionCount} 题</span>
                <span className="bank-id">#{bank.id}</span>
              </div>
              <h3 className="bank-name">{bank.name}</h3>
              <p className="bank-desc">{bank.description || "暂无简介"}</p>
            </div>
          ))}
          {banks.length === 0 ? <div className="empty-state">当前还没有题库</div> : null}
        </div>
      </section>
    );
  }

  if (phase === "configuring") {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>配置练习：{selectedBank?.name}</h2>
            <p className="muted">设置您的练习偏好，如题型、顺序及数量。</p>
          </div>
          <button className="ghost-btn" onClick={() => setPhase("selecting")} type="button">
            返回
          </button>
        </div>

        <div className="toolbar" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          <div className="toolbar-block">
            <span className="toolbar-title">题型筛选</span>
            <TypeSelector onChange={setSelectedTypes} selectedTypes={selectedTypes} />
          </div>
          <div className="toolbar-block">
            <span className="toolbar-title">刷题顺序</span>
            <div className="mode-switch">
              <button
                className={mode === "sequential" ? "ghost-btn selected" : "ghost-btn"}
                onClick={() => setMode("sequential")}
                type="button"
              >
                顺序刷题
              </button>
              <button
                className={mode === "random" ? "ghost-btn selected" : "ghost-btn"}
                onClick={() => setMode("random")}
                type="button"
              >
                乱序刷题
              </button>
            </div>
          </div>
          <div className="toolbar-block">
            <span className="toolbar-title">题目数量</span>
            <select onChange={(e) => setLimit(Number(e.target.value))} value={limit}>
              <option value={0}>全部题目 ({selectedBank?.questionCount})</option>
              <option value={10}>10 道题</option>
              <option value={20}>20 道题</option>
              <option value={50}>50 道题</option>
              <option value={100}>100 道题</option>
            </select>
          </div>
          <div className="toolbar-block" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', height: '100%' }}>
            <button className="primary-btn" disabled={loading} onClick={startPractice} style={{ width: '100%' }} type="button">
              {loading ? "加载中..." : "开始练习"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>正在练习：{selectedBank?.name}</h2>
          <p className="muted">
            当前进度：第 {currentIndex + 1} 题，共 {questions.length} 题。
          </p>
        </div>
        <button className="ghost-btn" onClick={handleExit} type="button">
          退出练习
        </button>
      </div>

      {currentQuestion ? (
        <div className="question-card">
          <div className="question-meta">
            <span>{formatTypeLabel(currentQuestion.type)}</span>
            <span>#{currentQuestion.id}</span>
          </div>
          <h3>{currentQuestion.stem}</h3>
          <AnswerInput disabled={Boolean(currentResult)} onChange={handleAnswerChange} question={currentQuestion} value={answer} />

          <div className="inline-actions">
            <button className="ghost-btn" disabled={currentIndex === 0} onClick={handlePrev} type="button">
              上一题
            </button>
            {currentQuestion.type === "multiple_choice" || currentQuestion.type === "short_answer" ? (
              <button className="primary-btn" disabled={Boolean(currentResult)} onClick={() => submitAnswer()} type="button">
                {currentQuestion.type === "short_answer" ? "查看答案" : "提交答案"}
              </button>
            ) : null}
            <button
              className="ghost-btn"
              disabled={currentIndex >= questions.length - 1}
              onClick={handleNext}
              type="button"
            >
              下一题
            </button>
          </div>

          {currentResult ? (
            <div className={currentResult.isCorrect || currentResult.isViewOnly ? "feedback success" : "feedback error"}>
              {currentResult.isViewOnly ? (
                <strong>参考答案与解析</strong>
              ) : (
                <strong>{currentResult.isCorrect ? "回答正确" : "回答错误"}</strong>
              )}
              <div>正确答案：{currentResult.correctAnswer}</div>
              <div>解析：{currentResult.analysis || "暂无解析"}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PracticePanelV2({ api, banks, onRefreshBanks, onRefreshSummary, showMessage }) {
  const [phase, setPhase] = useState("selecting");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(QUESTION_TYPES.map((item) => item.value));
  const [mode, setMode] = useState("sequential");
  const [limit, setLimit] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState({});

  const currentQuestion = questions[currentIndex];
  const selectedBank = banks.find((bank) => String(bank.id) === String(selectedBankId));
  const currentResult = currentQuestion ? results[currentQuestion.id] : null;

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    const savedResult = results[currentQuestion.id];
    if (savedResult) {
      setAnswer(savedResult.userAnswer);
      return;
    }

    setAnswer(getEmptyAnswer(currentQuestion.type));
  }, [currentIndex, currentQuestion?.id, currentQuestion?.type, results]);

  async function persistProgress(bankId, nextIndex) {
    if (!bankId) {
      return;
    }

    try {
      await api("/api/practice/progress", {
        method: "POST",
        body: JSON.stringify({
          bankId: Number(bankId),
          currentIndex: nextIndex,
        }),
      });
    } catch {}
  }

  async function startPractice(bankId) {
    if (!bankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api("/api/practice/start", {
        method: "POST",
        body: JSON.stringify({
          bankId: Number(bankId),
          mode,
          types: selectedTypes,
          limit,
        }),
      });

      setSelectedBankId(String(bankId));
      setQuestions(data.questions || []);
      setCurrentIndex(data.currentIndex || 0);
      setResults({});
      setPhase("practicing");
      showMessage(`已开始练习，共加载 ${data.total} 道题`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function continuePractice(bankId) {
    if (!bankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api(`/api/practice/continue/${bankId}`);
      setSelectedBankId(String(bankId));
      setQuestions(data.questions || []);
      setCurrentIndex(data.currentIndex || 0);
      setResults({});
      setMode(data.mode || "sequential");
      setSelectedTypes(
        Array.isArray(data.selectedTypes) && data.selectedTypes.length > 0
          ? data.selectedTypes
          : QUESTION_TYPES.map((item) => item.value)
      );
      setPhase("practicing");
      showMessage(`已恢复到上次练习进度，第 ${Number(data.currentIndex || 0) + 1} 题`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(overrideAnswer) {
    if (!currentQuestion || results[currentQuestion.id]) {
      return;
    }

    const finalAnswer = overrideAnswer !== undefined ? overrideAnswer : answer;

    try {
      const data = await api("/api/practice/submit", {
        method: "POST",
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: finalAnswer,
          mode,
        }),
      });

      const resultData = {
        ...data,
        userAnswer: finalAnswer,
      };

      if (currentQuestion.type === "short_answer") {
        resultData.isViewOnly = true;
      }

      setResults((current) => ({
        ...current,
        [currentQuestion.id]: resultData,
      }));
      onRefreshSummary();

      if (data.isCorrect && (currentQuestion.type === "single_choice" || currentQuestion.type === "true_false")) {
        window.setTimeout(() => {
          handleNext();
        }, 1000);
      }
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  function handleNext() {
    if (currentIndex >= questions.length - 1) {
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    persistProgress(selectedBankId, nextIndex);
  }

  function handlePrev() {
    if (currentIndex <= 0) {
      return;
    }

    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
    persistProgress(selectedBankId, nextIndex);
  }

  async function handleExit() {
    await persistProgress(selectedBankId, currentIndex);
    await onRefreshBanks();
    setPhase("selecting");
    setQuestions([]);
    setResults({});
  }

  function handleAnswerChange(value) {
    setAnswer(value);

    if (currentQuestion && (currentQuestion.type === "single_choice" || currentQuestion.type === "true_false")) {
      submitAnswer(value);
    }
  }

  if (phase === "selecting") {
    return (
      <section className="panel">
        <div className="toolbar-grid">
          <div className="toolbar-block">
            <span className="toolbar-title">题型筛选</span>
            <TypeSelector onChange={setSelectedTypes} selectedTypes={selectedTypes} />
          </div>
          <div className="toolbar-block">
            <span className="toolbar-title">刷题顺序</span>
            <div className="mode-switch">
              <button
                className={mode === "sequential" ? "ghost-btn selected" : "ghost-btn"}
                onClick={() => setMode("sequential")}
                type="button"
              >
                顺序
              </button>
              <button
                className={mode === "random" ? "ghost-btn selected" : "ghost-btn"}
                onClick={() => setMode("random")}
                type="button"
              >
                乱序
              </button>
            </div>
          </div>
          <div className="toolbar-block">
            <span className="toolbar-title">题目数量</span>
            <select onChange={(event) => setLimit(Number(event.target.value))} value={limit}>
              <option value={0}>全部题目</option>
              <option value={10}>10 题</option>
              <option value={20}>20 题</option>
              <option value={50}>50 题</option>
              <option value={100}>100 题</option>
            </select>
          </div>
        </div>

        <div className="bank-grid">
          {banks.map((bank) => (
            <div className="bank-card" key={bank.id}>
              <div className="bank-meta">
                <span className="bank-badge">{bank.questionCount} 题</span>
                <span className="bank-id">#{bank.id}</span>
              </div>
              <h3 className="bank-name">{bank.name}</h3>
              <p className="bank-desc">{bank.description || "暂无简介"}</p>
              {bank.practiceProgress?.hasProgress ? (
                <div className="muted" style={{ marginBottom: 12, fontSize: '14px' }}>
                  上次进度：第 {bank.practiceProgress.currentIndex + 1} / {bank.practiceProgress.total} 题
                </div>
              ) : (
                <div className="muted" style={{ marginBottom: 12, fontSize: '14px' }}>
                  暂无练习进度
                </div>
              )}
              <div className="bank-actions">
                <button
                  className="primary-btn"
                  disabled={loading}
                  onClick={() => startPractice(bank.id)}
                  style={{ flex: 1 }}
                  type="button"
                >
                  开始练习
                </button>
                <button
                  className="ghost-btn"
                  disabled={!bank.practiceProgress?.hasProgress || loading}
                  onClick={() => continuePractice(bank.id)}
                  style={{ flex: 1 }}
                  type="button"
                >
                  继续
                </button>
              </div>
            </div>
          ))}
          {banks.length === 0 ? <div className="empty-state">当前还没有可练习的题库</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{selectedBank?.name}</h3>
          <p className="muted">
            当前进度：第 {currentIndex + 1} 题，共 {questions.length} 题。
          </p>
        </div>
        <button className="ghost-btn" onClick={handleExit} type="button">
          退出练习
        </button>
      </div>

      {currentQuestion ? (
        <div className="question-card">
          <div className="question-meta">
            <span>{formatTypeLabel(currentQuestion.type)}</span>
            <span>{currentQuestion.bankName}</span>
            <span>#{currentQuestion.id}</span>
          </div>
          <h3>{currentQuestion.stem}</h3>
          <AnswerInput
            disabled={Boolean(currentResult)}
            onChange={handleAnswerChange}
            question={currentQuestion}
            value={answer}
          />

          <div className="inline-actions">
            <button className="ghost-btn" disabled={currentIndex === 0} onClick={handlePrev} type="button">
              上一题
            </button>
            {currentQuestion.type === "multiple_choice" || currentQuestion.type === "short_answer" ? (
              <button className="primary-btn" disabled={Boolean(currentResult)} onClick={() => submitAnswer()} type="button">
                {currentQuestion.type === "short_answer" ? "查看答案" : "提交答案"}
              </button>
            ) : null}
            <button
              className="ghost-btn"
              disabled={currentIndex >= questions.length - 1}
              onClick={handleNext}
              type="button"
            >
              下一题
            </button>
          </div>

          {currentResult ? (
            <div className={currentResult.isCorrect || currentResult.isViewOnly ? "feedback success" : "feedback error"}>
              {currentResult.isViewOnly ? (
                <strong>参考答案与解析</strong>
              ) : (
                <strong>{currentResult.isCorrect ? "回答正确" : "回答错误"}</strong>
              )}
              <div>正确答案：{currentResult.correctAnswer}</div>
              <div>解析：{currentResult.analysis || "暂无解析"}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MemorizePanel({ api, banks, onRefreshBanks, showMessage }) {
  const [phase, setPhase] = useState("selecting");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(QUESTION_TYPES.map((item) => item.value));
  const [mode, setMode] = useState("sequential");
  const [limit, setLimit] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentQuestion = questions[currentIndex];
  const selectedBank = banks.find((bank) => String(bank.id) === String(selectedBankId));

  async function persistProgress(bankId, nextIndex) {
    if (!bankId) {
      return;
    }

    try {
      await api("/api/memorize/progress", {
        method: "POST",
        body: JSON.stringify({
          bankId: Number(bankId),
          currentIndex: nextIndex,
        }),
      });
    } catch {}
  }

  async function startMemorizing(bankId) {
    if (!bankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api("/api/memorize/start", {
        method: "POST",
        body: JSON.stringify({
          bankId: Number(bankId),
          mode,
          types: selectedTypes,
          limit,
        }),
      });

      setSelectedBankId(String(bankId));
      setQuestions(data.questions || []);
      setCurrentIndex(data.currentIndex || 0);
      setPhase("memorizing");
      showMessage(`已开始背题，共加载 ${data.total} 道题`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function continueMemorizing(bankId) {
    if (!bankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api(`/api/memorize/continue/${bankId}`);
      setSelectedBankId(String(bankId));
      setQuestions(data.questions || []);
      setCurrentIndex(data.currentIndex || 0);
      setMode(data.mode || "sequential");
      setSelectedTypes(
        Array.isArray(data.selectedTypes) && data.selectedTypes.length > 0
          ? data.selectedTypes
          : QUESTION_TYPES.map((item) => item.value)
      );
      setPhase("memorizing");
      showMessage(`已恢复到上次背题进度，第 ${Number(data.currentIndex || 0) + 1} 题`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (currentIndex >= questions.length - 1) {
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    persistProgress(selectedBankId, nextIndex);
  }

  function handlePrev() {
    if (currentIndex <= 0) {
      return;
    }

    const nextIndex = currentIndex - 1;
    setCurrentIndex(nextIndex);
    persistProgress(selectedBankId, nextIndex);
  }

  async function handleExit() {
    await persistProgress(selectedBankId, currentIndex);
    await onRefreshBanks();
    setPhase("selecting");
    setQuestions([]);
  }

  if (phase === "selecting") {
    return (
      <section className="panel">
        <div className="toolbar-grid">
          <div className="toolbar-block">
            <span className="toolbar-title">题型筛选</span>
            <TypeSelector onChange={setSelectedTypes} selectedTypes={selectedTypes} />
          </div>
          <div className="toolbar-block">
            <span className="toolbar-title">背题顺序</span>
            <div className="mode-switch">
              <button
                className={mode === "sequential" ? "ghost-btn selected" : "ghost-btn"}
                onClick={() => setMode("sequential")}
                type="button"
              >
                顺序
              </button>
              <button
                className={mode === "random" ? "ghost-btn selected" : "ghost-btn"}
                onClick={() => setMode("random")}
                type="button"
              >
                乱序
              </button>
            </div>
          </div>
          <div className="toolbar-block">
            <span className="toolbar-title">题目数量</span>
            <select onChange={(event) => setLimit(Number(event.target.value))} value={limit}>
              <option value={0}>全部题目</option>
              <option value={10}>10 题</option>
              <option value={20}>20 题</option>
              <option value={50}>50 题</option>
              <option value={100}>100 题</option>
            </select>
          </div>
        </div>

        <div className="bank-grid">
          {banks.map((bank) => (
            <div className="bank-card" key={bank.id}>
              <div className="bank-meta">
                <span className="bank-badge">{bank.questionCount} 题</span>
                <span className="bank-id">#{bank.id}</span>
              </div>
              <h3 className="bank-name">{bank.name}</h3>
              <p className="bank-desc">{bank.description || "暂无简介"}</p>
              {bank.memorizationProgress?.hasProgress ? (
                <div className="muted" style={{ marginBottom: 12, fontSize: "14px" }}>
                  上次进度：第 {bank.memorizationProgress.currentIndex + 1} / {bank.memorizationProgress.total} 题
                </div>
              ) : (
                <div className="muted" style={{ marginBottom: 12, fontSize: "14px" }}>
                  暂无背题进度
                </div>
              )}
              <div className="bank-actions">
                <button
                  className="primary-btn"
                  disabled={loading}
                  onClick={() => startMemorizing(bank.id)}
                  style={{ flex: 1 }}
                  type="button"
                >
                  开始背题
                </button>
                <button
                  className="ghost-btn"
                  disabled={!bank.memorizationProgress?.hasProgress || loading}
                  onClick={() => continueMemorizing(bank.id)}
                  style={{ flex: 1 }}
                  type="button"
                >
                  继续背题
                </button>
              </div>
            </div>
          ))}
          {banks.length === 0 ? <div className="empty-state">当前还没有可背题的题库</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{selectedBank?.name}</h3>
          <p className="muted">
            当前进度：第 {currentIndex + 1} 题，共 {questions.length} 题。
          </p>
        </div>
        <button className="ghost-btn" onClick={handleExit} type="button">
          退出背题
        </button>
      </div>

      {currentQuestion ? (
        <div className="question-card">
          <div className="question-meta">
            <span>{formatTypeLabel(currentQuestion.type)}</span>
            <span>{currentQuestion.bankName}</span>
            <span>#{currentQuestion.id}</span>
          </div>
          <h3>{currentQuestion.stem}</h3>

          {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
            <div className="answer-stack">
              {currentQuestion.options.map((option) => (
                <div className="option-card readonly-option-card" key={option.label}>
                  <span>
                    {option.label}. {option.text}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="feedback success">
            <strong>参考答案</strong>
            <div>答案：{currentQuestion.correctAnswer || formatAnswerText(currentQuestion.answer)}</div>
            <div>解析：{currentQuestion.analysis || "暂无解析"}</div>
          </div>

          <div className="inline-actions">
            <button className="ghost-btn" disabled={currentIndex === 0} onClick={handlePrev} type="button">
              上一题
            </button>
            <button
              className="ghost-btn"
              disabled={currentIndex >= questions.length - 1}
              onClick={handleNext}
              type="button"
            >
              下一题
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ExamPanel({ api, banks, onRefreshSummary, showMessage }) {
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(QUESTION_TYPES.map((item) => item.value));
  const [count, setCount] = useState(10);
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedBankId && banks.length > 0) {
      setSelectedBankId(String(banks[0].id));
      return;
    }

    if (selectedBankId && !banks.some((bank) => String(bank.id) === String(selectedBankId))) {
      setSelectedBankId(banks.length > 0 ? String(banks[0].id) : "");
    }
  }, [banks, selectedBankId]);

  async function generatePaper() {
    if (!selectedBankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    try {
      const data = await api("/api/exams/generate", {
        method: "POST",
        body: JSON.stringify({
          bankId: Number(selectedBankId),
          types: selectedTypes,
          count,
          title: `自定义试卷 ${new Date().toLocaleString()}`,
        }),
      });
      setPaper(data);
      setAnswers({});
      setResult(null);
      showMessage(`试卷生成成功，共 ${data.total} 道题`);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function submitExam() {
    if (!paper) {
      return;
    }

    setSubmitting(true);
    try {
      const data = await api(`/api/exams/${paper.paperId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: paper.questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] ?? getEmptyAnswer(question.type),
          })),
        }),
      });
      setResult(data);
      onRefreshSummary();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>随机组卷考试</h2>
          <p className="muted">按题库和题型范围随机组卷，交卷后自动统计成绩并收录错题。</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-block">
          <span className="toolbar-title">题库</span>
          <BankSelector
            banks={banks}
            onChange={setSelectedBankId}
            placeholder="请先选择题库"
            value={selectedBankId}
          />
        </div>
        <div className="toolbar-block">
          <span className="toolbar-title">题型范围</span>
          <TypeSelector onChange={setSelectedTypes} selectedTypes={selectedTypes} />
        </div>
        <label className="count-input">
          <span>题目数量</span>
          <input
            max={100}
            min={1}
            onChange={(event) => setCount(Number(event.target.value))}
            type="number"
            value={count}
          />
        </label>
        <button className="primary-btn" onClick={generatePaper} type="button">
          生成试卷
        </button>
      </div>

      {paper ? (
        <div className="exam-paper">
          <div className="exam-head">
            <div>
              <h3>{paper.title}</h3>
              <p className="muted">
                当前题库：{paper.bankName}，共 {paper.total} 道题。
              </p>
            </div>
            {!result ? (
              <button className="primary-btn" disabled={submitting} onClick={submitExam} type="button">
                {submitting ? "交卷中..." : "提交试卷"}
              </button>
            ) : null}
          </div>

          <div className="exam-list">
            {paper.questions.map((question, index) => (
              <div className="exam-question" key={question.id}>
                <div className="question-meta">
                  <span>
                    {index + 1}. {formatTypeLabel(question.type)}
                  </span>
                  <span>{question.bankName}</span>
                </div>
                <h4>{question.stem}</h4>
                <AnswerInput
                  disabled={Boolean(result)}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: value,
                    }))
                  }
                  question={question}
                  value={answers[question.id] ?? getEmptyAnswer(question.type)}
                />
              </div>
            ))}
          </div>

          {result ? (
            <div className="result-panel">
              <div className="result-score">
                本次得分：{result.score} / {result.totalScore}
              </div>
              {result.details.map((detail) => (
                <div className={detail.isCorrect ? "feedback success" : "feedback error"} key={detail.id}>
                  <strong>{detail.stem}</strong>
                  <div>所属题库：{detail.bankName}</div>
                  <div>你的答案：{formatAnswerText(detail.yourAnswer)}</div>
                  <div>正确答案：{detail.correctAnswer}</div>
                  <div>解析：{detail.analysis || "暂无解析"}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">选择题库和题型范围后，即可随机生成一份考试试卷。</div>
      )}
    </section>
  );
}

function WrongBookPanel({ api, banks, showMessage }) {
  const [records, setRecords] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");

  async function loadWrongBook() {
    try {
      const params = new URLSearchParams();
      if (filterType) {
        params.set("type", filterType);
      }
      if (selectedBankId) {
        params.set("bankId", selectedBankId);
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await api(`/api/wrong-book${suffix}`);
      setRecords(data);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  useEffect(() => {
    loadWrongBook();
  }, [filterType, selectedBankId]);

  async function removeQuestion(questionId) {
    try {
      await api(`/api/wrong-book/${questionId}/remove`, { method: "POST" });
      showMessage("已从错题本移除");
      loadWrongBook();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>错题本</h2>
          <p className="muted">系统会自动收集做错的练习题和考试题，方便按题库集中复习。</p>
        </div>
        <div className="filter-row">
          <BankSelector
            allowEmpty
            banks={banks}
            emptyLabel="全部题库"
            onChange={setSelectedBankId}
            value={selectedBankId}
          />
          <select onChange={(event) => setFilterType(event.target.value)} value={filterType}>
            <option value="">全部题型</option>
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {records.length > 0 ? (
        <div className="wrong-grid">
          {records.map((record) => (
            <div className="wrong-card" key={record.questionId}>
              <div className="question-meta">
                <span>{record.question.bankName}</span>
                <span>{formatTypeLabel(record.question.type)}</span>
                <span>累计错题 {record.wrongCount} 次</span>
              </div>
              <h3>{record.question.stem}</h3>
              <div className="muted">你的上次答案：{formatAnswerText(record.lastAnswer)}</div>
              <div className="muted">正确答案：{record.question.correctAnswer}</div>
              <div className="muted">解析：{record.question.analysis || "暂无解析"}</div>
              <button className="ghost-btn" onClick={() => removeQuestion(record.questionId)} type="button">
                标记为已掌握
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">当前错题本为空，继续加油练习。</div>
      )}
    </section>
  );
}

function AdminUsersPanel({ api, showMessage }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "user" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  async function loadUsers() {
    try {
      const data = await api("/api/admin/users");
      setUsers(data);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function submitForm(event) {
    event.preventDefault();

    try {
      if (editingUser) {
        await api(`/api/admin/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify({
            role: form.role,
            password: form.password || "",
          }),
        });
        showMessage("用户信息已更新");
      } else {
        await api("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(form),
        });
        showMessage("用户创建成功");
      }
      closeModal();
      loadUsers();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  function startEdit(user) {
    setEditingUser(user);
    setForm({ username: user.username, password: "", role: user.role });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingUser(null);
    setForm({ username: "", password: "", role: "user" });
  }

  async function deleteUser(userId) {
    if (!window.confirm("确定要删除此账户吗？")) return;
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      showMessage("用户已删除");
      loadUsers();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>账户管理</h2>
          <p className="muted">管理系统访问权限。您可以新建账户、调整角色、重置密码或删除不再需要的账户。</p>
        </div>
        <button className="primary-btn" onClick={() => setIsModalOpen(true)} type="button">
          新建账户
        </button>
      </div>

      <div className="user-list-header">
        <span>ID</span>
        <span>用户名</span>
        <span>角色</span>
        <span>注册时间</span>
        <span style={{ textAlign: 'right' }}>操作</span>
      </div>

      <div className="user-list">
        {users.map((user) => (
          <div className="user-item" key={user.id}>
            <div className="id-col">#{user.id}</div>
            <div className="name-col">{user.username}</div>
            <div className="role-col">
              <span className="bank-badge">{user.role === "admin" ? "管理员" : "普通用户"}</span>
            </div>
            <div className="time-col">{new Date(user.created_at).toLocaleString()}</div>
            <div className="actions-col">
              <button className="text-btn" onClick={() => startEdit(user)} type="button">
                编辑
              </button>
              <button className="text-btn danger" onClick={() => deleteUser(user.id)} type="button">
                删除
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 ? <div className="empty-state">系统中暂无账户信息</div> : null}
      </div>

      {isModalOpen && (
        <Modal onClose={closeModal} title={editingUser ? "编辑账户" : "新建账户"}>
          <form className="admin-form" onSubmit={submitForm}>
            <label>
              <span>用户名</span>
              <input
                disabled={Boolean(editingUser)}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="请输入用户名"
                value={form.username}
              />
            </label>
            <label>
              <span>{editingUser ? "重置密码 (留空则不修改)" : "登录密码"}</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={editingUser ? "不修改请留空" : "请输入密码"}
                type="password"
                value={form.password}
              />
            </label>
            <label>
              <span>用户角色</span>
              <select
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                value={form.role}
              >
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </label>
            <div className="modal-footer" style={{ padding: '20px 0 0', border: 'none' }}>
              <button className="ghost-btn" onClick={closeModal} type="button">
                取消
              </button>
              <button className="primary-btn" type="submit">
                {editingUser ? "保存修改" : "立即创建"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function createChoiceOptions(count = 4) {
  return Array.from({ length: count }, (_, index) => ({
    label: String.fromCharCode(65 + index),
    text: "",
  }));
}

function createEmptyQuestionDraft(type = "single_choice") {
  if (type === "single_choice") {
    return {
      type,
      stem: "",
      analysis: "",
      options: createChoiceOptions(),
      answer: "",
    };
  }

  if (type === "multiple_choice") {
    return {
      type,
      stem: "",
      analysis: "",
      options: createChoiceOptions(),
      answer: [],
    };
  }

  if (type === "true_false") {
    return {
      type,
      stem: "",
      analysis: "",
      answer: true,
    };
  }

  return {
    type,
    stem: "",
    analysis: "",
    answer: {
      reference: "",
      keywords: [],
    },
    keywordsText: "",
  };
}

function createQuestionDraft(question) {
  if (!question) {
    return createEmptyQuestionDraft();
  }

  if (question.type === "single_choice") {
    return {
      type: question.type,
      stem: question.stem || "",
      analysis: question.analysis || "",
      options: (question.options || []).map((option, index) => ({
        label: option.label || String.fromCharCode(65 + index),
        text: option.text || "",
      })),
      answer: question.answer || "",
    };
  }

  if (question.type === "multiple_choice") {
    return {
      type: question.type,
      stem: question.stem || "",
      analysis: question.analysis || "",
      options: (question.options || []).map((option, index) => ({
        label: option.label || String.fromCharCode(65 + index),
        text: option.text || "",
      })),
      answer: Array.isArray(question.answer) ? question.answer : [],
    };
  }

  if (question.type === "true_false") {
    return {
      type: question.type,
      stem: question.stem || "",
      analysis: question.analysis || "",
      answer: Boolean(question.answer),
    };
  }

  const reference =
    typeof question.answer === "string"
      ? question.answer
      : question.answer?.reference || "";
  const keywords = Array.isArray(question.answer?.keywords) ? question.answer.keywords : [];

  return {
    type: question.type,
    stem: question.stem || "",
    analysis: question.analysis || "",
    answer: {
      reference,
      keywords,
    },
    keywordsText: keywords.join(", "),
  };
}

function buildQuestionPayload(draft, bankId) {
  const stem = String(draft.stem || "").trim();
  const analysis = String(draft.analysis || "").trim();

  if (!bankId) {
    throw new Error("请先选择题库");
  }

  if (!stem) {
    throw new Error("题干不能为空");
  }

  if (draft.type === "single_choice" || draft.type === "multiple_choice") {
    const options = (draft.options || []).map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: String(option.text || "").trim(),
    }));

    if (options.length < 2) {
      throw new Error("选择题至少需要两个选项");
    }

    if (options.some((option) => !option.text)) {
      throw new Error("选择题选项内容不能为空");
    }

    if (draft.type === "single_choice") {
      const answer = String(draft.answer || "").trim().toUpperCase();

      if (!answer) {
        throw new Error("单选题必须设置正确答案");
      }

      return {
        bankId: Number(bankId),
        type: draft.type,
        stem,
        analysis,
        options,
        answer,
      };
    }

    const answer = Array.isArray(draft.answer)
      ? draft.answer.map((item) => String(item).trim().toUpperCase()).sort()
      : [];

    if (answer.length === 0) {
      throw new Error("多选题至少需要选择一个正确答案");
    }

    return {
      bankId: Number(bankId),
      type: draft.type,
      stem,
      analysis,
      options,
      answer,
    };
  }

  if (draft.type === "true_false") {
    if (typeof draft.answer !== "boolean") {
      throw new Error("判断题必须设置正确答案");
    }

    return {
      bankId: Number(bankId),
      type: draft.type,
      stem,
      analysis,
      answer: draft.answer,
    };
  }

  const keywords = String(draft.keywordsText || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    bankId: Number(bankId),
    type: draft.type,
    stem,
    analysis,
    answer: {
      reference: String(draft.answer?.reference || "").trim(),
      keywords,
    },
  };
}

function AdminQuestionBankPanel({ api, userBanks, onRefreshBanks, onRefreshSummary, showMessage }) {
  const [banks, setBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [bankForm, setBankForm] = useState({ name: "", description: "" });
  const [editingBankId, setEditingBankId] = useState(null);
  const [savingBank, setSavingBank] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [editorMode, setEditorMode] = useState("idle");
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [draft, setDraft] = useState(createEmptyQuestionDraft());
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [deletingBankId, setDeletingBankId] = useState(null);

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  const [backupFiles, setBackupFiles] = useState([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [restoringBackupName, setRestoringBackupName] = useState("");
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);

  const fileInputRef = useRef(null);
  const backupFileInputRef = useRef(null);

  async function loadBanks() {
    try {
      const data = await api("/api/admin/question-banks");
      setBanks(data);
      setSelectedBankId((current) => {
        if (current && data.some((bank) => String(bank.id) === String(current))) {
          return current;
        }
        return data.length > 0 ? String(data[0].id) : "";
      });
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function loadQuestions(bankId = selectedBankId) {
    if (!bankId) {
      setQuestions([]);
      return;
    }

    try {
      const data = await api(
        `/api/admin/questions?bankId=${bankId}&type=${filterType}&search=${encodeURIComponent(search)}`
      );
      setQuestions(data);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function loadBackups() {
    try {
      const data = await api("/api/admin/backups");
      setBackupFiles(Array.isArray(data.backups) ? data.backups : []);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  useEffect(() => {
    loadBanks();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [selectedBankId, filterType, search]);

  useEffect(() => {
    if (userBanks.length > 0 && banks.length === 0) {
      setBanks(userBanks);
    }
  }, [userBanks, banks.length]);

  function resetBankForm() {
    setBankForm({ name: "", description: "" });
    setEditingBankId(null);
    setIsBankModalOpen(false);
  }

  async function submitBankForm(event) {
    event.preventDefault();

    setSavingBank(true);
    try {
      if (editingBankId) {
        await api(`/api/admin/question-banks/${editingBankId}`, {
          method: "PUT",
          body: JSON.stringify(bankForm),
        });
        showMessage("题库已更新");
      } else {
        await api("/api/admin/question-banks", {
          method: "POST",
          body: JSON.stringify(bankForm),
        });
        showMessage("题库创建成功");
      }

      resetBankForm();
      await loadBanks();
      await onRefreshBanks();
      onRefreshSummary();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSavingBank(false);
    }
  }

  function startEditBank(bank) {
    setEditingBankId(bank.id);
    setBankForm({
      name: bank.name,
      description: bank.description || "",
    });
    setSelectedBankId(String(bank.id));
    setIsBankModalOpen(true);
  }

  async function deleteBank(bank) {
    const confirmed = window.confirm(`确认删除题库“${bank.name}”吗？其中题目也会一并删除。`);

    if (!confirmed) {
      return;
    }

    setDeletingBankId(bank.id);
    try {
      await api(`/api/admin/question-banks/${bank.id}`, {
        method: "DELETE",
      });

      if (String(selectedBankId) === String(bank.id)) {
        setSelectedBankId("");
        setQuestions([]);
        setEditorMode("idle");
        setEditingQuestionId(null);
        setDraft(createEmptyQuestionDraft());
      }

      showMessage("题库已删除");
      await loadBanks();
      await onRefreshBanks();
      onRefreshSummary();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setDeletingBankId(null);
    }
  }

  function handleFileChange(event) {
    setSelectedFiles(Array.from(event.target.files || []));
  }

  function handleBackupFileChange(event) {
    setSelectedBackupFile(event.target.files?.[0] || null);
  }

  async function importQuestionsFromFiles() {
    if (!selectedBankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    if (selectedFiles.length === 0) {
      showMessage("请先选择要导入的 JSON 文件", "error");
      return;
    }

    setImporting(true);

    try {
      let importedCount = 0;

      for (const file of selectedFiles) {
        try {
          const text = (await file.text()).replace(/^\uFEFF/, "");
          const parsed = JSON.parse(text);

          if (!Array.isArray(parsed)) {
            throw new Error(`文件 ${file.name} 不是题目数组格式`);
          }

          const result = await api("/api/admin/questions/import", {
            method: "POST",
            body: JSON.stringify({
              bankId: Number(selectedBankId),
              questions: parsed,
            }),
          });

          importedCount += result.importedCount ?? parsed.length;
        } catch (error) {
          error.importFileName = file.name;
          throw error;
        }
      }

      showMessage(`题目导入成功，共导入 ${importedCount} 道题目`);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadBanks();
      await loadQuestions();
      await onRefreshBanks();
      onRefreshSummary();
      setIsImportModalOpen(false);
    } catch (error) {
      const parts = [];

      if (error.importFileName) {
        parts.push(`文件：${error.importFileName}`);
      }

      if (error.questionNumber) {
        parts.push(`题号：第 ${error.questionNumber} 题`);
      }

      if (error.stem) {
        parts.push(`题目：${error.stem}`);
      }

      parts.push(`原因：${error.message || "导入失败"}`);
      showMessage(parts.join("；"), "error");
    } finally {
      setImporting(false);
    }
  }

  async function createBackup() {
    setCreatingBackup(true);
    try {
      const result = await api("/api/admin/backups/create", { method: "POST" });
      showMessage(`备份创建成功：${result.backup?.name || ""}`);
      await loadBackups();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setCreatingBackup(false);
    }
  }

  async function exportBackup() {
    setExportingBackup(true);
    try {
      const result = await api("/api/admin/backups/export");
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.suggestedFileName || "backup.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showMessage("数据导出成功");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setExportingBackup(false);
    }
  }

  async function importBackup() {
    if (!selectedBackupFile) {
      showMessage("请先选择备份文件", "error");
      return;
    }

    const confirmed = window.confirm("导入备份会覆盖当前所有用户和题库数据，确认继续吗？");
    if (!confirmed) {
      return;
    }

    setImportingBackup(true);
    try {
      const text = (await selectedBackupFile.text()).replace(/^\uFEFF/, "");
      const parsed = JSON.parse(text);
      await api("/api/admin/backups/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      showMessage("备份导入成功");
      setSelectedBackupFile(null);
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = "";
      }
      await loadBanks();
      await loadQuestions();
      await loadBackups();
      await onRefreshBanks();
      onRefreshSummary();
    } catch (error) {
      showMessage(error.message || "备份导入失败", "error");
    } finally {
      setImportingBackup(false);
    }
  }

  async function restoreServerBackup(backup) {
    const confirmed = window.confirm(
      `确认快速恢复备份“${backup.name}”吗？该操作会覆盖当前所有用户和题库数据。`
    );

    if (!confirmed) {
      return;
    }

    setRestoringBackupName(backup.name);
    try {
      await api(`/api/admin/backups/restore/${encodeURIComponent(backup.name)}`, {
        method: "POST",
      });
      showMessage(`备份恢复成功：${backup.name}`);
      setSelectedBackupFile(null);
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = "";
      }
      await loadBanks();
      await loadQuestions();
      await loadBackups();
      await onRefreshBanks();
      onRefreshSummary();
    } catch (error) {
      showMessage(error.message || "备份恢复失败", "error");
    } finally {
      setRestoringBackupName("");
    }
  }

  function startCreateQuestion() {
    if (!selectedBankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setEditorMode("create");
    setEditingQuestionId(null);
    setDraft(createEmptyQuestionDraft());
    setIsQuestionModalOpen(true);
  }

  function startEditQuestion(question) {
    setEditorMode("edit");
    setEditingQuestionId(question.id);
    setDraft(createQuestionDraft(question));
    setIsQuestionModalOpen(true);
  }

  function cancelEditQuestion() {
    setEditorMode("idle");
    setEditingQuestionId(null);
    setDraft(createEmptyQuestionDraft());
    setIsQuestionModalOpen(false);
  }

  function updateChoiceOption(index, text) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, text } : option
      ),
    }));
  }

  function addChoiceOption() {
    setDraft((current) => {
      const nextIndex = current.options.length;

      if (nextIndex >= 26) {
        return current;
      }

      return {
        ...current,
        options: [
          ...current.options,
          {
            label: String.fromCharCode(65 + nextIndex),
            text: "",
          },
        ],
      };
    });
  }

  function removeChoiceOption(index) {
    setDraft((current) => {
      if (current.options.length <= 2) {
        return current;
      }

      const nextOptions = current.options
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({
          ...option,
          label: String.fromCharCode(65 + optionIndex),
        }));

      if (current.type === "single_choice") {
        const answerIndex = current.options.findIndex((option) => option.label === current.answer);
        const nextAnswer =
          answerIndex === -1 || answerIndex === index
            ? ""
            : String.fromCharCode(65 + (answerIndex > index ? answerIndex - 1 : answerIndex));

        return {
          ...current,
          options: nextOptions,
          answer: nextAnswer,
        };
      }

      const nextAnswer = (Array.isArray(current.answer) ? current.answer : [])
        .map((label) => current.options.findIndex((option) => option.label === label))
        .filter((answerIndex) => answerIndex !== -1 && answerIndex !== index)
        .map((answerIndex) =>
          String.fromCharCode(65 + (answerIndex > index ? answerIndex - 1 : answerIndex))
        )
        .sort();

      return {
        ...current,
        options: nextOptions,
        answer: nextAnswer,
      };
    });
  }

  function changeDraftType(nextType) {
    setDraft((current) => {
      const nextDraft = createEmptyQuestionDraft(nextType);
      return {
        ...nextDraft,
        stem: current.stem,
        analysis: current.analysis,
      };
    });
  }

  function toggleMultipleAnswer(label) {
    setDraft((current) => {
      const currentAnswer = Array.isArray(current.answer) ? current.answer : [];

      return {
        ...current,
        answer: currentAnswer.includes(label)
          ? currentAnswer.filter((item) => item !== label)
          : [...currentAnswer, label].sort(),
      };
    });
  }

  async function saveQuestion() {
    if (!selectedBankId) {
      showMessage("请先选择题库", "error");
      return;
    }

    setSavingQuestion(true);
    try {
      const payload = buildQuestionPayload(draft, selectedBankId);

      if (editorMode === "edit" && editingQuestionId) {
        await api(`/api/admin/questions/${editingQuestionId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showMessage("题目已更新");
      } else {
        await api("/api/admin/questions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showMessage("题目创建成功");
      }

      await loadBanks();
      await loadQuestions();
      await onRefreshBanks();
      onRefreshSummary();
      cancelEditQuestion();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSavingQuestion(false);
    }
  }

  async function deleteQuestion(question) {
    const confirmed = window.confirm(`确认删除题目 #${question.id} 吗？`);

    if (!confirmed) {
      return;
    }

    setDeletingQuestionId(question.id);

    try {
      await api(`/api/admin/questions/${question.id}`, { method: "DELETE" });
      showMessage("题目已删除");

      if (editingQuestionId === question.id) {
        cancelEditQuestion();
      }

      await loadBanks();
      await loadQuestions();
      await onRefreshBanks();
      onRefreshSummary();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setDeletingQuestionId(null);
    }
  }

  const isChoiceQuestion = draft.type === "single_choice" || draft.type === "multiple_choice";
  const selectedBank = banks.find((bank) => String(bank.id) === String(selectedBankId));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>题库管理</h2>
          <p className="muted">管理您的题库及其包含的题目。支持创建题库、导入题目及维护题目内容。</p>
        </div>
        <div className="inline-actions">
          <button
            className="ghost-btn"
            onClick={() => {
              setIsBackupModalOpen(true);
              loadBackups();
            }}
            type="button"
          >
            数据备份
          </button>
          <button className="primary-btn" onClick={() => setIsBankModalOpen(true)} type="button">
            新建题库
          </button>
        </div>
      </div>

      <div className="bank-grid">
        {banks.map((bank) => (
          <div
            className={String(selectedBankId) === String(bank.id) ? "bank-card active-card" : "bank-card"}
            key={bank.id}
            onClick={() => setSelectedBankId(String(bank.id))}
          >
            <div className="bank-meta">
              <span className="bank-badge">{bank.questionCount} 题</span>
              <span className="bank-id">#{bank.id}</span>
            </div>
            <h3 className="bank-name">{bank.name}</h3>
            <p className="bank-desc">{bank.description || "暂无简介"}</p>
            <div className="bank-actions" onClick={(e) => e.stopPropagation()}>
              <button className="text-btn" onClick={() => startEditBank(bank)} type="button">
                编辑
              </button>
              <button
                className="text-btn danger"
                disabled={deletingBankId === bank.id}
                onClick={() => deleteBank(bank)}
                type="button"
              >
                {deletingBankId === bank.id ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        ))}
        {banks.length === 0 ? <div className="empty-state">当前还没有题库，请先新建。</div> : null}
      </div>

      {selectedBank ? (
        <div className="questions-section">
          <div className="panel-head" style={{ marginTop: '40px' }}>
            <div>
              <h3>题目列表 - {selectedBank.name}</h3>
              <p className="muted">在该题库中进行题目搜索、编辑和导入操作。</p>
            </div>
            <div className="inline-actions">
              <button className="ghost-btn" onClick={() => setIsImportModalOpen(true)} type="button">
                上传导入题目
              </button>
              <button className="primary-btn" onClick={startCreateQuestion} type="button">
                新建题目
              </button>
            </div>
          </div>

          <div className="toolbar" style={{ marginBottom: '24px' }}>
            <div className="toolbar-block">
              <span className="toolbar-title">题型筛选</span>
              <select onChange={(event) => setFilterType(event.target.value)} value={filterType}>
                <option value="">全部题型</option>
                {QUESTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-block">
              <span className="toolbar-title">关键字搜索</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按题干关键字搜索"
                value={search}
              />
            </div>
            <button className="ghost-btn" onClick={() => loadQuestions()} type="button">
              刷新
            </button>
          </div>

          <div className="question-list">
            {questions.map((question) => (
              <div className="mini-question" key={question.id}>
                <div className="question-meta">
                  <span>#{question.id}</span>
                  <span>{formatTypeLabel(question.type)}</span>
                </div>
                <strong>{question.stem}</strong>
                <div className="muted">答案：{formatAnswerText(question.answer)}</div>
                <div className="table-actions">
                  <button className="ghost-btn" onClick={() => startEditQuestion(question)} type="button">
                    编辑
                  </button>
                  <button
                    className="danger-btn"
                    disabled={deletingQuestionId === question.id}
                    onClick={() => deleteQuestion(question)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {questions.length === 0 ? <div className="empty-state small">该题库下暂无符合条件的题目</div> : null}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: '40px' }}>
          请从上方选择一个题库以管理其中的题目。
        </div>
      )}

      {/* Bank Modal */}
      {isBankModalOpen && (
        <Modal
          onClose={resetBankForm}
          title={editingBankId ? "编辑题库" : "新建题库"}
        >
          <form className="admin-form" onSubmit={submitBankForm}>
            <label>
              <span>题库名称</span>
              <input
                autoFocus
                onChange={(event) => setBankForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="请输入题库名称"
                value={bankForm.name}
              />
            </label>
            <label>
              <span>题库简介</span>
              <textarea
                className="essay-input"
                onChange={(event) =>
                  setBankForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="请输入题库简介（可选）"
                rows={4}
                value={bankForm.description}
              />
            </label>
            <div className="modal-footer" style={{ padding: '20px 0 0', border: 'none' }}>
              <button className="ghost-btn" onClick={resetBankForm} type="button">
                取消
              </button>
              <button className="primary-btn" disabled={savingBank} type="submit">
                {savingBank ? "保存中..." : "保存题库"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <Modal
          onClose={() => setIsImportModalOpen(false)}
          title="上传并导入题目"
        >
          <div className="toolbar-block">
            <span className="toolbar-title">选择导入文件</span>
            <p className="muted" style={{ fontSize: '14px', marginBottom: '16px' }}>
              请选择整理好的 JSON 格式题目文件。导入后题目将进入当前题库：{selectedBank?.name}。
            </p>
            <div className="question-list" style={{ marginBottom: '20px' }}>
              {selectedFiles.length > 0 ? (
                selectedFiles.map((file) => (
                  <div className="mini-question" key={file.name}>
                    <strong>{file.name}</strong>
                    <div className="muted">大小：{Math.ceil(file.size / 1024)} KB</div>
                  </div>
                ))
              ) : (
                <div className="empty-state small">当前未选择导入文件</div>
              )}
            </div>
            <div className="inline-actions" style={{ justifyContent: 'flex-start' }}>
              <label className="file-btn">
                选择 JSON 文件
                <input
                  accept=".json,application/json"
                  hidden
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </label>
              <button className="primary-btn" disabled={importing} onClick={importQuestionsFromFiles} type="button">
                {importing ? "正在导入..." : "确认并导入"}
              </button>
              <button className="ghost-btn" onClick={() => setIsImportModalOpen(false)} type="button">
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isBackupModalOpen && (
        <Modal onClose={() => setIsBackupModalOpen(false)} title="数据备份与恢复">
          <div className="toolbar-block">
            <span className="toolbar-title">手动备份</span>
            <p className="muted" style={{ fontSize: "14px", marginBottom: "16px" }}>
              可以立即导出当前完整数据，也可以在服务器本地生成一份备份。系统会每天自动备份一次，并最多保留 5 份。
            </p>
            <div className="inline-actions" style={{ marginBottom: "24px" }}>
              <button className="primary-btn" disabled={exportingBackup} onClick={exportBackup} type="button">
                {exportingBackup ? "导出中..." : "立即导出"}
              </button>
              <button className="ghost-btn" disabled={creatingBackup} onClick={createBackup} type="button">
                {creatingBackup ? "生成中..." : "生成服务器备份"}
              </button>
            </div>

            <span className="toolbar-title">导入备份</span>
            <p className="muted" style={{ fontSize: "14px", marginBottom: "16px" }}>
              导入备份后将覆盖当前数据库中的用户、题库、题目和学习记录，请谨慎操作。
            </p>
            <div className="question-list" style={{ marginBottom: "20px" }}>
              {selectedBackupFile ? (
                <div className="mini-question">
                  <strong>{selectedBackupFile.name}</strong>
                  <div className="muted">大小：{Math.ceil(selectedBackupFile.size / 1024)} KB</div>
                </div>
              ) : (
                <div className="empty-state small">当前未选择备份文件</div>
              )}
            </div>
            <div className="inline-actions" style={{ marginBottom: "24px" }}>
              <label className="file-btn">
                选择备份文件
                <input
                  accept=".json,application/json"
                  hidden
                  onChange={handleBackupFileChange}
                  ref={backupFileInputRef}
                  type="file"
                />
              </label>
              <button className="danger-btn" disabled={importingBackup} onClick={importBackup} type="button">
                {importingBackup ? "导入中..." : "覆盖导入"}
              </button>
            </div>

            <span className="toolbar-title">最近备份</span>
            <div className="question-list">
              {backupFiles.length > 0 ? (
                backupFiles.map((backup) => (
                  <div className="mini-question" key={backup.name}>
                    <strong>{backup.name}</strong>
                    <div className="muted">
                      类型：{backup.type === "auto" ? "自动备份" : "手动备份"} ｜ 时间：
                      {new Date(backup.createdAt).toLocaleString()}
                    </div>
                    <div className="muted">大小：{Math.ceil((backup.size || 0) / 1024)} KB</div>
                    <div className="table-actions" style={{ marginTop: "12px" }}>
                      <button
                        className="ghost-btn"
                        disabled={restoringBackupName === backup.name}
                        onClick={() => restoreServerBackup(backup)}
                        type="button"
                      >
                        {restoringBackupName === backup.name ? "恢复中..." : "快速恢复"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state small">当前还没有备份文件</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Question Modal */}
      {isQuestionModalOpen && (
        <Modal
          onClose={cancelEditQuestion}
          title={editorMode === "create" ? "新建题目" : "编辑题目"}
        >
          <div className="admin-form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <label>
                <span>题型</span>
                <select onChange={(event) => changeDraftType(event.target.value)} value={draft.type}>
                  {QUESTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>所属题库</span>
                <input disabled value={selectedBank?.name || ""} />
              </label>
            </div>

            <label>
              <span>题干</span>
              <textarea
                className="essay-input"
                onChange={(event) => setDraft((current) => ({ ...current, stem: event.target.value }))}
                placeholder="请输入题目内容"
                rows={4}
                value={draft.stem}
              />
            </label>

            {isChoiceQuestion ? (
              <div className="editor-option-list">
                <span className="toolbar-title">选项设置</span>
                {draft.options.map((option, index) => {
                  const isSelected =
                    draft.type === "single_choice"
                      ? draft.answer === option.label
                      : Array.isArray(draft.answer) && draft.answer.includes(option.label);

                  return (
                    <div className="editor-option-row" key={option.label}>
                      <span className="option-badge">{option.label}</span>
                      <input
                        onChange={(event) => updateChoiceOption(index, event.target.value)}
                        placeholder={`选项 ${option.label} 内容`}
                        value={option.text}
                      />
                      <button
                        className={isSelected ? "ghost-btn selected" : "ghost-btn"}
                        onClick={() =>
                          draft.type === "single_choice"
                            ? setDraft((current) => ({ ...current, answer: option.label }))
                            : toggleMultipleAnswer(option.label)
                        }
                        type="button"
                      >
                        {isSelected ? "正确答案" : "设为答案"}
                      </button>
                      <button
                        className="text-btn danger"
                        disabled={draft.options.length <= 2}
                        onClick={() => removeChoiceOption(index)}
                        style={{ padding: '0 8px' }}
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                <button
                  className="ghost-btn"
                  disabled={draft.options.length >= 26}
                  onClick={addChoiceOption}
                  style={{ marginTop: '8px' }}
                  type="button"
                >
                  + 新增选项
                </button>
              </div>
            ) : null}

            {draft.type === "true_false" ? (
              <div className="toolbar-block">
                <span className="toolbar-title">正确答案</span>
                <div className="boolean-actions">
                  <button
                    className={draft.answer === true ? "ghost-btn selected" : "ghost-btn"}
                    onClick={() => setDraft((current) => ({ ...current, answer: true }))}
                    type="button"
                  >
                    正确
                  </button>
                  <button
                    className={draft.answer === false ? "ghost-btn selected" : "ghost-btn"}
                    onClick={() => setDraft((current) => ({ ...current, answer: false }))}
                    type="button"
                  >
                    错误
                  </button>
                </div>
              </div>
            ) : null}

            {draft.type === "short_answer" ? (
              <>
                <label>
                  <span>参考答案</span>
                  <textarea
                    className="essay-input"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        answer: {
                          ...(current.answer || {}),
                          reference: event.target.value,
                        },
                      }))
                    }
                    placeholder="请输入参考答案内容"
                    rows={4}
                    value={draft.answer?.reference || ""}
                  />
                </label>
                <label>
                  <span>得分关键词</span>
                  <input
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        keywordsText: event.target.value,
                      }))
                    }
                    placeholder="多个关键词请用逗号分隔"
                    value={draft.keywordsText || ""}
                  />
                </label>
              </>
            ) : null}

            <label>
              <span>题目解析</span>
              <textarea
                className="essay-input"
                onChange={(event) => setDraft((current) => ({ ...current, analysis: event.target.value }))}
                placeholder="请输入题目解析内容（可选）"
                rows={3}
                value={draft.analysis}
              />
            </label>

            <div className="modal-footer" style={{ padding: '20px 0 0', border: 'none' }}>
              <button className="ghost-btn" onClick={cancelEditQuestion} type="button">
                取消
              </button>
              <button className="primary-btn" disabled={savingQuestion} onClick={saveQuestion} type="button">
                {savingQuestion ? "保存中..." : "保存题目"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("neko-study-token") || "");
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [questionBanks, setQuestionBanks] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const api = useMemo(
    () => async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setToken("");
          setUser(null);
          setQuestionBanks([]);
          localStorage.removeItem("neko-study-token");
        }

        const error = new Error(data.message || "请求失败");
        Object.assign(error, data);
        throw error;
      }

      return data;
    },
    [token]
  );

  function showMessage(message, type = "success") {
    setToast({ message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }

  async function loadCurrentUser(currentToken) {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("登录状态已失效");
    }

    return response.json();
  }

  async function loadSummary() {
    if (!token) {
      return;
    }

    try {
      const data = await api("/api/summary");
      setSummary(data);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function loadQuestionBanks() {
    if (!token) {
      return;
    }

    try {
      const data = await api("/api/question-banks");
      setQuestionBanks(data);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    loadCurrentUser(token)
      .then((currentUser) => setUser(currentUser))
      .catch(() => {
        setToken("");
        setUser(null);
        setQuestionBanks([]);
        localStorage.removeItem("neko-study-token");
      });
  }, [token]);

  useEffect(() => {
    if (user) {
      loadSummary();
      loadQuestionBanks();
    }
  }, [user]);

  async function handleLogin(credentials) {
    setAuthLoading(true);
    setAuthError("");

    try {
      const data = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      }).then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "登录失败");
        }

        return payload;
      });

      localStorage.setItem("neko-study-token", data.token);
      setToken(data.token);
      setUser(data.user);
      setActiveTab("overview");
      showMessage("登录成功");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(payload) {
    setAuthLoading(true);
    setAuthError("");

    try {
      const data = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "注册失败");
        }

        return result;
      });

      localStorage.setItem("neko-study-token", data.token);
      setToken(data.token);
      setUser(data.user);
      setActiveTab("overview");
      showMessage("注册成功，已自动登录");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("neko-study-token");
    setToken("");
    setUser(null);
    setSummary(null);
    setQuestionBanks([]);
    setActiveTab("overview");
  }

  if (!user) {
    return (
      <AuthCard
        error={authError}
        loading={authLoading}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  const tabs = [
    { key: "overview", label: "总览" },
    { key: "practice", label: "刷题" },
    { key: "memorize", label: "背题" },
    { key: "exam", label: "考试" },
    { key: "wrong-book", label: "错题本" },
  ];

  if (user.role === "admin") {
    tabs.push({ key: "admin-users", label: "账户管理" });
    tabs.push({ key: "admin-questions", label: "题库管理" });
  }

  return (
    <div className="app-shell">
      <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(true)} type="button">
        ☰
      </button>

      <div 
        className={isSidebarOpen ? "sidebar-overlay show" : "sidebar-overlay"} 
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={isSidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="brand-area">
          <div className="logo-wrapper">
            <img src="/logo.png" alt="Neko Study Logo" className="logo-img" />
          </div>
        </div>

        <nav className="nav-stack">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.key ? "nav-btn active" : "nav-btn"}
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setIsSidebarOpen(false);
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="profile-info">
            <div className="profile-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="profile-details">
              <div className="profile-name">{user.username}</div>
              <div className="profile-role">
                {user.role === "admin" ? "管理员" : "普通用户"}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout} type="button">
            退出登录
          </button>
        </div>
      </aside>

      <main className="content">
        {toast ? <div className={toast.type === "error" ? "toast error" : "toast"}>{toast.message}</div> : null}

        {activeTab === "overview" ? <OverviewPanel summary={summary} user={user} /> : null}
        {activeTab === "practice" ? (
          <PracticePanelV2
            api={api}
            banks={questionBanks}
            onRefreshBanks={loadQuestionBanks}
            onRefreshSummary={loadSummary}
            showMessage={showMessage}
          />
        ) : null}
        {activeTab === "memorize" ? (
          <MemorizePanel
            api={api}
            banks={questionBanks}
            onRefreshBanks={loadQuestionBanks}
            showMessage={showMessage}
          />
        ) : null}
        {activeTab === "exam" ? (
          <ExamPanel
            api={api}
            banks={questionBanks}
            onRefreshSummary={loadSummary}
            showMessage={showMessage}
          />
        ) : null}
        {activeTab === "wrong-book" ? (
          <WrongBookPanel api={api} banks={questionBanks} showMessage={showMessage} />
        ) : null}
        {activeTab === "admin-users" ? <AdminUsersPanel api={api} showMessage={showMessage} /> : null}
        {activeTab === "admin-questions" ? (
          <AdminQuestionBankPanel
            api={api}
            onRefreshBanks={loadQuestionBanks}
            onRefreshSummary={loadSummary}
            showMessage={showMessage}
            userBanks={questionBanks}
          />
        ) : null}
      </main>
    </div>
  );
}
