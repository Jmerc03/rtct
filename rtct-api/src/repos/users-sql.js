const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = {
  async create({ email, username, passwordHash, photoUrl }) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash, photo_url, role, is_approved)
      VALUES ($1,$2,$3,$4,'user',false)
      RETURNING id, email, username, photo_url, role, is_approved, created_at`,
      [email, username, passwordHash, photoUrl ?? null],
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    return rows[0];
  },

  async update(id, { username, photoUrl }) {
    const fields = [];
    const vals = [];
    let i = 1;

    if (username !== undefined) {
      fields.push(`username = $${i++}`);
      vals.push(username);
    }
    if (photoUrl !== undefined) {
      fields.push(`photo_url = $${i++}`);
      vals.push(photoUrl);
    }

    if (!fields.length) return null;
    vals.push(id);

    const { rows } = await pool.query(
      `UPDATE users
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${vals.length}
     RETURNING id, email, username, photo_url, role, is_approved, created_at`,
      vals,
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await pool.query(
      "SELECT id,email,username,photo_url,role,is_approved,created_at FROM users WHERE id=$1",
      [id],
    );
    return rows[0];
  },

  async listAll() {
    const { rows } = await pool.query(
      `SELECT id, email, username, photo_url, role, is_approved, created_at
       FROM users
       ORDER BY created_at DESC`,
    );
    return rows;
  },

  async listPending() {
    const { rows } = await pool.query(
      `SELECT id, email, username, photo_url, role, is_approved, created_at
       FROM users
       WHERE COALESCE(is_approved, false) = false
       ORDER BY created_at ASC`,
    );
    return rows;
  },

  async approve(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET is_approved = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, photo_url, role, is_approved, created_at`,
      [id],
    );
    return rows[0];
  },

  async makeAdmin(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET role = 'admin', is_approved = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, photo_url, role, is_approved, created_at`,
      [id],
    );
    return rows[0];
  },

  async revokeApproval(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET is_approved = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, photo_url, role, is_approved, created_at`,
      [id],
    );
    return rows[0];
  },

  async demoteToUser(id) {
    const { rows } = await pool.query(
      `UPDATE users
       SET role = 'user', updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username, photo_url, role, is_approved, created_at`,
      [id],
    );
    return rows[0];
  },
};
