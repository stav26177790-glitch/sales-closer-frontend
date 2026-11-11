import React, { useState } from "react";
import { supabase } from "./supabase.js";

// Вход по ссылке на почту. Регистрация закрыта: shouldCreateUser: false —
// войти может только менеджер, которого заранее добавили в Supabase → Authentication → Users.
export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setError(
        /signups not allowed|not found|invalid/i.test(error.message)
          ? "Этот адрес не зарегистрирован. Попросите администратора добавить вас."
          : error.message
      );
      return;
    }
    setStatus("sent");
  }

  return (
    <div style={s.wrap}>
      <form style={s.card} onSubmit={handleSubmit}>
        <div style={s.brandRow}>
          <span style={s.brandMark}>SC</span>
          <span style={s.brandText}>Sales Closer</span>
        </div>
        {status === "sent" ? (
          <p style={s.text}>
            Ссылка для входа отправлена на <b>{email}</b>. Откройте письмо на этом устройстве и нажмите на ссылку.
          </p>
        ) : (
          <>
            <label style={s.label} htmlFor="email">Рабочая почта</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.ru"
              style={s.input}
              autoFocus
            />
            <button type="submit" style={s.button} disabled={status === "sending"}>
              {status === "sending" ? "Отправляю…" : "Получить ссылку для входа"}
            </button>
            {status === "error" && <p style={s.error}>{error}</p>}
          </>
        )}
      </form>
    </div>
  );
}

export function AuthNotConfigured() {
  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <p style={s.text}>
          Вход не настроен: в Netlify не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.
        </p>
      </div>
    </div>
  );
}

const s = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1C1D22", color: "#EFECE6", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 16 },
  card: { width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 12, background: "#1A1B20", border: "1px solid #2E303A", borderRadius: 12, padding: 24 },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  brandMark: { width: 26, height: 26, borderRadius: 6, background: "#E8A33D", color: "#412402", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 14, fontWeight: 500, letterSpacing: "0.02em" },
  label: { fontSize: 12.5, color: "#9AA0AC" },
  input: { background: "#24262D", border: "1px solid #33353D", borderRadius: 8, padding: "9px 12px", color: "#EFECE6", fontSize: 13.5, fontFamily: "inherit" },
  button: { background: "#E8A33D", color: "#1C1D22", border: "none", borderRadius: 6, padding: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" },
  text: { fontSize: 13.5, lineHeight: 1.5, margin: 0 },
  error: { fontSize: 12.5, color: "#E5806B", margin: 0 },
};
