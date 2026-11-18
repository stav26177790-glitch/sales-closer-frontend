import React from "react";

// Лёгкая разметка ответов Клоузера (её формирует бэкенд, engine/chat.js):
//   ## Заголовок        ### Подзаголовок        ---  разделитель
//   - пункт             1. нумерованный пункт   «  продолжение» — строка пункта
//   **жирный**          _строка-подсказка целиком_
// HTML не используется — только React-элементы, поэтому вставить разметку
// или скрипт через текст сообщения нельзя. Старые сообщения без разметки
// показываются как раньше: абзацы и переносы строк.

const STATUS_COLOR = {
  "Подтверждено": "#6FA888",
  "Вероятно": "#B9BEC8",
  "Неизвестно": "#7D808A",
  "Риск": "#D9826F",
};

function inline(text, keyBase) {
  // **жирный**; сразу после жирной подписи статус СОПРАНО подсвечивается цветом.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const out = [];
  parts.forEach((part, i) => {
    const key = `${keyBase}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      out.push(<strong key={key} style={{ fontWeight: 600, color: "#F3F0EA" }}>{part.slice(2, -2)}</strong>);
      return;
    }
    const prevBold = i > 0 && /^\*\*[^*]+\*\*$/.test(parts[i - 1]);
    const m = prevBold ? part.match(/^(\s*)(Подтверждено|Вероятно|Неизвестно|Риск)(?![А-Яа-яЁё])/) : null;
    if (m) {
      out.push(m[1]);
      out.push(
        <span key={`${key}-s`} style={{ ...s.status, color: STATUS_COLOR[m[2]], borderColor: STATUS_COLOR[m[2]] }}>{m[2]}</span>
      );
      out.push(part.slice(m[0].length));
      return;
    }
    out.push(part);
  });
  return out;
}

function parseBlocks(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let para = null;
  let list = null;
  const flushPara = () => { if (para) blocks.push({ type: "p", lines: para }); para = null; };
  const flushList = () => { if (list) blocks.push(list); list = null; };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushPara(); flushList(); continue; }
    let m;
    if ((m = line.match(/^>>\s?(.*)$/))) {
      // «Наставник»: строки «>> » подряд — один блок «Почему так».
      flushPara(); flushList();
      const last = blocks[blocks.length - 1];
      if (last && last.type === "mentor") last.lines.push(m[1]);
      else blocks.push({ type: "mentor", lines: [m[1]] });
    } else if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      flushPara(); flushList();
      blocks.push({ type: m[1].length === 2 ? "h2" : "h3", text: m[2] });
    } else if (/^-{3,}$/.test(line.trim())) {
      flushPara(); flushList();
      blocks.push({ type: "hr" });
    } else if ((m = line.match(/^- (.*)$/))) {
      flushPara();
      if (!list || list.type !== "ul") { flushList(); list = { type: "ul", items: [] }; }
      list.items.push([m[1]]);
    } else if ((m = line.match(/^(\d+)\. (.*)$/))) {
      flushPara();
      if (!list || list.type !== "ol") { flushList(); list = { type: "ol", items: [] }; }
      list.items.push([m[2]]);
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1].push(line.trim());
    } else if (/^_.+_$/.test(line.trim())) {
      flushPara(); flushList();
      blocks.push({ type: "hint", text: line.trim().slice(1, -1) });
    } else {
      flushList();
      (para = para || []).push(line);
    }
  }
  flushPara(); flushList();
  return blocks;
}

export default function RichText({ text, mentor = true, onRef }) {
  const blocks = parseBlocks(text);
  return (
    <div style={s.root}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case "h2": return <div key={key} style={{ ...s.h2, marginTop: i ? 14 : 0 }}>{inline(b.text, key)}</div>;
          case "h3": return <div key={key} style={{ ...s.h3, marginTop: i ? 10 : 0 }}>{inline(b.text, key)}</div>;
          case "hr": return <div key={key} style={s.hr} />;
          case "hint": return <div key={key} style={s.hint}>{inline(b.text, key)}</div>;
          case "mentor": {
            if (!mentor) return null;
            const [head, ...rest] = b.lines;
            const title = /^\*\*[^*]+\*\*$/.test(head) ? head : null;
            const items = title ? rest : b.lines;
            return (
              <div key={key} style={s.mentor}>
                <div style={s.mentorTitle}>{title ? title.slice(2, -2) : "Почему так"}</div>
                {items.map((l, k) => {
                  // «(Возражения, Переписка)» в конце строки — ссылки на страницы справочника.
                  const ref = onRef ? l.match(/^(.*)\(([^()]+)\)\s*$/) : null;
                  if (!ref) return <div key={k} style={s.mentorLine}>{inline(l, `${key}-${k}`)}</div>;
                  const names = ref[2].split(/,\s*/);
                  return (
                    <div key={k} style={s.mentorLine}>
                      {inline(ref[1], `${key}-${k}`)}(
                      {names.map((n, j) => (
                        <React.Fragment key={j}>{j > 0 && ", "}
                          <button style={s.mentorRef} onClick={() => onRef(n)} title="Открыть в справочнике">{n}</button>
                        </React.Fragment>
                      ))})
                    </div>
                  );
                })}
              </div>
            );
          }
          case "ul":
          case "ol": {
            const Tag = b.type;
            return (
              <Tag key={key} style={s.list}>
                {b.items.map((item, j) => (
                  <li key={`${key}-${j}`} style={s.li}>
                    {item.map((l, k) => (
                      <div key={k} style={k ? s.liMore : undefined}>{inline(l, `${key}-${j}-${k}`)}</div>
                    ))}
                  </li>
                ))}
              </Tag>
            );
          }
          default:
            return (
              <p key={key} style={s.p}>
                {b.lines.map((l, k) => (
                  <React.Fragment key={k}>{k > 0 && <br />}{inline(l, `${key}-${k}`)}</React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

const s = {
  root: { display: "flex", flexDirection: "column", gap: 8 },
  h2: { fontSize: "14.5px", fontWeight: 600, color: "#F3F0EA", letterSpacing: "0.01em" },
  h3: { fontSize: "13.5px", fontWeight: 600, color: "#E8A33D" },
  hr: { height: 1, background: "#3A3D47", margin: "6px 0" },
  hint: { fontSize: "12.5px", color: "#8D919B" },
  mentor: { borderLeft: "2px solid #5A4A2E", background: "rgba(232,163,61,0.06)", padding: "8px 10px", borderRadius: "0 6px 6px 0", display: "flex", flexDirection: "column", gap: 4 },
  mentorTitle: { fontSize: "12px", fontWeight: 600, color: "#E8A33D", letterSpacing: "0.02em" },
  mentorRef: { background: "none", border: "none", padding: 0, color: "#E8A33D", textDecoration: "underline dotted", textUnderlineOffset: 2, cursor: "pointer", font: "inherit" },
  mentorLine: { fontSize: "12.5px", color: "#B9BEC8", lineHeight: 1.45 },
  p: { margin: 0 },
  list: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 },
  li: { paddingLeft: 2 },
  liMore: { color: "#B9BEC8", fontSize: "13px", marginTop: 2 },
  status: { display: "inline-block", fontSize: "12px", fontWeight: 500, padding: "0 7px", borderRadius: 999, border: "1px solid", lineHeight: "18px", marginLeft: 2 },
};
