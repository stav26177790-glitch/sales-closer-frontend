import React, { useEffect, useState } from "react";
import RichText from "./RichText.jsx";

// Справочник методик (владелец 18.11): страницы приходят с бэкенда (/api/handbook), разметка — как в чате.
// openId — страница, которую открыть сразу (по ссылке из «Наставника»), или "" — первая.
export default function Handbook({ api, openId, onClose }) {
  const [pages, setPages] = useState(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(openId || "");

  useEffect(() => {
    api("/api/handbook")
      .then((r) => setPages(r.pages || []))
      .catch((e) => setError(e.message || "Справочник не загрузился"));
  }, [api]);
  useEffect(() => { if (openId) setCurrent(openId); }, [openId]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const page = pages && (pages.find((p) => p.id === current || p.aliases.includes(current)) || pages[0]);
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <span style={s.title}><i className="ti ti-book" aria-hidden="true" style={{ fontSize: 16 }} /> Справочник методик</span>
          <button style={s.close} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        {error && <div style={s.error}>{error}</div>}
        {!pages && !error && <div style={s.muted}>Загружаю…</div>}
        {pages && (
          <div style={s.body}>
            <div style={s.nav}>
              {pages.map((p) => (
                <button key={p.id} onClick={() => setCurrent(p.id)}
                  style={{ ...s.navItem, ...(page && page.id === p.id ? s.navActive : null) }}>{p.title}</button>
              ))}
            </div>
            <div style={s.page}>{page && <RichText text={page.text} />}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: { position: "fixed", inset: 0, background: "rgba(10,10,14,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  panel: { width: "min(960px, 100%)", height: "min(720px, 100%)", background: "#1F2027", border: "1px solid #33353D", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden", color: "#D9DCE3", fontSize: "13.5px", lineHeight: 1.5 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #2E303A" },
  title: { display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#F3F0EA" },
  close: { background: "transparent", border: "none", color: "#9AA0AC", cursor: "pointer", fontSize: 15 },
  body: { flex: 1, display: "flex", minHeight: 0, flexWrap: "wrap" },
  nav: { width: 230, maxWidth: "100%", borderRight: "1px solid #2E303A", overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 },
  navItem: { textAlign: "left", background: "transparent", border: "none", color: "#B9BEC8", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: "13px" },
  navActive: { background: "rgba(232,163,61,0.10)", color: "#E8A33D" },
  page: { flex: 1, minWidth: 260, overflowY: "auto", padding: "16px 20px" },
  error: { padding: 16, color: "#D9826F" },
  muted: { padding: 16, color: "#8D919B" },
};
