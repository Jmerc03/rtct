import { useEffect, useState } from "react";
import {
  listAlertSources,
  listAlerts,
  updateAlert,
  deleteAlert,
  openStream,
  createAlert,
} from "../api";

const makeTest = async () => {
  await createAlert({
    source: "ui-tester",
    type: "demo",
    severity: "high",
    confidence: 0.8,
    message: "Demo alert from dashboard",
    data: { by: "dashboard" },
  });
};

function getAlertTimeMs(a) {
  const v = a.created_at || a.createdAt || a.firstSeenAt;
  const d = new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function groupAlerts(list) {
  if (!Array.isArray(list) || list.length === 0) return [];

  // sort newest first
  const sorted = [...list].sort(
    (a, b) => getAlertTimeMs(b) - getAlertTimeMs(a),
  );

  const groups = [];

  for (const a of sorted) {
    const t = getAlertTimeMs(a);
    let placed = false;

    for (const g of groups) {
      const head = g[0]; // most recent in group
      const sameKey =
        String(head.source) === String(a.source) &&
        String(head.severity) === String(a.severity) &&
        String(head.type) === String(a.type);

      if (!sameKey) continue;

      const headTime = getAlertTimeMs(head);
      if (Math.abs(headTime - t) <= 5000) {
        g.push(a);
        // keep group sorted newest first
        g.sort((x, y) => getAlertTimeMs(y) - getAlertTimeMs(x));
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([a]);
    }
  }

  // ensure groups ordered by newest item
  groups.sort((g1, g2) => getAlertTimeMs(g2[0]) - getAlertTimeMs(g1[0]));
  return groups;
}

function alertMatchesFilters(alert, filters) {
  if (!alert) return false;

  const {
    severity = "",
    minConf = 0,
    source = "",
    fromDate = "",
    toDate = "",
  } = filters;

  if (
    severity &&
    String(alert.severity || "").toLowerCase() !==
      String(severity).toLowerCase()
  ) {
    return false;
  }

  if (source && String(alert.source || "") !== String(source)) {
    return false;
  }

  if (minConf > 0) {
    const confidenceValue = Number(alert.confidence);
    if (
      !Number.isFinite(confidenceValue) ||
      confidenceValue <= Number(minConf)
    ) {
      return false;
    }
  }

  const createdValue = alert.created_at || alert.createdAt;
  if (createdValue) {
    const createdAt = new Date(createdValue);
    if (!Number.isNaN(createdAt.getTime())) {
      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (createdAt < from) return false;
      }

      if (toDate) {
        const to = new Date(`${toDate}T23:59:59.999`);
        if (createdAt > to) return false;
      }
    }
  }

  return true;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [severity, setSeverity] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [source, setSource] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [expandedRawJson, setExpandedRawJson] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [allSources, setAllSources] = useState([]);

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const data = await listAlerts({
        severity: severity || undefined,
        confidence: minConf > 0 ? String(minConf) : undefined,
        source: source.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      const filters = { severity, minConf, source, fromDate, toDate };
      setAlerts(
        Array.isArray(data)
          ? data.filter((a) => alertMatchesFilters(a, filters))
          : [],
      );
    } catch (e) {
      setErr(e.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  async function loadSources() {
    try {
      const data = await listAlertSources();
      setAllSources(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load sources", e);
    }
  }

  useEffect(() => {
    load();
  }, [severity, minConf, source, fromDate, toDate]);

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    const es = openStream((type, payload) => {
      const filters = { severity, minConf, source, fromDate, toDate };

      setAlerts((curr) => {
        if (type === "new") {
          const firstSeenAt = Date.now();
          const withSeen = { ...payload, firstSeenAt };
          if (!alertMatchesFilters(withSeen, filters)) {
            return curr;
          }
          return [withSeen, ...curr];
        }

        if (type === "update") {
          const existing = curr.find((a) => a.id === payload.id);
          const merged = existing ? { ...existing, ...payload } : payload;
          const matches = alertMatchesFilters(merged, filters);

          if (!matches) {
            return curr.filter((a) => a.id !== payload.id);
          }

          if (existing) {
            return curr.map((a) => (a.id === payload.id ? merged : a));
          }

          return [{ ...merged, firstSeenAt: Date.now() }, ...curr];
        }

        if (type === "delete") {
          return curr.filter((a) => a.id !== payload.id);
        }

        return curr;
      });
    });
    return () => es.close();
  }, [severity, minConf, source, fromDate, toDate]);

  const ack = async (id) => {
    await updateAlert(id, { status: "ack" });
  };
  const remove = async (id) => {
    await deleteAlert(id);
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Alerts</h2>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          margin: "8px 0 16px",
        }}
      >
        <label>Severity:</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All</option>
          <option>low</option>
          <option>medium</option>
          <option>high</option>
        </select>
        <label>Source:</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">All Sources</option>
          {allSources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label>Confidence &gt; {minConf}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={minConf}
          onChange={(e) => setMinConf(parseFloat(e.target.value))}
        />
        <label>From:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <label>To:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <button onClick={load} disabled={loading}>
          Reload
        </button>
        <button
          onClick={() => {
            setSeverity("");
            setMinConf(0);
            setSource("");
            setFromDate("");
            setToDate("");
          }}
          disabled={loading}
        >
          Clear Filters
        </button>
        <button onClick={makeTest} disabled={loading}>
          Create Test Alert
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "#b00" }}>{err}</p>}

      {alerts.length === 0 ? (
        <p>No alerts yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {groupAlerts(alerts).map((group) => {
            const head = group[0];
            const gid = head.id;
            const isExpanded = !!expandedGroups[gid];
            const oldest = group[group.length - 1];
            const newest = group[0];
            const groupTimeLabel =
              group.length > 1
                ? `${formatTimeOnlyMs(oldest.created_at || oldest.createdAt)} → ${formatTimeOnlyMs(newest.created_at || newest.createdAt)}`
                : null;

            const latencyLabel =
              head.data && head.data.generatorCreatedAt && head.firstSeenAt
                ? (() => {
                    const genMs = Date.parse(head.data.generatorCreatedAt);
                    if (!Number.isNaN(genMs)) {
                      const deltaSec = (head.firstSeenAt - genMs) / 1000;
                      if (deltaSec >= 0)
                        return `pipeline: ${deltaSec.toFixed(4)}s`;
                    }
                    return null;
                  })()
                : null;

            const isNew =
              head.status !== "ack" &&
              head.firstSeenAt &&
              Date.now() - head.firstSeenAt < 8000;

            return (
              <li
                key={gid}
                style={{
                  border:
                    head.status !== "ack"
                      ? `${isNew ? 4 : 4}px solid ${getSeverityColor(head.severity)}`
                      : "1px solid #ddd",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <strong>{head.type}</strong>
                  <small title={head.id} style={{ whiteSpace: "nowrap" }}>
                    {groupTimeLabel
                      ? groupTimeLabel
                      : formatTimestampMs(head.created_at || head.createdAt)}
                  </small>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  <Chip label={`source: ${head.source}`} />
                  <Chip label={`severity: ${head.severity}`} />
                  {"confidence" in head && (
                    <Chip label={`conf: ${head.confidence}`} />
                  )}
                  <Chip label={`status: ${head.status}`} />
                  {latencyLabel && <Chip label={latencyLabel} />}
                  {group.length > 1 && (
                    <Chip label={`count: ${group.length}`} />
                  )}
                </div>

                <p style={{ marginTop: 8 }}>{head.message}</p>

                {head.data && (
                  <div
                    style={{
                      background: "#f7f7f7",
                      padding: 10,
                      borderRadius: 8,
                      display: "grid",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>Alert Data</strong>
                    <AlertDataView data={head.data} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {group.length > 1 && (
                    <button
                      onClick={() =>
                        setExpandedGroups((curr) => ({
                          ...curr,
                          [gid]: !curr[gid],
                        }))
                      }
                    >
                      {isExpanded ? "Collapse" : "Expand"}
                    </button>
                  )}

                  {head.status !== "ack" && (
                    <button onClick={() => ack(head.id)}>Acknowledge</button>
                  )}
                  <button
                    onClick={() => remove(head.id)}
                    style={{ color: "#b00" }}
                  >
                    Delete
                  </button>
                </div>

                {isExpanded && group.length > 1 && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {group.slice(1).map((a) => (
                      <div
                        key={a.id}
                        style={{ borderTop: "1px dashed #eee", paddingTop: 8 }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <strong>{a.type}</strong>
                          <small title={a.id}>
                            {formatTimestampMs(a.created_at || a.createdAt)}
                          </small>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 6,
                          }}
                        >
                          <Chip label={`source: ${a.source}`} />
                          <Chip label={`severity: ${a.severity}`} />
                          {"confidence" in a && (
                            <Chip label={`conf: ${a.confidence}`} />
                          )}
                          <Chip label={`status: ${a.status}`} />
                        </div>
                        <p style={{ marginTop: 6 }}>{a.message}</p>
                        {a.data && (
                          <div
                            style={{
                              background: "#f7f7f7",
                              padding: 10,
                              borderRadius: 8,
                              display: "grid",
                              gap: 8,
                            }}
                          >
                            <strong style={{ fontSize: 13 }}>Alert Data</strong>
                            <AlertDataView data={a.data} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function getSeverityColor(severity) {
  switch ((severity || "").toLowerCase()) {
    case "low":
      return "#3b82f6"; // blue
    case "medium":
      return "#f59e0b"; // amber
    case "high":
      return "#dc2626"; // orange
    case "critical":
      return "#dc2626"; // red
    default:
      return "#999";
  }
}

function Chip({ label }) {
  return (
    <span
      style={{
        border: "1px solid #ddd",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

function formatTimestampMs(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

function formatTimeOnlyMs(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");

  return `${hh}:${mi}:${ss}.${ms}`;
}

function formatDataKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatDataValue(value) {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function AlertDataView({ data }) {
  if (!data || typeof data !== "object") {
    return <span>{formatDataValue(data)}</span>;
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span style={{ color: "#666" }}>No additional data</span>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {entries.map(([key, value]) => (
        <AlertDataField key={key} label={formatDataKey(key)} value={value} />
      ))}
    </div>
  );
}

function AlertDataField({ label, value, depth = 0 }) {
  const nestedStyle = {
    marginLeft: depth > 0 ? 12 : 0,
    paddingLeft: depth > 0 ? 10 : 0,
    borderLeft: depth > 0 ? "2px solid #e5e7eb" : "none",
    display: "grid",
    gap: 6,
  };

  if (Array.isArray(value)) {
    return (
      <div style={nestedStyle}>
        <strong style={{ fontSize: 12 }}>{label}:</strong>
        {value.length === 0 ? (
          <span style={{ color: "#666" }}>[]</span>
        ) : (
          value.map((item, idx) => {
            if (item && typeof item === "object") {
              return (
                <AlertDataField
                  key={`${label}-${idx}`}
                  label={`${label} ${idx + 1}`}
                  value={item}
                  depth={depth + 1}
                />
              );
            }
            return (
              <div key={`${label}-${idx}`} style={{ marginLeft: 12 }}>
                • {formatDataValue(item)}
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const childEntries = Object.entries(value);
    return (
      <div style={nestedStyle}>
        <strong style={{ fontSize: 12 }}>{label}:</strong>
        {childEntries.length === 0 ? (
          <span style={{ color: "#666" }}>{"{}"}</span>
        ) : (
          childEntries.map(([childKey, childValue]) => (
            <AlertDataField
              key={`${label}-${childKey}`}
              label={formatDataKey(childKey)}
              value={childValue}
              depth={depth + 1}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "baseline",
        flexWrap: "wrap",
      }}
    >
      <strong style={{ fontSize: 12 }}>{label}:</strong>
      <span style={{ wordBreak: "break-word" }}>{formatDataValue(value)}</span>
    </div>
  );
}
