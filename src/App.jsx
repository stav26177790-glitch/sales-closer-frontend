import React, { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api"; // задаётся как VITE_API_BASE в Vercel
const MANAGER_ID = "00000000-0000-0000-0000-000000000001"; // временно, до подключения Supabase Auth UI

const CRITERIA = [
  { key: "financial", label: "Финансы" },
  { key: "need", label: "Потребность" },
  { key: "trust", label: "Доверие" },
  { key: "authority", label: "ЛПР" },
  { key: "urgency", label: "Срочность" },
];

const STATUS_COLOR = {
  "Подтверждено": "#6FA888",
  "Вероятно": "#9AA0AC",
  "Неизвестно": "#5B5E68",
  "Риск": "#C97064",
  "": "#33353D",
};

// Полная детализация state machine — 14 состояний, сгруппированы для горизонтального скролла полоски
const STAGES = [
  { key: "INIT", label: "Старт" },
  { key: "COLLECTING", label: "Сбор данных" },
  { key: "SOPRANO_INTERVIEW", label: "Уточнения СОПРАНО" },
  { key: "DIAGNOSING", label: "Диагностика" },
  { key: "CONFLICT_RESOLUTION", label: "Расхождение оценок" },
  { key: "STRATEGY_SELECTION", label: "Стратегия" },
  { key: "COMPOSING", label: "Составление касания" },
  { key: "REVIEWING", label: "Проверка качества" },
  { key: "ESCALATION", label: "Эскалация менеджеру" },
  { key: "MEMORY_UPDATE", label: "Сохранение памяти" },
  { key: "FINAL_OUTPUT", label: "Итог сессии" },
];

// Состояния, которые рендерятся как полноценный шаг в полоске,
// но при этом не являются частью "счастливого пути" — это видно по цвету (янтарь вместо зелёного)
const BRANCH_STATES = new Set(["SOPRANO_INTERVIEW", "CONFLICT_RESOLUTION", "ESCALATION"]);

// LOST_DEAL и DISQUALIFICATION не получают отдельный экран — это другой стиль бабла в общем чате
const TERMINAL_NEGATIVE_STATES = { LOST_DEAL: "lost", DISQUALIFICATION: "disqualified" };

function stageIndex(stateKey) {
  if (TERMINAL_NEGATIVE_STATES[stateKey]) return STAGES.length - 1; // визуально считать завершённым
  const idx = STAGES.findIndex((s) => s.key === stateKey);
  return idx === -1 ? 0 : idx;
}

function StageBar({ stateKey }) {
  const idx = stageIndex(stateKey);
  return (
    <div style={styles.stageBar}>
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        const isBranch = BRANCH_STATES.has(s.key);
        let dotColor = "#33353D";
        if (active) dotColor = isBranch ? "#E8A33D" : "#E8A33D";
        else if (done) dotColor = "#6FA888";
        return (
          <div key={s.key} style={styles.stageItem}>
            <div
              style={{
                ...styles.stageDot,
                background: dotColor,
                boxShadow: active ? "0 0 0 3px rgba(232,163,61,0.18)" : "none",
                border: isBranch && !active && !done ? "1px dashed #5B5E68" : "none",
              }}
            />
            <span
              style={{
                ...styles.stageLabel,
                color: active ? "#EFECE6" : done ? "#9AA0AC" : "#5B5E68",
                fontWeight: active ? 500 : 400,
              }}
            >
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <div style={{ ...styles.stageLine, background: done ? "#6FA888" : "#33353D" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CriteriaBulbs({ criteria }) {
  return (
    <div style={styles.bulbRow}>
      {CRITERIA.map((c) => {
        const status = criteria?.[c.key] || "";
        const color = STATUS_COLOR[status] || STATUS_COLOR[""];
        return (
          <div key={c.key} style={styles.bulbItem} title={status || "не оценено"}>
            <div
              style={{
                ...styles.bulb,
                background: color,
                boxShadow: status && status !== "Риск" && status !== "Неизвестно" ? `0 0 6px ${color}` : "none",
              }}
            />
            <span style={styles.bulbLabel}>{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function bubbleVariant(role, state) {
  if (role === "user") return "user";
  if (TERMINAL_NEGATIVE_STATES[state] === "lost") return "lost";
  if (TERMINAL_NEGATIVE_STATES[state] === "disqualified") return "disqualified";
  if (state === "ESCALATION") return "escalation";
  if (state === "FINAL_OUTPUT") return "final";
  return "agent";
}

const BUBBLE_STYLES = {
  user: { background: "#3A3D47", borderColor: "#4A4D58" },
  agent: { background: "#24262D", borderColor: "#2E303A" },
  final: { background: "#24262D", borderColor: "#E8A33D" },
  escalation: { background: "#2E2620", borderColor: "#9A6B2A" },
  lost: { background: "#2B2222", borderColor: "#7A4A42" },
  disqualified: { background: "#26262A", borderColor: "#5B5E68" },
};

const BUBBLE_TAG = {
  final: "ИТОГ",
  escalation: "ТРЕБУЕТ ВНИМАНИЯ",
  lost: "СДЕЛКА ПОТЕРЯНА",
  disqualified: "НЕ КВАЛИФИЦИРОВАНА",
};

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-manager-id": MANAGER_ID,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка запроса: ${res.status}`);
  }
  return res.json();
}

export default function App() {
  const [deals, setDeals] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newDealForm, setNewDealForm] = useState({ client: "", product: "", deal_size: "", days_silent: 0 });
  const scrollRef = useRef(null);

  const deal = deals.find((d) => d.id === activeId);

  const loadDeals = useCallback(async () => {
    try {
      const { deals } = await api("/deals");
      setDeals(deals);
      if (deals.length && !activeId) setActiveId(deals[0].id);
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message);
    }
  }, [activeId]);

  useEffect(() => {
    loadDeals();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api(`/deals/${activeId}/history`)
      .then(({ messages }) => setMessages(messages))
      .catch((e) => setLoadError(e.message));
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, thinking]);

  async function handleSend() {
    if (!input.trim() || thinking || !activeId) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, state: deal?.current_state }]);
    setThinking(true);
    try {
      const { deal: updatedDeal, reply, state } = await api(`/deals/${activeId}/continue`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((prev) => [...prev, { role: "agent", content: reply, state }]);
      setDeals((prev) => prev.map((d) => (d.id === activeId ? updatedDeal : d)));
    } catch (e) {
      setMessages((prev) => [...prev, { role: "agent", content: `Ошибка: ${e.message}`, state: "ERROR" }]);
    } finally {
      setThinking(false);
    }
  }

  async function handleCreateDeal() {
    if (!newDealForm.client.trim()) return;
    try {
      const { deal } = await api("/deals", {
        method: "POST",
        body: JSON.stringify({
          ...newDealForm,
          deal_size: Number(newDealForm.deal_size) || 0,
          days_silent: Number(newDealForm.days_silent) || 0,
        }),
      });
      setDeals((prev) => [deal, ...prev]);
      setActiveId(deal.id);
      setShowNewDeal(false);
      setNewDealForm({ client: "", product: "", deal_size: "", days_silent: 0 });
    } catch (e) {
      setLoadError(e.message);
    }
  }

  if (loadError) {
    return (
      <div style={{ ...styles.app, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 14 }}>Не удалось подключиться к бэкенду: {loadError}</p>
        <p style={{ fontSize: 12, color: "#8A8D97" }}>
          Проверьте, что сервер запущен и API_BASE указывает на правильный адрес.
        </p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div style={{ ...styles.app, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 14, color: "#8A8D97" }}>Нет сделок. Создайте первую.</p>
        <button style={styles.newDealBtn} onClick={() => setShowNewDeal(true)}>+ Новая сделка</button>
        {showNewDeal && <NewDealForm form={newDealForm} setForm={setNewDealForm} onSubmit={handleCreateDeal} onCancel={() => setShowNewDeal(false)} />}
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.brandMark}>SC</span>
          <span style={styles.brandText}>Sales Closer</span>
          <button style={styles.addBtn} onClick={() => setShowNewDeal(true)} aria-label="Новая сделка">
            <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 16 }} />
          </button>
        </div>
        <div style={styles.dealList}>
          {deals.map((d) => {
            const active = d.id === activeId;
            const stageLabel = STAGES.find((s) => s.key === d.current_state)?.label || d.current_state;
            return (
              <button
                key={d.id}
                onClick={() => setActiveId(d.id)}
                style={{
                  ...styles.dealItem,
                  background: active ? "#2A2C34" : "transparent",
                  borderLeft: active ? "2px solid #E8A33D" : "2px solid transparent",
                }}
              >
                <div style={styles.dealItemTop}>
                  <span style={styles.dealClient}>{d.client}</span>
                  <span style={styles.dealSize}>{d.deal_size ? `${Math.round(d.deal_size / 1000)}к` : "—"}</span>
                </div>
                <div style={styles.dealItemBottom}>
                  <span style={styles.dealProduct}>{d.product || "—"}</span>
                  <span style={styles.dealSilent}>{d.days_silent} дн. молчания</span>
                </div>
                <span style={styles.dealStageTag}>{stageLabel}</span>
              </button>
            );
          })}
        </div>
        {showNewDeal && <NewDealForm form={newDealForm} setForm={setNewDealForm} onSubmit={handleCreateDeal} onCancel={() => setShowNewDeal(false)} />}
      </div>

      <div style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <div style={styles.topBarClient}>{deal.client}</div>
            <div style={styles.topBarMeta}>
              {deal.product || "—"} · {deal.deal_size ? `${Number(deal.deal_size).toLocaleString("ru-RU")} ₽` : "сумма не указана"} · {deal.days_silent} дн. без ответа
            </div>
          </div>
          <CriteriaBulbs criteria={deal.criteria} />
        </div>

        <div style={styles.stageBarScroll}>
          <StageBar stateKey={deal.current_state} />
        </div>

        <div style={styles.thread} ref={scrollRef}>
          {messages.map((m, i) => {
            const variant = bubbleVariant(m.role, m.state);
            const tag = BUBBLE_TAG[variant];
            return (
              <div key={i} style={{ ...styles.bubbleRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ ...styles.bubble, ...BUBBLE_STYLES[variant], whiteSpace: "pre-line" }}>
                  {tag && <div style={styles.bubbleTag}>{tag}</div>}
                  {m.content}
                </div>
              </div>
            );
          })}
          {thinking && (
            <div style={{ ...styles.bubbleRow, justifyContent: "flex-start" }}>
              <div style={{ ...styles.bubble, ...BUBBLE_STYLES.agent }}>
                <span style={styles.typingDots}>
                  <span style={styles.dot} />
                  <span style={{ ...styles.dot, animationDelay: "0.15s" }} />
                  <span style={{ ...styles.dot, animationDelay: "0.3s" }} />
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={styles.inputBar}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Опишите ситуацию по сделке или вставьте переписку…"
            style={styles.textarea}
            rows={2}
          />
          <button onClick={handleSend} disabled={thinking} style={styles.sendBtn}>
            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
        textarea::placeholder { color: #6B6E78; }
        textarea:focus { outline: none; border-color: #E8A33D !important; }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}

function NewDealForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <div style={styles.newDealPanel}>
      <input
        style={styles.newDealInput}
        placeholder="Название клиента"
        value={form.client}
        onChange={(e) => setForm({ ...form, client: e.target.value })}
      />
      <input
        style={styles.newDealInput}
        placeholder="Продукт"
        value={form.product}
        onChange={(e) => setForm({ ...form, product: e.target.value })}
      />
      <input
        style={styles.newDealInput}
        placeholder="Сумма сделки"
        type="number"
        value={form.deal_size}
        onChange={(e) => setForm({ ...form, deal_size: e.target.value })}
      />
      <input
        style={styles.newDealInput}
        placeholder="Дней без ответа"
        type="number"
        value={form.days_silent}
        onChange={(e) => setForm({ ...form, days_silent: e.target.value })}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.newDealBtn} onClick={onSubmit}>Создать</button>
        <button style={styles.cancelBtn} onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

const styles = {
  app: { display: "flex", height: "640px", width: "100%", background: "#1C1D22", color: "#EFECE6", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", borderRadius: "12px", overflow: "hidden", border: "1px solid #2E303A" },
  sidebar: { width: "260px", flexShrink: 0, borderRight: "1px solid #2E303A", display: "flex", flexDirection: "column", background: "#1A1B20" },
  sidebarHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "18px 18px 14px", borderBottom: "1px solid #2E303A" },
  brandMark: { width: "26px", height: "26px", borderRadius: "6px", background: "#E8A33D", color: "#412402", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: "14px", fontWeight: 500, letterSpacing: "0.02em", flex: 1 },
  addBtn: { width: "24px", height: "24px", borderRadius: "6px", background: "transparent", border: "1px solid #33353D", color: "#9AA0AC", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  dealList: { flex: 1, overflowY: "auto", padding: "8px" },
  dealItem: { display: "flex", flexDirection: "column", gap: "4px", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "6px", border: "none", cursor: "pointer", marginBottom: "2px", color: "#EFECE6" },
  dealItemTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  dealClient: { fontSize: "13.5px", fontWeight: 500 },
  dealSize: { fontSize: "12px", color: "#9AA0AC" },
  dealItemBottom: { display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#7D808A" },
  dealProduct: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" },
  dealSilent: { flexShrink: 0 },
  dealStageTag: { fontSize: "10.5px", color: "#E8A33D", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 22px 12px", borderBottom: "1px solid #2E303A" },
  topBarClient: { fontSize: "16px", fontWeight: 500 },
  topBarMeta: { fontSize: "12px", color: "#8A8D97", marginTop: "2px" },
  bulbRow: { display: "flex", gap: "14px" },
  bulbItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" },
  bulb: { width: "9px", height: "9px", borderRadius: "50%" },
  bulbLabel: { fontSize: "9.5px", color: "#7D808A", whiteSpace: "nowrap" },
  stageBarScroll: { overflowX: "auto", borderBottom: "1px solid #2E303A" },
  stageBar: { display: "flex", alignItems: "center", padding: "12px 22px", minWidth: "max-content" },
  stageItem: { display: "flex", alignItems: "center", position: "relative" },
  stageDot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  stageLabel: { fontSize: "11px", marginLeft: "6px", whiteSpace: "nowrap" },
  stageLine: { height: "1px", width: "28px", margin: "0 8px" },
  thread: { flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: "10px" },
  bubbleRow: { display: "flex", width: "100%" },
  bubble: { maxWidth: "78%", padding: "10px 14px", borderRadius: "10px", border: "1px solid", fontSize: "13.5px", lineHeight: 1.55 },
  bubbleTag: { fontSize: "10px", fontWeight: 500, letterSpacing: "0.04em", color: "#E8A33D", marginBottom: "6px" },
  typingDots: { display: "inline-flex", gap: "4px" },
  dot: { width: "5px", height: "5px", borderRadius: "50%", background: "#8A8D97", display: "inline-block", animation: "blink 1.2s infinite" },
  inputBar: { display: "flex", gap: "10px", padding: "14px 22px 18px", borderTop: "1px solid #2E303A", alignItems: "flex-end" },
  textarea: { flex: 1, resize: "none", background: "#24262D", border: "1px solid #33353D", borderRadius: "8px", padding: "9px 12px", color: "#EFECE6", fontSize: "13.5px", fontFamily: "inherit" },
  sendBtn: { width: "36px", height: "36px", borderRadius: "8px", background: "#E8A33D", color: "#1C1D22", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  newDealPanel: { display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderTop: "1px solid #2E303A" },
  newDealInput: { background: "#24262D", border: "1px solid #33353D", borderRadius: "6px", padding: "7px 10px", color: "#EFECE6", fontSize: "12.5px" },
  newDealBtn: { flex: 1, background: "#E8A33D", color: "#1C1D22", border: "none", borderRadius: "6px", padding: "8px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer" },
  cancelBtn: { flex: 1, background: "transparent", color: "#9AA0AC", border: "1px solid #33353D", borderRadius: "6px", padding: "8px", fontSize: "12.5px", cursor: "pointer" },
};
