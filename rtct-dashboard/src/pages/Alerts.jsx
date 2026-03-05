import { useEffect, useState } from "react";
import {
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

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [severity, setSeverity] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [source, setSource] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
      setAlerts(data);
    } catch (e) {
      setErr(e.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [severity, minConf, source, fromDate, toDate]);

  useEffect(() => {
    const es = openStream((type, payload) => {
      setAlerts((curr) => {
        if (type === "new") {
          const firstSeenAt = Date.now();
          const withSeen = { ...payload, firstSeenAt };
          return [withSeen, ...curr];
        }
        if (type === "update") {
          return curr.map((a) =>
            a.id === payload.id ? { ...a, ...payload } : a,
          );
        }
        if (type === "delete") return curr.filter((a) => a.id !== payload.id);
        return curr;
      });
    });
    return () => es.close();
  }, []);

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
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Any source"
          style={{ minWidth: 140 }}
        />
        <label>Min confidence: {minConf}</label>
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
          {alerts.map((a) => {
            let latencyLabel = null;
            if (a.data && a.data.generatorCreatedAt && a.firstSeenAt) {
              const genMs = Date.parse(a.data.generatorCreatedAt);
              if (!Number.isNaN(genMs)) {
                const deltaSec = (a.firstSeenAt - genMs) / 1000;
                if (deltaSec >= 0) {
                  latencyLabel = `pipeline: ${deltaSec.toFixed(4)}s`;
                }
              }
            }

            const isNew =
              a.status !== "ack" &&
              a.firstSeenAt &&
              Date.now() - a.firstSeenAt < 8000;

            return (
              <li
                key={a.id}
                style={{
                  border:
                    a.status !== "ack"
                      ? `${isNew ? 4 : 4}px ${isNew ? "solid" : "solid"} ${getSeverityColor(
                          a.severity,
                        )}`
                      : "1px solid #ddd",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <strong>{a.type}</strong>
                  <small title={a.id}>
                    {(() => {
                      const d = new Date(a.created_at || a.createdAt);
                      const ms = String(d.getMilliseconds()).padStart(3, "0");
                      return `${d.toLocaleDateString()}, ${d.toLocaleTimeString()}.${ms}`;
                    })()}{" "}
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
                  <Chip label={`source: ${a.source}`} />
                  <Chip label={`severity: ${a.severity}`} />
                  {"confidence" in a && (
                    <Chip label={`conf: ${a.confidence}`} />
                  )}
                  <Chip label={`status: ${a.status}`} />
                  {latencyLabel && <Chip label={latencyLabel} />}
                </div>
                <p style={{ marginTop: 8 }}>{a.message}</p>
                {a.data && (
                  <pre
                    style={{
                      background: "#f7f7f7",
                      padding: 8,
                      borderRadius: 8,
                    }}
                  >
                    {JSON.stringify(a.data, null, 2)}
                  </pre>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {a.status !== "ack" && (
                    <button onClick={() => ack(a.id)}>Acknowledge</button>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    style={{ color: "#b00" }}
                  >
                    Delete
                  </button>
                </div>
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
