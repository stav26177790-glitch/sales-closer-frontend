import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Login, { AuthNotConfigured } from "./Login.jsx";
import { supabase, authConfigured } from "./supabase.js";

// Показывает Клоузер только вошедшему менеджеру.
function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = ещё проверяем

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authConfigured) return <AuthNotConfigured />;
  if (session === undefined) return null;
  if (!session) return <Login />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
