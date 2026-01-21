import { useEffect, useMemo, useState } from "react";
import { listAlerts, openStream, updateAlert, deleteAlert } from "./api";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [severity, setSeverity] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const data = await listAlerts({
        severity: severity || undefined,
        confidence: minConf > 0 ? String(minConf) : undefined,
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
  }, [severity, minConf]);

  // live updates via SSE
  useEffect(() => {
    const es = openStream((type, payload) => {
      setAlerts((curr) => {
        if (type === "new") return [payload, ...curr];
        if (type === "update")
          return curr.map((a) => (a.id === payload.id ? payload : a));
        if (type === "delete") return curr.filter((a) => a.id !== payload.id);
        return curr;
      });
    });
    return () => es.close();
  }, []);

  const ack = async (id) => {
    try {
      await updateAlert(id, { status: "ack" });
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this alert?")) return;
    try {
      await deleteAlert(id);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div style={wrap}>
      <h1>RTCT Alerts</h1>

      <div style={toolbar}>
        <div style={row}>
          <label>Severity:&nbsp;</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">All</option>
            <option>low</option>
            <option>medium</option>
            <option>high</option>
            <option>critical</option>
          </select>
        </div>

        <div style={row}>
          <label>
            Min confidence:&nbsp;<b>{minConf}</b>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={minConf}
            onChange={(e) => setMinConf(parseFloat(e.target.value))}
          />
        </div>

        <button onClick={load}>Reload</button>
      </div>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "#b00" }}>{err}</p>}
      {!loading && alerts.length === 0 && <p>No alerts yet.</p>}

      <ul style={list}>
        {alerts.map((a) => (
          <li key={a.id} style={card}>
            <div style={cardHead}>
              <strong>{a.type}</strong>
              <small title={a.id}>
                {new Date(a.created_at || a.createdAt).toLocaleString()}
              </small>
            </div>
            <div style={chips}>
              <Chip label={`source: ${a.source}`} />
              <Chip label={`severity: ${a.severity}`} />
              {"confidence" in a && <Chip label={`conf: ${a.confidence}`} />}
              <Chip label={`status: ${a.status}`} />
            </div>
            <p style={{ marginTop: 8 }}>{a.message}</p>
            {a.data && <pre style={pre}>{JSON.stringify(a.data, null, 2)}</pre>}
            <div style={{ display: "flex", gap: 8 }}>
              {a.status !== "ack" && (
                <button onClick={() => ack(a.id)}>Acknowledge</button>
              )}
              <button onClick={() => remove(a.id)} style={{ color: "#c00" }}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ label }) {
  return <span style={chip}>{label}</span>;
}

// inline styles (keeps this example single-file)
const wrap = {
  maxWidth: 980,
  margin: "40px auto",
  padding: "0 16px",
  fontFamily: "ui-sans-serif, system-ui",
};
const toolbar = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  margin: "12px 0 20px",
  flexWrap: "wrap",
};
const row = { display: "flex", alignItems: "center", gap: 8 };
const list = { listStyle: "none", padding: 0, display: "grid", gap: 12 };
const card = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};
const cardHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const chips = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 };
const chip = {
  border: "1px solid #ccc",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: 12,
};
const pre = {
  background: "#f7f7f7",
  padding: 8,
  borderRadius: 8,
  overflow: "auto",
};
