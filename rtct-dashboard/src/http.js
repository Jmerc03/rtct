import { logout, token } from "./auth";

// Resolve API base dynamically
const originBase = `${window.location.origin.replace(/\/+$/, "")}`;
const configured = import.meta.env?.VITE_API_URL?.trim?.();
const API =
  configured && configured.length > 0
    ? configured.replace(/\/+$/, "")
    : `${originBase}/api`;

// Generic fetch wrapper with JWT + 401 handling
export async function apiFetch(path, opts = {}) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = { ...(opts.headers || {}) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${API}${p}`, { ...opts, headers });

  if (res.status === 401) {
    logout();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  return res;
}

// Optional: export resolved base for debugging
export const __API_BASE__ = API;
