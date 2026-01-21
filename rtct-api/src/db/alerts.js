// src/db/alerts.js
// Insert a new alert into the database using a local pg Pool (same pattern as migrate.js)

const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

// Use the same DATABASE_URL that migrate.js relies on
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Insert a new alert into the alerts table.
 *
 * NOTE:
 * The current alerts table does NOT have a "timestamp" column (see Postgres error 42703),
 * so we rely on explicit created_at / updated_at columns.
 */
async function createAlert(alert) {
  const now = new Date();

  // Fallbacks so internal callers (like /internal/alert) don't have to populate everything
  const id = alert.id || uuidv4();
  const source = alert.source || "unknown";
  const type = alert.type || null;
  const severity = alert.severity || "low";
  const confidence = alert.confidence !== undefined ? alert.confidence : null;
  const message = alert.message || "";
  const status = alert.status || "new";
  const data = alert.data ?? null;
  const createdAt = alert.createdAt || now;
  const updatedAt = alert.updatedAt || now;

  const result = await pool.query(
    `
      INSERT INTO alerts (
        id,
        source,
        type,
        severity,
        confidence,
        message,
        status,
        data,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING
        id,
        source,
        type,
        severity,
        confidence,
        message,
        status,
        data,
        created_at,
        updated_at
    `,
    [
      id,
      source,
      type,
      severity,
      confidence,
      message,
      status,
      data,
      createdAt,
      updatedAt,
    ]
  );

  return result.rows[0];
}

module.exports = {
  createAlert,
};
