const express = require("express");
const { v4: uuid } = require("uuid");

const repo =
  process.env.REPO === "sql"
    ? require("../repos/alerts-sql")
    : require("../repos/alerts-memory");
const bus = require("../bus");

const router = express.Router();

// POST /alerts  → create new alert
router.post("/", async (req, res) => {
  const { source, type, severity, message, confidence, data } = req.body || {};
  if (!source || !type || !severity || !message || confidence == null) {
    return res
      .status(400)
      .json({ error: "source, type, severity, message, confidence required" });
  }

  const alert = {
    id: uuid(),
    source,
    type,
    severity,
    confidence,
    message,
    status: "new",
    data: data ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await repo.create(alert);
  bus.broadcast("alert.new", alert);
  res.status(201).json(alert);
});

// Helper: parse a "YYYY-MM-DD" + optional "HH:MM" into a Date (UTC)
function parseDateAndTime(dateStr, timeStr, defaultTime) {
  if (!dateStr) return null;

  let year, month, day;

  if (dateStr.includes("-")) {
    // HTML date input: YYYY-MM-DD
    [year, month, day] = dateStr.split("-").map(Number);
  } else if (dateStr.includes("/")) {
    // MM/DD/YYYY fallback
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      month = Number(parts[0]);
      day = Number(parts[1]);
      year = Number(parts[2]);
    }
  }

  if (!year || !month || !day) return null;

  let hours = defaultTime.hours;
  let minutes = defaultTime.minutes;

  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    if (!Number.isNaN(h)) hours = h;
    if (!Number.isNaN(m)) minutes = m;
  }

  const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET /alerts?status=&severity=&source=&confidence=&from=&to=&fromTime=&toTime=
//
// Notes:
// - `confidence` is treated as "minimum confidence".
// - `from` / `to` are expected as "YYYY-MM-DD" (HTML date input format).
// - `fromTime` / `toTime` are optional "HH:MM" (24h).
//   We interpret the range as:
//     fromDateTime => createdAt >= fromDateTime
//     toDateTime   => createdAt <= toDateTime
router.get("/", async (req, res) => {
  try {
    const { status, severity, source, confidence, from, to, fromTime, toTime } =
      req.query;

    const baseFilters = {
      status: status || undefined,
      severity: severity || undefined,
      source: source || undefined,
      confidence: confidence ? Number(confidence) : undefined,
    };

    const allAlerts = await repo.list(baseFilters);

    let filtered = allAlerts;

    if (from || to || fromTime || toTime) {
      const fromDateTime = from
        ? parseDateAndTime(from, fromTime, { hours: 0, minutes: 0 })
        : null;

      const toDateTime = to
        ? parseDateAndTime(to, toTime, { hours: 23, minutes: 59 })
        : null;

      filtered = filtered.filter((a) => {
        const raw = a.createdAt || a.created_at || a.timestamp;
        if (!raw) return true;

        const created = new Date(raw);
        if (Number.isNaN(created.getTime())) return true;

        if (fromDateTime && created < fromDateTime) return false;
        if (toDateTime && created > toDateTime) return false;

        return true;
      });
    }

    res.json(filtered);
  } catch (err) {
    console.error("[GET /alerts] failed:", err);
    res.status(500).json({ error: "failed_to_list_alerts" });
  }
});

// GET /alerts/:id
router.get("/:id", async (req, res) => {
  const a = await repo.get(req.params.id);
  if (!a) return res.sendStatus(404);
  res.json(a);
});

// PUT /alerts/:id
router.put("/:id", async (req, res) => {
  const { status, severity, message, confidence, data } = req.body || {};
  const allowed = ["new", "ack", "resolved"];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }
  const updated = await repo.update(req.params.id, {
    status,
    severity,
    confidence,
    message,
    data,
  });
  if (!updated) return res.sendStatus(404);
  bus.broadcast("alert.update", updated);
  res.json(updated);
});

// DELETE /alerts/:id
router.delete("/:id", async (req, res) => {
  const ok = await repo.remove(req.params.id);
  if (!ok) return res.sendStatus(404);
  bus.broadcast("alert.delete", { id: req.params.id });
  res.sendStatus(204);
});

module.exports = router;
