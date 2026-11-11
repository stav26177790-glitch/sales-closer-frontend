import { createClient } from "@supabase/supabase-js";

// Публичные значения (Project URL и anon key из Supabase → Settings → API).
// Anon key можно держать во фронтенде: доступ к данным всё равно проверяет бэкенд по JWT.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(url && anonKey);

export const supabase = authConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// Свежий access token текущего пользователя (supabase-js сам продлевает его по refresh token).
export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
