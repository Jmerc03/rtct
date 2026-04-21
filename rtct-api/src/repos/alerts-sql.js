const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  async create(a) {
    const q = `
      INSERT INTO alerts (id, source, type, severity, confidence, message, status, data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;
    const { rows } = await pool.query(q, [
      a.id,
      a.source,
      a.type,
      a.severity,
      a.confidence,
      a.message,
      a.status ?? "new",
      a.data ?? null,
    ]);
    return rows[0];
  },

  async list(filters = {}) {
    const where = [];
    const vals = [];
    if (filters.status) {
      vals.push(filters.status);
      where.push(`status = $${vals.length}`);
    }
    if (filters.severity) {
      vals.push(filters.severity);
      where.push(`severity = $${vals.length}`);
    }
    if (filters.source) {
      vals.push(filters.source);
      where.push(`source = $${vals.length}`);
    }
    if (filters.confidence) {
      vals.push(filters.confidence);
      where.push(`confidence >= $${vals.length}`);
    }

    const sql = `
      SELECT * FROM alerts
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY created_at DESC
      LIMIT 2000;
    `;
    const { rows } = await pool.query(sql, vals);
    return rows;
  },

  async listSources() {
    const { rows } = await pool.query(`
      SELECT DISTINCT source
      FROM alerts
      WHERE source IS NOT NULL AND source <> ''
      ORDER BY source ASC;
    `);
    return rows.map((r) => r.source);
  },

  async get(id) {
    const { rows } = await pool.query(`SELECT * FROM alerts WHERE id = $1`, [
      id,
    ]);
    return rows[0];
  },

  async update(id, patch) {
    const fields = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      fields.push(`${k} = $${i++}`);
      vals.push(v);
    }
    if (!fields.length) return this.get(id);
    vals.push(id);
    const sql = `
      UPDATE alerts
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${vals.length}
      RETURNING *;
    `;
    const { rows } = await pool.query(sql, vals);
    return rows[0];
  },

  async remove(id) {
    const { rowCount } = await pool.query(`DELETE FROM alerts WHERE id = $1`, [
      id,
    ]);
    return rowCount > 0;
  },

  async ping() {
    await pool.query("SELECT 1");
    return true;
  },
};
