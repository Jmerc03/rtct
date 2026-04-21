/**
 * Auth utilities
 * - Default to same-origin "/api" (Ingress/K8s)
 * - Allow override via VITE_API_URL for local dev/build
 * - Always strip trailing slashes to avoid "//" in routes
 * - Adds small helpers: getApiBase, authFetch, isTokenExpired
 */
const API_BASE = String(import.meta.env?.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);

const KEY_TOKEN = "token";
const KEY_USER = "user";

/** Expose the computed API base (useful for debugging) */
export const __AUTH_API_BASE__ = API_BASE;
export function getApiBase() {
  return API_BASE;
}

/** Return current auth boolean */
export function isAuthed() {
  return !!localStorage.getItem(KEY_TOKEN);
}

/** Get the current token */
export function token() {
  return localStorage.getItem(KEY_TOKEN) || "";
}

/** Return current user object */
export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY_USER) || "{}");
  } catch {
    return {};
  }
}

/** Save session { user, token } */
function saveSession({ user, token }) {
  if (typeof token !== "string" || !token) throw new Error("Missing token");
  localStorage.setItem(KEY_TOKEN, token);
  localStorage.setItem(KEY_USER, JSON.stringify(user || {}));
  dispatchAuthEvent("login");
}

/** Clear auth */
export function logout() {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_USER);
  dispatchAuthEvent("logout");
}

/**
 * Decode a JWT payload safely (no verification).
 * Returns {} on failure.
 */
export function decodeJwt(tkn) {
  try {
    const [, payload] = String(tkn).split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

/** Best-effort token expiry check from JWT `exp` (seconds since epoch) */
export function isTokenExpired(tkn = token()) {
  const { exp } = decodeJwt(tkn);
  if (!exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= exp;
}

/**
 * Fetch with Authorization header attached (if token exists).
 * - Automatically handles 401 by clearing session.
 * - Optionally throws on 401 after logout.
 */
export async function authFetch(path, opts = {}, { throwOn401 = true } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const headers = { ...(opts.headers || {}) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(url, { ...opts, headers });

  if (res.status === 401) {
    // Session invalid; clear and optionally let caller handle redirect.
    logout();
    if (throwOn401) {
      throw new Error("Unauthorized");
    }
  }
  return res;
}

/** Sign up via API */
export async function signup({ email, username, password, photoUrl }) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, photoUrl }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Signup failed: ${res.status}`);
  }

  return data;
}

/** Log in via API */
export async function login({ email, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Login failed: ${res.status}`);
  }

  saveSession(data);
  return data.user;
}

/** Verify and refresh session (no refresh token flow; API returns current user) */
export async function me() {
  const t = token();
  if (!t) throw new Error("Not authenticated");

  // If token appears expired, proactively logout for better UX
  if (isTokenExpired(t)) {
    logout();
    throw new Error("Session expired");
  }

  const res = await authFetch("/auth/me", {}, { throwOn401: true });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Session check failed: ${res.status}`);
  }

  localStorage.setItem(KEY_USER, JSON.stringify(data));
  return data;
}

/** Update local profile fields only (not persisted to API yet) */
export function updateProfileLocal(patch) {
  const user = { ...currentUser(), ...patch };
  localStorage.setItem(KEY_USER, JSON.stringify(user));
  dispatchAuthEvent("profile");
  return user;
}

/** Simple auth events across tabs/windows */
const AUTH_EVENT_KEY = "rtct-auth-event";
function dispatchAuthEvent(type) {
  try {
    localStorage.setItem(
      AUTH_EVENT_KEY,
      JSON.stringify({ type, ts: Date.now() }),
    );
    // Immediately remove to keep storage clean and still trigger "storage" event
    localStorage.removeItem(AUTH_EVENT_KEY);
  } catch {
    /* no-op */
  }
}

/** Subscribe to auth changes (login/logout/profile) across tabs */
export function onAuthChange(cb) {
  const handler = (e) => {
    if (e.key !== AUTH_EVENT_KEY) return;
    cb?.(e.newValue ? JSON.parse(e.newValue) : null);
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
