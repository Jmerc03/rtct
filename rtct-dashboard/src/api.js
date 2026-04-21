/**
 * Central API client for the dashboard (no localhost hard-coding).
 * Defaults to same-origin "/api" (Ingress/K8s) and honors VITE_API_URL for local dev.
 */
import { apiFetch, __API_BASE__ as API_BASE } from "./http";
import { token } from "./auth";
export { apiFetch };

/* ------------------------- Alerts ------------------------- */

export async function listAlerts(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
    ),
  ).toString();

  const res = await apiFetch(`/alerts${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`listAlerts failed: ${res.status}`);
  return res.json();
}

export async function getAlert(id) {
  const res = await apiFetch(`/alerts/${id}`);
  if (!res.ok) throw new Error(`getAlert failed: ${res.status}`);
  return res.json();
}

export async function createAlert(doc) {
  const res = await apiFetch(`/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error(`createAlert failed: ${res.status}`);
  return res.json();
}

// IMPORTANT: backend supports PATCH for partial updates (ack, status, etc.)
export async function updateAlert(id, patch) {
  const res = await apiFetch(`/alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateAlert failed: ${res.status}`);
  return res.json();
}

export async function deleteAlert(id) {
  const res = await apiFetch(`/alerts/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`deleteAlert failed: ${res.status}`);
  }
}

export async function listAlertSources() {
  const res = await apiFetch(`/alerts/sources`);
  if (!res.ok) throw new Error(`listAlertSources failed: ${res.status}`);
  return res.json();
}

/* ------------------------- Users ------------------------- */

export async function listPendingUsers() {
  const res = await apiFetch(`/users/pending`);
  if (!res.ok) throw new Error(`listPendingUsers failed: ${res.status}`);
  return res.json();
}

export async function listAllUsers() {
  const res = await apiFetch(`/users`);
  if (!res.ok) throw new Error(`listAllUsers failed: ${res.status}`);
  return res.json();
}

export async function approveUser(id) {
  const res = await apiFetch(`/users/${id}/approve`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`approveUser failed: ${res.status}`);
  return res.json();
}

export async function makeUserAdmin(id) {
  const res = await apiFetch(`/users/${id}/make-admin`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`makeUserAdmin failed: ${res.status}`);
  return res.json();
}

export async function revokeUserApproval(id) {
  const res = await apiFetch(`/users/${id}/revoke-approval`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`revokeUserApproval failed: ${res.status}`);
  return res.json();
}

export async function demoteUserToUser(id) {
  const res = await apiFetch(`/users/${id}/demote`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error(`demoteUserToUser failed: ${res.status}`);
  return res.json();
}

/* ------------------------- Health ------------------------- */

export async function getHealth() {
  const res = await apiFetch(`/health`);
  if (!res.ok) throw new Error(`getHealth failed: ${res.status}`);
  return res.json();
}

/* -------------------------- Pods --------------------------- */

// List pods
export async function listPods() {
  // apiFetch already prefixes the configured API base (usually /api)
  const res = await apiFetch(`/k8/pods`);
  if (!res.ok) throw new Error(`listPods failed: ${res.status}`);
  return res.json();
}

/* -------------------------- SSE --------------------------- */

export function openAlertStream(onEvent) {
  const t = encodeURIComponent(token() || "");
  const es = new EventSource(`${API_BASE}/stream?token=${t}`);
  es.addEventListener("alert.new", (e) => onEvent("new", JSON.parse(e.data)));
  es.addEventListener("alert.update", (e) =>
    onEvent("update", JSON.parse(e.data)),
  );
  es.addEventListener("alert.delete", (e) =>
    onEvent("delete", JSON.parse(e.data)),
  );
  es.onerror = () => console.warn("[SSE] error (will auto-retry)");
  return es;
}
export const openStream = openAlertStream;

// Optional: export the resolved base for troubleshooting
export const __API_BASE__ = API_BASE;
